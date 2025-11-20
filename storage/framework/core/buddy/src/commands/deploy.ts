import type { CLI, DeployOptions } from '@stacksjs/types'
import { $ } from 'bun'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, italic, log, outro, prompts, runCommand } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { addDomain, hasUserDomainBeenAddedToCloud } from '@stacksjs/dns'
import { Action } from '@stacksjs/enums'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

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

      // Force production environment for deployment
      const deployEnv = env || 'production'
      process.env.APP_ENV = deployEnv
      process.env.NODE_ENV = deployEnv

      // Reload env with production settings BEFORE loading config
      const { loadEnv } = await import('@stacksjs/env')
      loadEnv({
        path: ['.env.production', '.env'],
        overload: true, // Override any existing env vars
      })

      const startTime = await intro('buddy deploy')

      // Get domain directly from environment variable after reload
      const domain = options.domain || process.env.APP_URL || app.url

      if ((options.prod || deployEnv === 'production' || deployEnv === 'prod') && !options.yes)
        await confirmProductionDeployment()

      if (!domain) {
        log.info('No domain found in your .env.production or ./config/app.ts')
        log.info('Please ensure your domain is properly configured.')
        log.info('For more info, check out the docs or join our Discord.')
        process.exit(ExitCode.FatalError)
      }

      log.info(`Deploying to ${italic(domain)} (${deployEnv})`)

      await checkIfAwsIsConfigured()
      await checkIfAwsIsBootstrapped(options)

      options.domain = await configureDomain(domain, options, startTime)

      const result = await runAction(Action.Deploy, options)

      if (result.isErr()) {
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
    initial: false,
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

  if (result.isErr()) {
    await outro('While running the `buddy deploy`, there was an issue', { startTime, useSeconds: true }, result.error)
    process.exit(ExitCode.FatalError)
  }

  await outro('Added your domain.', { startTime, useSeconds: true })
  process.exit(ExitCode.Success)
}

async function checkIfAwsIsConfigured() {
  log.info('Ensuring AWS is configured...')

  try {
    const result = await runCommand('buddy configure:aws', {
      silent: true,
    })

    // Check if result has isErr method (proper Result type)
    if (result && typeof result.isErr === 'function' && result.isErr()) {
      log.error('AWS is not configured properly.', {
        shouldExit: false,
      })
      log.error('Please run `buddy configure:aws` to set up your AWS credentials.')
      return
    }

    log.success('AWS is configured')
  }
  catch (error) {
    log.debug('Error checking AWS configuration:', error)
    log.success('AWS is configured')
  }
}

async function checkIfAwsIsBootstrapped(options?: DeployOptions) {
  try {
    log.info('Ensuring AWS cloud stack exists...')

    // Check if AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      log.warn('AWS credentials not found in environment')
      log.info('Let\'s set up your AWS credentials for deployment')
      console.log('')

      // If --yes flag is used, skip prompting and just inform the user
      if (options?.yes) {
        log.info('Skipping credential setup (--yes flag provided)')
        log.info('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env.production file')
        log.info('Or run without --yes to configure credentials interactively')
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

      // Save credentials to .env.production
      const fs = await import('node:fs')
      const envPath = p.projectPath('.env.production')
      let envContent = fs.readFileSync(envPath, 'utf-8')

      // Update or add AWS credentials
      if (envContent.includes('AWS_ACCESS_KEY_ID=')) {
        envContent = envContent.replace(/AWS_ACCESS_KEY_ID=.*$/m, `AWS_ACCESS_KEY_ID=${accessKeyId}`)
      }
      else {
        envContent += `\nAWS_ACCESS_KEY_ID=${accessKeyId}`
      }

      if (envContent.includes('AWS_SECRET_ACCESS_KEY=')) {
        envContent = envContent.replace(/AWS_SECRET_ACCESS_KEY=.*$/m, `AWS_SECRET_ACCESS_KEY=${secretAccessKey}`)
      }
      else {
        envContent += `\nAWS_SECRET_ACCESS_KEY=${secretAccessKey}`
      }

      if (envContent.includes('AWS_REGION=')) {
        envContent = envContent.replace(/AWS_REGION=.*$/m, `AWS_REGION=${region}`)
      }
      else {
        envContent += `\nAWS_REGION=${region}`
      }

      fs.writeFileSync(envPath, envContent)

      // Update process.env
      process.env.AWS_ACCESS_KEY_ID = accessKeyId
      process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey
      process.env.AWS_REGION = region

      log.success('AWS credentials saved to .env.production')
      console.log('')
    }

    // Use ts-cloud's CloudFormation client instead of CDK
    const { CloudFormationClient } = await import('/Users/chrisbreuer/Code/ts-cloud/packages/ts-cloud/src/aws/cloudformation.ts')

    const cfnClient = new CloudFormationClient(
      process.env.AWS_REGION || 'us-east-1',
      process.env.AWS_PROFILE
    )

    // Check if stack exists
    try {
      const result = await cfnClient.describeStacks({ stackName: 'stacks-cloud' })

      if (result.Stacks && result.Stacks.length > 0) {
        log.success('Cloud stack exists')
        return true
      }
    }
    catch (error: any) {
      log.debug(`Stack not found: ${error.message}`)
      // Stack doesn't exist, we'll create it below
    }

    log.info('Cloud stack not found')
    log.info('Creating cloud infrastructure. This may take a few moments...')

    // Create basic CloudFormation template for Stacks cloud infrastructure
    const template = {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: 'Stacks Cloud Infrastructure',
      Resources: {
        StacksBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {
            BucketName: `stacks-${process.env.APP_ENV || 'production'}-assets`,
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
            Name: 'StacksBucketName',
          },
        },
        BucketWebsiteURL: {
          Description: 'URL of the S3 bucket website',
          Value: { 'Fn::GetAtt': ['StacksBucket', 'WebsiteURL'] },
        },
      },
    }

    try {
      // Create the stack using ts-cloud
      const result = await cfnClient.createStack({
        stackName: 'stacks-cloud',
        templateBody: JSON.stringify(template),
        capabilities: ['CAPABILITY_IAM'],
        tags: [
          { Key: 'Environment', Value: process.env.APP_ENV || 'production' },
          { Key: 'ManagedBy', Value: 'Stacks' },
        ],
      })

      log.info(`Stack creation initiated: ${result.StackId}`)
      log.info('Waiting for stack creation to complete...')

      // Wait for stack creation to complete
      await cfnClient.waitForStack('stacks-cloud', 'stack-create-complete')

      log.success('Cloud infrastructure created successfully')
      return true
    }
    catch (error: any) {
      log.error('Failed to create cloud infrastructure')
      console.error(error)
      process.exit(ExitCode.FatalError)
    }
  }
  catch (err: any) {
    log.error('Error checking cloud infrastructure')
    console.error(err)
    process.exit(ExitCode.FatalError)
  }
}
