import type { CLI, DeployOptions } from '@stacksjs/types'
import { $ } from 'bun'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { italic, outro, prompts, runCommand } from '@stacksjs/cli'
import { app, email as emailConfig } from '@stacksjs/config'
import { addDomain, hasUserDomainBeenAddedToCloud } from '@stacksjs/dns'
import { encryptEnv } from '@stacksjs/env'
import { Action } from '@stacksjs/enums'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

// Use console.log for clean output without timestamps
const log = {
  info: (...args: any[]) => console.log('ℹ', ...args),
  success: (...args: any[]) => console.log('✓', ...args),
  warn: (...args: any[]) => console.log('⚠', ...args),
  error: (...args: any[]) => console.error('✗', ...args),
  debug: (...args: any[]) => {
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
      console.log('🔍', ...args)
    }
  },
}

/**
 * Load AWS credentials from ~/.aws/credentials file
 * Returns credentials for the specified profile (or 'default'/'stacks')
 */
function loadAwsCredentialsFromFile(): { accessKeyId?: string, secretAccessKey?: string, region?: string } {
  const credentialsPath = join(homedir(), '.aws', 'credentials')
  const configPath = join(homedir(), '.aws', 'config')

  if (!existsSync(credentialsPath)) {
    return {}
  }

  try {
    const content = readFileSync(credentialsPath, 'utf-8')
    const lines = content.split('\n')

    // Try to find credentials in order: stacks profile, default profile, any profile
    const profiles = ['stacks', 'default']
    let currentProfile = ''
    let credentials: { accessKeyId?: string, secretAccessKey?: string } = {}
    const profileCredentials: Record<string, { accessKeyId?: string, secretAccessKey?: string }> = {}

    for (const line of lines) {
      const trimmed = line.trim()

      // Check for profile header
      const profileMatch = trimmed.match(/^\[(.+)\]$/)
      if (profileMatch) {
        currentProfile = profileMatch[1]
        profileCredentials[currentProfile] = {}
        continue
      }

      // Parse key=value
      const keyValue = trimmed.match(/^(\w+)\s*=\s*(.+)$/)
      if (keyValue && currentProfile) {
        const [, key, value] = keyValue
        if (key === 'aws_access_key_id') {
          profileCredentials[currentProfile].accessKeyId = value
        }
        else if (key === 'aws_secret_access_key') {
          profileCredentials[currentProfile].secretAccessKey = value
        }
      }
    }

    // Try to find credentials in preferred order
    for (const profile of profiles) {
      if (profileCredentials[profile]?.accessKeyId && profileCredentials[profile]?.secretAccessKey) {
        credentials = profileCredentials[profile]
        log.debug(`Using AWS credentials from ~/.aws/credentials [${profile}] profile`)
        break
      }
    }

    // Fallback to any available profile
    if (!credentials.accessKeyId) {
      for (const [profile, creds] of Object.entries(profileCredentials)) {
        if (creds.accessKeyId && creds.secretAccessKey) {
          credentials = creds
          log.debug(`Using AWS credentials from ~/.aws/credentials [${profile}] profile`)
          break
        }
      }
    }

    // Try to load region from config file
    let region: string | undefined
    if (existsSync(configPath)) {
      const configContent = readFileSync(configPath, 'utf-8')
      const regionMatch = configContent.match(/region\s*=\s*(.+)/)
      if (regionMatch) {
        region = regionMatch[1].trim()
      }
    }

    return { ...credentials, region }
  }
  catch (error) {
    log.debug('Failed to read AWS credentials file:', error)
    return {}
  }
}

export function deploy(buddy: CLI): void {
  const descriptions = {
    deploy: 'Deploy your project',
    project: 'Target a specific project',
    production: 'Deploy to production',
    development: 'Deploy to development',
    staging: 'Deploy to staging',
    yes: 'Confirm all prompts by default',
    domain: 'Specify a domain to deploy to',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('deploy [env]', descriptions.deploy)
    .option('--domain', descriptions.domain, { default: undefined })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--prod', descriptions.production, { default: true })
    .option('--dev', descriptions.development, { default: false })
    .option('--yes', descriptions.yes, { default: false })
    .option('--staging', descriptions.staging, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (env: string | undefined, options: DeployOptions) => {
      log.debug('Running `buddy deploy` ...', options)

      const deployEnv = env || 'production'

      // Clear AWS_PROFILE to prevent credential conflicts when static credentials are provided
      // AWS SDK's defaultProvider prefers profile over static credentials, causing InvalidClientTokenId errors
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        delete process.env.AWS_PROFILE
      }

      const startTime = performance.now()
      console.log('')
      console.log('🚀 Deploy')
      console.log('')

      // For production deploy, explicitly load .env.production to get the correct domain
      // This ensures we use production settings even if .env.local has different values
      let productionUrl: string | undefined
      if (deployEnv === 'production' || deployEnv === 'prod') {
        const prodEnvPath = p.projectPath('.env.production')
        if (existsSync(prodEnvPath)) {
          const prodEnvContent = readFileSync(prodEnvPath, 'utf-8')
          const urlMatch = prodEnvContent.match(/^APP_URL=(.+)$/m)
          if (urlMatch) {
            productionUrl = urlMatch[1].trim()
            log.debug('Using APP_URL from .env.production:', productionUrl)
          }
        }
      }

      // Get domain from options, production env, Bun.env, or config
      const envUrl = typeof Bun !== 'undefined' ? Bun.env.APP_URL : process.env.APP_URL
      const domain = options.domain || productionUrl || envUrl || app.url

      if ((options.prod || deployEnv === 'production' || deployEnv === 'prod') && !options.yes)
        await confirmProductionDeployment()

      if (!domain) {
        log.info('No domain found in your .env.production or ./config/app.ts')
        log.info('Please ensure your domain is properly configured.')
        log.info('For more info, check out the docs or join our Discord.')
        process.exit(ExitCode.FatalError)
      }

      log.info(`Deploying to ${italic(domain)} (${deployEnv})`)

      // Skip AWS config check - we'll handle credentials in checkIfAwsIsBootstrapped
      await checkIfAwsIsBootstrapped(options)

      options.domain = await configureDomain(domain, options, startTime)

      const result = await runAction(Action.Deploy, options)

      if (result.isErr) {
        await outro(
          'While running the `buddy deploy`, there was an issue',
          { startTime, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Project deployed.', { startTime, useSeconds: true })
    })

  buddy.on('deploy:*', () => {
    log.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

async function confirmProductionDeployment() {
  const confirmed = await prompts.confirm({
    message: 'Are you sure you want to deploy to production?',
    initial: true,
  })

  if (!confirmed) {
    log.info('Aborting deployment...')
    process.exit(ExitCode.InvalidArgument)
  }
}

async function configureDomain(domain: string, options: DeployOptions, startTime: number) {
  log.debug('Configuring domain...', domain)
  if (!domain) {
    log.info('We could not identify a domain to deploy to.')
    log.warn('Please set your .env or ./config/app.ts properly.')
    log.info('Alternatively, specify a domain to deploy via the `--domain` flag.')
    console.log('')
    log.info('   ➡️  Example: `buddy deploy --domain example.com`')
    console.log('')
    process.exit(ExitCode.FatalError)
  }

  // TODO: we can improve this check at some point, otherwise domains that legitimately include the word localhost will fail
  // TODO: add check for whether the local APP_ENV is getting deployed, if so, ask if the user meant to deploy `dev`
  if (domain.includes('localhost')) {
    log.info('You are deploying to a local environment.')
    log.warn(
      'Please set your .env or ./config/app.ts properly. The domain we are deploying cannot be a `localhost` domain.',
    )
    log.info('Alternatively, specify a domain to deploy via the `--domain` flag.')
    console.log('')
    log.info('   ➡️  Example: `buddy deploy --domain example.com`')
    console.log('')
    process.exit(ExitCode.FatalError)
  }

  if (await hasUserDomainBeenAddedToCloud(domain)) {
    log.info('Domain is properly configured')
    log.info('Your cloud is deploying...')

    log.info(`${italic('This may take a while...')}`)

    return domain
  }

  // if the domain hasn't been added to the user's (AWS) cloud, we will add it for them
  // and then exit the process with prompts for the user to update their nameservers
  console.log('')
  log.info(`  👋  It appears to be your first ${italic(domain)} deployment.`)
  console.log('')
  log.info(italic('Let’s ensure it is all connected properly.'))
  log.info(italic('One moment...'))
  console.log('')

  const result = await addDomain({
    ...options,
    deploy: true,
    startTime,
  })

  if (result.isErr) {
    await outro('While running the `buddy deploy`, there was an issue', { startTime, useSeconds: true }, result.error)
    process.exit(ExitCode.FatalError)
  }

  await outro('Added your domain.', { startTime, useSeconds: true })
  process.exit(ExitCode.Success)
}

async function promptAndSaveCredentials() {
  // Prompt for AWS credentials
  const accessKeyId = await prompts.text({
    message: 'AWS Access Key ID:',
    validate: (value: string) => value.length > 0 ? true : 'Access Key ID is required',
  })

  if (!accessKeyId) {
    log.info('Deployment cancelled')
    process.exit(ExitCode.Success)
  }

  const secretAccessKey = await prompts.password({
    message: 'AWS Secret Access Key:',
    validate: (value: string) => value.length > 0 ? true : 'Secret Access Key is required',
  })

  if (!secretAccessKey) {
    log.info('Deployment cancelled')
    process.exit(ExitCode.Success)
  }

  const region = await prompts.text({
    message: 'AWS Region:',
    initial: 'us-east-1',
  })

  if (!region) {
    log.info('Deployment cancelled')
    process.exit(ExitCode.Success)
  }

  // Save credentials to .env.production with encryption
  const { setEnv } = await import('@stacksjs/env')

  // Set and encrypt the credentials
  await setEnv('AWS_ACCESS_KEY_ID', accessKeyId, { file: '.env.production', encrypt: true })
  await setEnv('AWS_SECRET_ACCESS_KEY', secretAccessKey, { file: '.env.production', encrypt: true })
  await setEnv('AWS_REGION', region || 'us-east-1', { file: '.env.production' })

  // Update process.env
  process.env.AWS_ACCESS_KEY_ID = accessKeyId
  process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey
  process.env.AWS_REGION = region || 'us-east-1'

  log.success('AWS credentials saved securely to .env.production')
  console.log('')
}

/**
 * Load AWS credentials from environment-specific .env file
 * Returns credentials if found, otherwise empty object
 */
function loadAwsCredentialsFromEnv(): { accessKeyId?: string, secretAccessKey?: string, region?: string, accountId?: string } {
  // Determine environment from APP_ENV
  const environment = process.env.APP_ENV || process.env.NODE_ENV || 'production'

  // Try environment-specific file first (e.g., .env.staging, .env.production)
  const envFiles = [
    p.projectPath(`.env.${environment}`),
    p.projectPath('.env'),
  ]

  for (const envPath of envFiles) {
    if (!existsSync(envPath)) {
      continue
    }

    try {
      const content = readFileSync(envPath, 'utf-8')
      const lines = content.split('\n')

      let accessKeyId: string | undefined
      let secretAccessKey: string | undefined
      let region: string | undefined
      let accountId: string | undefined

      for (const line of lines) {
        const trimmed = line.trim()

        // Skip comments and empty lines
        if (trimmed.startsWith('#') || !trimmed.includes('=')) {
          continue
        }

        const [key, ...valueParts] = trimmed.split('=')
        const value = valueParts.join('=').trim()

        if (key === 'AWS_ACCESS_KEY_ID' && value) {
          accessKeyId = value
        }
        else if (key === 'AWS_SECRET_ACCESS_KEY' && value) {
          secretAccessKey = value
        }
        else if (key === 'AWS_REGION' && value) {
          region = value
        }
        else if (key === 'AWS_ACCOUNT_ID' && value) {
          accountId = value
        }
      }

      if (accessKeyId && secretAccessKey) {
        log.debug(`Found AWS credentials in ${envPath}`)
        return { accessKeyId, secretAccessKey, region, accountId }
      }
    }
    catch (error) {
      log.debug(`Failed to read ${envPath} file:`, error)
    }
  }

  return {}
}

async function checkIfAwsIsBootstrapped(options?: DeployOptions) {
  let handlingAlreadyExists = false

  try {
    log.info('Ensuring AWS cloud stack exists...')

    // Check if AWS credentials are configured in env vars (non-empty values)
    let hasCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY

    // Try to load from environment-specific .env file first
    if (!hasCredentials) {
      const envCredentials = loadAwsCredentialsFromEnv()

      if (envCredentials.accessKeyId && envCredentials.secretAccessKey) {
        process.env.AWS_ACCESS_KEY_ID = envCredentials.accessKeyId
        process.env.AWS_SECRET_ACCESS_KEY = envCredentials.secretAccessKey
        if (envCredentials.region && !process.env.AWS_REGION) {
          process.env.AWS_REGION = envCredentials.region
        }
        if (envCredentials.accountId && !process.env.AWS_ACCOUNT_ID) {
          process.env.AWS_ACCOUNT_ID = envCredentials.accountId
        }
        hasCredentials = true
        const environment = process.env.APP_ENV || process.env.NODE_ENV || 'production'
        log.success(`Using AWS credentials from .env.${environment}`)
      }
    }

    // If still no credentials, try to load from ~/.aws/credentials
    if (!hasCredentials) {
      const fileCredentials = loadAwsCredentialsFromFile()

      if (fileCredentials.accessKeyId && fileCredentials.secretAccessKey) {
        // Set credentials in process.env for downstream use
        process.env.AWS_ACCESS_KEY_ID = fileCredentials.accessKeyId
        process.env.AWS_SECRET_ACCESS_KEY = fileCredentials.secretAccessKey
        if (fileCredentials.region && !process.env.AWS_REGION) {
          process.env.AWS_REGION = fileCredentials.region
        }
        hasCredentials = true
        log.success('Using AWS credentials from ~/.aws/credentials')
      }
    }

    if (!hasCredentials) {
      log.info('AWS credentials not found in .env or ~/.aws/credentials.')
      log.info('You can either:')
      log.info('  1. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.production')
      log.info('  2. Add credentials to ~/.aws/credentials')
      log.info('  3. Configure them interactively below')
      console.log('')

      // If --yes flag is used, skip prompting and just inform the user
      if (options?.yes) {
        log.info('Skipping credential setup (--yes flag provided)')
        process.exit(ExitCode.FatalError)
      }

      const setupCredentials = await prompts.confirm({
        message: 'Would you like to configure AWS credentials now?',
        initial: true,
      })

      log.debug('setupCredentials response:', setupCredentials, typeof setupCredentials)

      // Handle user cancellation (Ctrl+C or ESC) or explicit "no"
      if (setupCredentials === undefined || setupCredentials === false) {
        if (setupCredentials === undefined) {
          console.log('')
          log.info('Deployment cancelled')
          process.exit(ExitCode.Success)
        }
        console.log('')
        log.info('Skipping cloud infrastructure check')
        log.info('You can configure AWS credentials later by running: buddy configure:aws')
        return true
      }

      await promptAndSaveCredentials()
    }
    else {
      log.success('AWS credentials found')
    }

    // Generate stack name from app name and environment
    const appName = (process.env.APP_NAME || app.name || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const stackName = `${appName}-cloud`

    // Use ts-cloud's CloudFormation client
    const { CloudFormationClient } = await import('ts-cloud/aws')

    // Don't pass AWS_PROFILE when we have static credentials to avoid conflicts
    const cfnClient = new CloudFormationClient(
      process.env.AWS_REGION || 'us-east-1'
    )

    // Check if stack exists and if it needs updating
    let stackExists = false
    let needsEmailUpdate = false

    try {
      const result = await cfnClient.describeStacks({ stackName })

      if (result.Stacks && result.Stacks.length > 0) {
        stackExists = true
        log.success('Cloud stack exists')

        // Check if email infrastructure is already deployed and matches config
        const resources = await cfnClient.listStackResources(stackName)
        const hasEmailBucket = resources.StackResourceSummaries?.some(
          (r: any) => r.LogicalResourceId === 'EmailBucket'
        )
        const hasOutboundLambda = resources.StackResourceSummaries?.some(
          (r: any) => r.LogicalResourceId === 'OutboundEmailLambda'
        )
        const hasConversionLambda = resources.StackResourceSummaries?.some(
          (r: any) => r.LogicalResourceId === 'EmailConversionLambda'
        )
        const hasNotificationTopic = resources.StackResourceSummaries?.some(
          (r: any) => r.LogicalResourceId === 'EmailNotificationTopic'
        )

        // Get current email domain from stack outputs to check if it needs updating
        const currentEmailDomain = result.Stacks[0]?.Outputs?.find(
          (o: any) => o.OutputKey === 'EmailDomain'
        )?.OutputValue

        const configuredDomain = emailConfig?.from?.address?.split('@')[1] || 'stacksjs.com'

        if (!hasEmailBucket && emailConfig?.server?.scan !== undefined) {
          log.info('Email infrastructure not found in stack, will update...')
          needsEmailUpdate = true
        }
        else if (currentEmailDomain && currentEmailDomain !== configuredDomain) {
          log.info(`Email domain changed: ${currentEmailDomain} -> ${configuredDomain}, will update...`)
          needsEmailUpdate = true
        }
        else if (hasEmailBucket && (!hasOutboundLambda || !hasConversionLambda || !hasNotificationTopic)) {
          log.info('Email infrastructure incomplete, will update...')
          needsEmailUpdate = true
        }

        if (!needsEmailUpdate) {
          return true
        }
      }
    }
    catch (error: any) {
      log.debug(`Stack not found: ${error.message}`)
      // Stack doesn't exist, we'll create it below
    }

    if (!stackExists) {
      log.info('Cloud stack not found')
    }
    log.info('Creating/updating cloud infrastructure. This may take a few moments...')

    // Get email configuration
    const emailDomain = emailConfig?.from?.address?.split('@')[1] || 'stacksjs.com'
    const emailBucketName = `${appName}-emails`
    const region = process.env.AWS_REGION || 'us-east-1'
    const enableEmailServer = emailConfig?.server?.scan !== undefined

    log.info(`Email domain: ${emailDomain}`)
    log.info(`Email server enabled: ${enableEmailServer}`)

    // Create CloudFormation template for Stacks cloud infrastructure with email support
    const template: any = {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: `${appName} Cloud Infrastructure with Email Server`,
      Resources: {
        // Assets bucket
        StacksBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {
            BucketName: `${appName}-${process.env.APP_ENV || 'production'}-assets`,
            PublicAccessBlockConfiguration: {
              BlockPublicAcls: false,
              BlockPublicPolicy: false,
              IgnorePublicAcls: false,
              RestrictPublicBuckets: false,
            },
            WebsiteConfiguration: {
              IndexDocument: 'index.html',
              ErrorDocument: 'error.html',
            },
          },
        },
      },
      Outputs: {
        BucketName: {
          Description: 'Name of the S3 bucket',
          Value: { Ref: 'StacksBucket' },
          Export: {
            Name: `${appName}BucketName`,
          },
        },
        BucketWebsiteURL: {
          Description: 'URL of the S3 bucket website',
          Value: { 'Fn::GetAtt': ['StacksBucket', 'WebsiteURL'] },
        },
      },
    }

    // Add email infrastructure if email server is enabled
    if (enableEmailServer) {
      log.info('Adding email server infrastructure...')

      // Email storage bucket
      template.Resources.EmailBucket = {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: emailBucketName,
          LifecycleConfiguration: {
            Rules: [
              {
                Id: 'ArchiveOldEmails',
                Status: 'Enabled',
                Transitions: [
                  {
                    StorageClass: 'GLACIER',
                    TransitionInDays: 90,
                  },
                ],
              },
            ],
          },
          Tags: [
            { Key: 'Purpose', Value: 'EmailStorage' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // S3 bucket policy to allow SES to write emails
      template.Resources.EmailBucketPolicy = {
        Type: 'AWS::S3::BucketPolicy',
        Properties: {
          Bucket: { Ref: 'EmailBucket' },
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'AllowSESPuts',
                Effect: 'Allow',
                Principal: {
                  Service: 'ses.amazonaws.com',
                },
                Action: 's3:PutObject',
                Resource: { 'Fn::Sub': 'arn:aws:s3:::${EmailBucket}/*' },
                Condition: {
                  StringEquals: {
                    'AWS:SourceAccount': { Ref: 'AWS::AccountId' },
                  },
                },
              },
            ],
          },
        },
      }

      // SES Domain Identity
      template.Resources.EmailIdentity = {
        Type: 'AWS::SES::EmailIdentity',
        Properties: {
          EmailIdentity: emailDomain,
          DkimSigningAttributes: {
            NextSigningKeyLength: 'RSA_2048_BIT',
          },
          FeedbackAttributes: {
            EmailForwardingEnabled: true,
          },
        },
      }

      // SES Configuration Set
      template.Resources.EmailConfigurationSet = {
        Type: 'AWS::SES::ConfigurationSet',
        Properties: {
          Name: `${appName}-email-config`,
          ReputationOptions: {
            ReputationMetricsEnabled: true,
          },
          SendingOptions: {
            SendingEnabled: true,
          },
          SuppressionOptions: {
            SuppressedReasons: ['BOUNCE', 'COMPLAINT'],
          },
        },
      }

      // IAM Role for Email Lambda functions
      template.Resources.EmailLambdaRole = {
        Type: 'AWS::IAM::Role',
        Properties: {
          RoleName: `${appName}-email-lambda-role`,
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: 'lambda.amazonaws.com',
                },
                Action: 'sts:AssumeRole',
              },
            ],
          },
          ManagedPolicyArns: [
            'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
          Policies: [
            {
              PolicyName: 'EmailLambdaPolicy',
              PolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Action: [
                      's3:GetObject',
                      's3:PutObject',
                      's3:DeleteObject',
                      's3:ListBucket',
                    ],
                    Resource: [
                      { 'Fn::GetAtt': ['EmailBucket', 'Arn'] },
                      { 'Fn::Sub': '${EmailBucket.Arn}/*' },
                    ],
                  },
                  {
                    Effect: 'Allow',
                    Action: [
                      'ses:SendEmail',
                      'ses:SendRawEmail',
                    ],
                    Resource: '*',
                  },
                ],
              },
            },
          ],
          Tags: [
            { Key: 'Purpose', Value: 'EmailProcessing' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Inbound Email Lambda Function
      template.Resources.InboundEmailLambda = {
        Type: 'AWS::Lambda::Function',
        DependsOn: ['EmailLambdaRole'],
        Properties: {
          FunctionName: `${appName}-inbound-email`,
          Runtime: 'nodejs20.x',
          Handler: 'index.handler',
          Role: { 'Fn::GetAtt': ['EmailLambdaRole', 'Arn'] },
          Timeout: 60,
          MemorySize: 512,
          Environment: {
            Variables: {
              S3_BUCKET: emailBucketName,
              ORGANIZED_PREFIX: 'organized/',
            },
          },
          Code: {
            ZipFile: `
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({});

exports.handler = async (event) => {
  console.log('Processing inbound email:', JSON.stringify(event));
  const bucket = process.env.S3_BUCKET;
  const organizedPrefix = process.env.ORGANIZED_PREFIX || 'organized/';

  for (const record of event.Records || []) {
    if (!record.ses) continue;
    const mail = record.ses.mail;
    const from = mail.commonHeaders?.from?.[0] || mail.source || 'unknown';
    const to = mail.commonHeaders?.to || mail.destination || [];
    const subject = mail.commonHeaders?.subject || 'No Subject';
    const date = mail.timestamp || new Date().toISOString();
    const dateFolder = date.slice(0, 10).replace(/-/g, '/');

    for (const recipient of to) {
      const recipientEmail = recipient.replace(/<|>/g, '').toLowerCase().trim();
      const organizedKey = organizedPrefix + 'by-recipient/' + recipientEmail + '/' + dateFolder + '/' + mail.messageId + '.json';
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: organizedKey,
        Body: JSON.stringify({ from, to: recipientEmail, subject, date, messageId: mail.messageId }, null, 2),
        ContentType: 'application/json'
      }));
    }
    console.log('Organized email from ' + from + ' to ' + to.join(', ') + ': ' + subject);
  }
  return { statusCode: 200, body: 'Emails organized successfully' };
};
`,
          },
          Tags: [
            { Key: 'Purpose', Value: 'InboundEmail' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Lambda permission for SES to invoke
      template.Resources.InboundEmailLambdaPermission = {
        Type: 'AWS::Lambda::Permission',
        Properties: {
          FunctionName: { Ref: 'InboundEmailLambda' },
          Action: 'lambda:InvokeFunction',
          Principal: 'ses.amazonaws.com',
          SourceAccount: { Ref: 'AWS::AccountId' },
        },
      }

      // SES Receipt Rule Set
      template.Resources.EmailReceiptRuleSet = {
        Type: 'AWS::SES::ReceiptRuleSet',
        Properties: {
          RuleSetName: `${appName}-email-rules`,
        },
      }

      // SES Receipt Rule for inbound emails
      template.Resources.EmailReceiptRule = {
        Type: 'AWS::SES::ReceiptRule',
        DependsOn: ['EmailReceiptRuleSet', 'InboundEmailLambda', 'EmailBucket', 'EmailBucketPolicy'],
        Properties: {
          RuleSetName: { Ref: 'EmailReceiptRuleSet' },
          Rule: {
            Name: `${appName}-inbound-rule`,
            Enabled: true,
            ScanEnabled: emailConfig?.server?.scan || true,
            Recipients: [emailDomain],
            Actions: [
              {
                S3Action: {
                  BucketName: { Ref: 'EmailBucket' },
                  ObjectKeyPrefix: 'inbound/',
                },
              },
              {
                LambdaAction: {
                  FunctionArn: { 'Fn::GetAtt': ['InboundEmailLambda', 'Arn'] },
                  InvocationType: 'Event',
                },
              },
            ],
          },
        },
      }

      // Outbound Email Lambda Function
      template.Resources.OutboundEmailLambda = {
        Type: 'AWS::Lambda::Function',
        DependsOn: ['EmailLambdaRole'],
        Properties: {
          FunctionName: `${appName}-outbound-email`,
          Runtime: 'nodejs20.x',
          Handler: 'index.handler',
          Role: { 'Fn::GetAtt': ['EmailLambdaRole', 'Arn'] },
          Timeout: 30,
          MemorySize: 256,
          Environment: {
            Variables: {
              DOMAIN: emailDomain,
              CONFIGURATION_SET: `${appName}-email-config`,
            },
          },
          Code: {
            ZipFile: `
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const ses = new SESClient({});

exports.handler = async (event) => {
  console.log('Processing outbound email:', JSON.stringify(event));
  const { to, from, subject, html, text, cc, bcc, replyTo, attachments = [] } = event;
  const domain = process.env.DOMAIN;
  const configSet = process.env.CONFIGURATION_SET;

  const boundary = 'NextPart_' + Date.now().toString(16);
  const fromAddress = from || 'noreply@' + domain;

  let rawEmail = '';
  rawEmail += 'From: ' + fromAddress + '\\r\\n';
  rawEmail += 'To: ' + (Array.isArray(to) ? to.join(', ') : to) + '\\r\\n';
  if (cc) rawEmail += 'Cc: ' + (Array.isArray(cc) ? cc.join(', ') : cc) + '\\r\\n';
  if (bcc) rawEmail += 'Bcc: ' + (Array.isArray(bcc) ? bcc.join(', ') : bcc) + '\\r\\n';
  if (replyTo) rawEmail += 'Reply-To: ' + replyTo + '\\r\\n';
  rawEmail += 'Subject: ' + subject + '\\r\\n';
  rawEmail += 'MIME-Version: 1.0\\r\\n';
  rawEmail += 'Content-Type: multipart/mixed; boundary="' + boundary + '"\\r\\n\\r\\n';

  rawEmail += '--' + boundary + '\\r\\n';
  rawEmail += 'Content-Type: multipart/alternative; boundary="alt_boundary"\\r\\n\\r\\n';

  if (text) {
    rawEmail += '--alt_boundary\\r\\n';
    rawEmail += 'Content-Type: text/plain; charset=UTF-8\\r\\n\\r\\n';
    rawEmail += text + '\\r\\n\\r\\n';
  }
  if (html) {
    rawEmail += '--alt_boundary\\r\\n';
    rawEmail += 'Content-Type: text/html; charset=UTF-8\\r\\n\\r\\n';
    rawEmail += html + '\\r\\n\\r\\n';
  }
  rawEmail += '--alt_boundary--\\r\\n';

  for (const att of attachments) {
    rawEmail += '--' + boundary + '\\r\\n';
    rawEmail += 'Content-Type: ' + (att.contentType || 'application/octet-stream') + '; name="' + att.filename + '"\\r\\n';
    rawEmail += 'Content-Transfer-Encoding: base64\\r\\n';
    rawEmail += 'Content-Disposition: attachment; filename="' + att.filename + '"\\r\\n\\r\\n';
    rawEmail += att.content + '\\r\\n';
  }
  rawEmail += '--' + boundary + '--\\r\\n';

  const params = {
    RawMessage: { Data: Buffer.from(rawEmail) },
    Source: fromAddress,
    Destinations: [...(Array.isArray(to) ? to : [to]), ...(cc ? (Array.isArray(cc) ? cc : [cc]) : []), ...(bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [])]
  };
  if (configSet) params.ConfigurationSetName = configSet;

  const result = await ses.send(new SendRawEmailCommand(params));
  return { statusCode: 200, body: JSON.stringify({ messageId: result.MessageId }) };
};
`,
          },
          Tags: [
            { Key: 'Purpose', Value: 'OutboundEmail' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Email Conversion Lambda Function
      template.Resources.EmailConversionLambda = {
        Type: 'AWS::Lambda::Function',
        DependsOn: ['EmailLambdaRole'],
        Properties: {
          FunctionName: `${appName}-email-conversion`,
          Runtime: 'nodejs20.x',
          Handler: 'index.handler',
          Role: { 'Fn::GetAtt': ['EmailLambdaRole', 'Arn'] },
          Timeout: 60,
          MemorySize: 512,
          Environment: {
            Variables: {
              S3_BUCKET: emailBucketName,
              CONVERTED_PREFIX: 'converted/',
            },
          },
          Code: {
            ZipFile: `
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({});

exports.handler = async (event) => {
  console.log('Converting email:', JSON.stringify(event));
  const bucket = process.env.S3_BUCKET;
  const convertedPrefix = process.env.CONVERTED_PREFIX || 'converted/';

  for (const record of event.Records || []) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\\+/g, ' '));
    if (!key.startsWith('inbound/')) continue;

    const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(getCmd);
    const rawEmail = await response.Body.transformToString();

    // Simple email parsing (headers + body)
    const [headerSection, ...bodyParts] = rawEmail.split('\\r\\n\\r\\n');
    const body = bodyParts.join('\\r\\n\\r\\n');
    const headers = {};
    for (const line of headerSection.split('\\r\\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const name = line.slice(0, colonIdx).toLowerCase();
        headers[name] = line.slice(colonIdx + 1).trim();
      }
    }

    const metadata = {
      from: headers.from || '',
      to: headers.to || '',
      subject: headers.subject || '',
      date: headers.date || new Date().toISOString(),
      contentType: headers['content-type'] || 'text/plain',
    };

    const baseName = key.replace('inbound/', '').replace(/\\.[^.]+$/, '');
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: convertedPrefix + baseName + '.json',
      Body: JSON.stringify(metadata, null, 2),
      ContentType: 'application/json'
    }));

    if (body) {
      const isHtml = metadata.contentType.includes('html');
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: convertedPrefix + baseName + (isHtml ? '.html' : '.txt'),
        Body: body,
        ContentType: isHtml ? 'text/html' : 'text/plain'
      }));
    }
    console.log('Converted email:', key);
  }
  return { statusCode: 200, body: 'Emails converted' };
};
`,
          },
          Tags: [
            { Key: 'Purpose', Value: 'EmailConversion' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // S3 trigger for email conversion Lambda
      template.Resources.EmailConversionLambdaPermission = {
        Type: 'AWS::Lambda::Permission',
        Properties: {
          FunctionName: { Ref: 'EmailConversionLambda' },
          Action: 'lambda:InvokeFunction',
          Principal: 's3.amazonaws.com',
          SourceArn: { 'Fn::GetAtt': ['EmailBucket', 'Arn'] },
          SourceAccount: { Ref: 'AWS::AccountId' },
        },
      }

      // SNS Topic for email notifications
      template.Resources.EmailNotificationTopic = {
        Type: 'AWS::SNS::Topic',
        Properties: {
          TopicName: `${appName}-email-notifications`,
          DisplayName: `${appName} Email Notifications`,
          Tags: [
            { Key: 'Purpose', Value: 'EmailNotifications' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Add email outputs
      template.Outputs.EmailBucketName = {
        Description: 'Name of the email storage bucket',
        Value: { Ref: 'EmailBucket' },
      }
      template.Outputs.EmailDomain = {
        Description: 'Email domain configured',
        Value: emailDomain,
      }
      template.Outputs.EmailRuleSetName = {
        Description: 'SES Receipt Rule Set name',
        Value: { Ref: 'EmailReceiptRuleSet' },
      }
      template.Outputs.OutboundEmailLambdaArn = {
        Description: 'Outbound email Lambda ARN',
        Value: { 'Fn::GetAtt': ['OutboundEmailLambda', 'Arn'] },
      }
      template.Outputs.EmailNotificationTopicArn = {
        Description: 'Email notification SNS topic ARN',
        Value: { Ref: 'EmailNotificationTopic' },
      }

      log.success('Email infrastructure added to template')
    }

    try {
      if (stackExists && needsEmailUpdate) {
        // Update existing stack with email infrastructure
        log.info('Updating stack with email infrastructure...')
        const result = await cfnClient.updateStack({
          stackName,
          templateBody: JSON.stringify(template),
          capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
          tags: [
            { Key: 'Environment', Value: process.env.APP_ENV || 'production' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        })

        log.info(`Stack update initiated: ${result.StackId}`)
        log.info('Waiting for stack update to complete...')

        // Wait for stack update to complete
        await cfnClient.waitForStack(stackName, 'stack-update-complete')

        log.success('Cloud infrastructure updated with email server!')
        return true
      }
      else {
        // Create new stack
        const result = await cfnClient.createStack({
          stackName,
          templateBody: JSON.stringify(template),
          capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
          tags: [
            { Key: 'Environment', Value: process.env.APP_ENV || 'production' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        })

        log.info(`Stack creation initiated: ${result.StackId}`)
        log.info('Waiting for stack creation to complete...')

        // Wait for stack creation to complete
        await cfnClient.waitForStack(stackName, 'stack-create-complete')

        log.success('Cloud infrastructure created successfully')
        return true
      }
    }
    catch (error: any) {
      // Handle case where stack already exists (shouldn't happen now with our check)
      if (error.code === 'AlreadyExistsException') {
        handlingAlreadyExists = true
        console.log('')
        log.error(`A cloud stack named "${stackName}" already exists`)
        log.info('This stack may be from a previous incomplete deployment.')
        console.log('')
        log.info('To resolve this, run one of the following commands:')
        console.log('')
        log.info('  buddy cloud:cleanup           # Clean up all cloud resources')
        log.info('  buddy cloud:remove            # Remove the entire cloud stack')
        console.log('')
        log.info('Or manually delete it in the AWS Console:')
        log.info('  https://console.aws.amazon.com/cloudformation')
        console.log('')
        process.exit(ExitCode.FatalError)
      }

      // Handle no updates needed
      if (error.message?.includes('No updates are to be performed')) {
        log.success('Stack is already up to date')
        return true
      }

      // Handle other errors
      log.error('Failed to create/update cloud infrastructure')
      log.error(`Error: ${error.message || error}`)

      if (error.code) {
        log.error(`AWS Error Code: ${error.code}`)
      }

      if (options?.verbose) {
        console.error(error)
      }

      process.exit(ExitCode.FatalError)
    }
  }
  catch (err: any) {
    // Don't log error details if we're already handling AlreadyExistsException
    if (!handlingAlreadyExists) {
      log.error('Error checking cloud infrastructure')
      log.error(`Error: ${err.message || err}`)
      if (options?.verbose) {
        console.error(err)
      }
    }
    process.exit(ExitCode.FatalError)
  }
}
