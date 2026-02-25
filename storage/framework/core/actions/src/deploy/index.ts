import type { Subprocess } from '@stacksjs/types'
import process from 'node:process'
import { runCommand, spinner } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { storage } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

// Use console.log for clean output
const log = {
  debug: (...args: any[]) => {
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
      console.log('🔍', ...args)
    }
  },
  success: (...args: any[]) => console.log('✓', ...args),
  error: (...args: any[]) => console.error('✗', ...args),
}

// Check if verbose mode is enabled via CLI args
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
}

function getMimeType(filePath: string): string {
  const dotIndex = filePath.lastIndexOf('.')
  const ext = dotIndex >= 0 ? filePath.slice(dotIndex).toLowerCase() : ''
  return MIME_TYPES[ext] || 'application/octet-stream'
}

async function traverseDirectory(
  dir: string,
  callback: (filePath: string, relativePath: string) => Promise<void>,
  prefix = '',
  skipPatterns = ['.DS_Store'],
): Promise<void> {
  const { readdirSync, statSync } = await import('node:fs')
  const { join } = await import('node:path')
  const items = readdirSync(dir)
  for (const item of items) {
    if (skipPatterns.includes(item)) continue
    const filePath = join(dir, item)
    const key = prefix ? `${prefix}/${item}` : item
    if (statSync(filePath).isDirectory()) {
      await traverseDirectory(filePath, callback, key, skipPatterns)
    } else {
      await callback(filePath, key)
    }
  }
}

/**
 * Get the STX signals client-side runtime script.
 * Dynamically imports from the stx package to get the full signals runtime
 * with state(), derived(), effect(), @model, @show, @text, @class, :bind, @event support.
 */
async function getSignalsRuntime(): Promise<string> {
  try {
    const { generateSignalsRuntime } = await import(
      /* @vite-ignore */ '/Users/chrisbreuer/Code/Tools/stx/packages/stx/src/signals.ts'
    )
    return `<script>\n${generateSignalsRuntime()}\n</script>`
  } catch (e) {
    if (isVerbose) log.debug('Failed to import signals runtime from stx, using fallback path')
    try {
      // Fallback: try from node_modules
      const { generateSignalsRuntime } = await import(
        /* @vite-ignore */ '@stacksjs/stx/signals'
      )
      return `<script>\n${generateSignalsRuntime()}\n</script>`
    } catch {
      console.warn('Could not load STX signals runtime')
      return ''
    }
  }
}

async function withS3Retry<T>(fn: () => Promise<T>, label = 's3 operation'): Promise<T> {
  const maxRetries = 3
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      if (attempt >= maxRetries) throw error
      const delay = Math.min(500 * 2 ** attempt + Math.random() * 200, 5000)
      if (isVerbose) log.debug(`  Retrying ${label} (attempt ${attempt + 2}/${maxRetries + 1}) in ${Math.round(delay)}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error(`${label} failed after ${maxRetries + 1} attempts`) // unreachable but satisfies TS
}

// Build framework - show output so user knows it's working
// Temporarily skip framework build due to bun workspace issue
// Framework was already built in previous deployment
log.debug('Skipping framework build (already built)...')
// await runCommand('bun run build', {
//   cwd: p.frameworkPath(),
//   quiet: false,  // Always show build output so it doesn't appear stuck
// })
log.success('Framework build skipped')

// Build documentation with BunPress
// Skip if docs directory doesn't exist or if pre-built docs exist
const docsDir = p.projectPath('docs')
const docsDistExists = storage.hasFiles(p.projectPath('dist/docs/.bunpress'))
if (storage.hasFiles(docsDir) && !docsDistExists) {
  const docsSpinner = spinner('Building documentation with BunPress...')
  docsSpinner.start()
  try {
    // Try to run bunpress from node_modules/.bin or linked package
    // Note: bunpress outputs to .bunpress subdirectory within outdir
    await runCommand('bunx @stacksjs/bunpress build --dir ./docs --outdir ./dist/docs', {
      cwd: p.projectPath(),
      quiet: !isVerbose,
    })
    docsSpinner.succeed('Documentation built with BunPress')
  } catch (docsError: any) {
    // BunPress might not be installed - skip gracefully
    docsSpinner.stop()
    console.log(`⚠ Documentation build skipped: ${docsError.message}`)
    if (isVerbose) log.debug('To build docs manually: cd ~/Code/bunpress && bun bin/cli.ts build --dir /path/to/docs --outdir /path/to/dist/docs')
  }
} else if (docsDistExists) {
  if (isVerbose) log.debug('Pre-built docs found at dist/docs/.bunpress, skipping build')
} else {
  if (isVerbose) log.debug('No docs directory found, skipping documentation build')
}

// Build blog static site
const blogDistExists = storage.hasFiles(p.projectPath('dist/blog'))
if (!blogDistExists) {
  const blogBuildSpinner = spinner('Building blog...')
  blogBuildSpinner.start()
  try {
    const blogConfig = (await import(p.projectPath('config/blog'))).default
    const { buildBlogSite } = await import(p.frameworkPath('core/cms/src/build'))
    await buildBlogSite({ config: blogConfig, outDir: p.projectPath('dist/blog') })
    blogBuildSpinner.succeed('Blog built successfully')
  } catch (blogBuildError: any) {
    blogBuildSpinner.stop()
    console.log(`⚠ Blog build skipped: ${blogBuildError.message}`)
    if (isVerbose) log.debug(`Blog build error: ${blogBuildError.stack}`)
  }
} else {
  if (isVerbose) log.debug('Pre-built blog found at dist/blog, skipping build')
}

// Skip views build for now - vite-config is not set up
// TODO: Set up vite-config for views build
// if (config.app.docMode !== true) {
//   const viewsSpinner = spinner('Building views...')
//   viewsSpinner.start()
//   await runCommand('bun run build', {
//     cwd: p.frameworkPath('views/web'),
//     quiet: !isVerbose,
//   })
//   viewsSpinner.succeed('Views built')
// }
if (isVerbose) log.debug('Skipping views build (vite-config not configured)')

// await runCommand('bun run build-edge', {
//   cwd: p.corePath('cloud'),
// })

// Check deployment mode early to skip unnecessary build steps
const earlyCloudConfig = await import(p.projectPath('config/cloud'))
const earlyDeploymentMode = earlyCloudConfig?.tsCloud?.mode || 'server'

// Build server and package (only needed for serverless/container mode)
if (earlyDeploymentMode === 'serverless') {
  const serverSpinner = spinner('Building server...')
  serverSpinner.start()
  await runCommand('bun build.ts', {
    cwd: p.frameworkPath('server'),
    quiet: !isVerbose,
  })
  serverSpinner.succeed('Server built')

  const packageSpinner = spinner('Packaging for deployment...')
  packageSpinner.start()
  await runCommand('bun zip.ts', {
    cwd: p.corePath('cloud'),
    quiet: !isVerbose,
  })
  packageSpinner.succeed('Package ready')
} else {
  if (isVerbose) log.debug('Skipping server build and packaging (server mode)')
}

// Load AWS credentials from environment-specific .env file if not already set
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  const { existsSync, readFileSync } = await import('node:fs')
  const environment = process.env.APP_ENV || process.env.NODE_ENV || 'production'

  // Try environment-specific file first (e.g., .env.staging, .env.production)
  const envFiles = [
    p.projectPath(`.env.${environment}`),
    p.projectPath('.env'),
  ]

  for (const envPath of envFiles) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue
        const eqIndex = trimmed.indexOf('=')
        const key = trimmed.slice(0, eqIndex).trim()
        let value = trimmed.slice(eqIndex + 1).trim()
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (key === 'AWS_ACCESS_KEY_ID' && value) process.env.AWS_ACCESS_KEY_ID = value
        else if (key === 'AWS_SECRET_ACCESS_KEY' && value) process.env.AWS_SECRET_ACCESS_KEY = value
        else if (key === 'AWS_REGION' && value && !process.env.AWS_REGION) process.env.AWS_REGION = value
        else if (key === 'AWS_ACCOUNT_ID' && value && !process.env.AWS_ACCOUNT_ID) process.env.AWS_ACCOUNT_ID = value
      }
      if (isVerbose) log.debug(`Loaded AWS credentials from ${envPath}`)
      break // Stop after loading the first existing file
    }
  }
}

// Use ts-cloud deployment instead of CDK
try {
  const { deployStack, deployFrontend: _deployFrontend } = await import('../../deploy')

  const environment = process.env.APP_ENV || process.env.NODE_ENV || 'production'
  const region = process.env.AWS_REGION || 'us-east-1'

  // Check deployment mode - use relative import from project root
  const cloudConfigModule = await import(p.projectPath('config/cloud'))
  const deploymentMode = cloudConfigModule?.tsCloud?.mode || 'server'
  const projectName = cloudConfigModule?.tsCloud?.project?.name || cloudConfigModule?.tsCloud?.project?.slug || 'stacks'

  // For serverless mode, build and push container image before deploying infrastructure
  if (deploymentMode === 'serverless') {
    console.log('')
    console.log('Serverless deployment mode detected')
    console.log('Building and pushing container image...')
    console.log('')

    // Get AWS account ID for ECR
    const accountId = process.env.AWS_ACCOUNT_ID || await getAwsAccountId(region)

    // Validate account ID before proceeding
    if (!accountId || accountId.length < 10) {
      throw new Error(
        `Invalid AWS Account ID: "${accountId || '(empty)'}"\n` +
        `Set AWS_ACCOUNT_ID in your .env file or ensure valid AWS credentials are configured.`
      )
    }

    const ecrRepository = `${accountId}.dkr.ecr.${region}.amazonaws.com/${projectName}-${environment}-api`
    const imageTag = `${ecrRepository}:latest`

    if (isVerbose) log.debug(`ECR repository: ${ecrRepository}`)

    // Step 1: Verify ECR credentials (actual login happens before push)
    if (isVerbose) log.debug('ECR credentials will be validated before push...')

    // Step 2: Build Docker image
    const buildSpinner = spinner('Building Docker image...')
    buildSpinner.start()

    try {
      const { exec } = await import('node:child_process')
      const { promisify } = await import('node:util')
      const execAsync = promisify(exec)

      const buildCmd = `docker build --platform linux/amd64 -t ${imageTag} -f Dockerfile .`
      const { stdout, stderr } = await execAsync(buildCmd, {
        cwd: p.projectPath(),
        env: process.env,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer for Docker output
        timeout: 15 * 60 * 1000, // 15 minute timeout for Docker build
      })
      if (isVerbose && stdout) log.debug(stdout)
      if (isVerbose && stderr) log.debug(stderr)
      buildSpinner.succeed(`Docker image built: ${imageTag}`)
    } catch (error: any) {
      buildSpinner.fail('Docker build failed')
      if (isVerbose) log.debug(`Docker build error: ${error.message}`)
      throw error
    }

    // Step 3: Ensure ECR repository exists (create if needed)
    const repoSpinner = spinner('Checking ECR repository...')
    repoSpinner.start()

    try {
      const { ECRClient } = await import('@stacksjs/ts-cloud') as any
      const ecr = new ECRClient(region)
      const repoName = `${projectName}-${environment}-api`

      // Check if repository exists
      try {
        await ecr.describeRepositories({ repositoryNames: [repoName] })
        repoSpinner.succeed(`ECR repository exists: ${repoName}`)
      } catch (err: any) {
        // Repository doesn't exist, create it
        if (err.code === 'RepositoryNotFoundException' || err.message?.includes('RepositoryNotFoundException')) {
          repoSpinner.text = `Creating ECR repository: ${repoName}...`
          await ecr.createRepository({
            repositoryName: repoName,
            imageScanningConfiguration: { scanOnPush: true },
            imageTagMutability: 'MUTABLE',
          })
          repoSpinner.succeed(`ECR repository created: ${repoName}`)
        } else {
          throw err
        }
      }
    } catch (error: any) {
      repoSpinner.fail('ECR repository check failed')
      if (isVerbose) log.debug(`ECR repository error: ${error.message}`)
      throw error
    }

    // Step 4: Re-authenticate to ECR immediately before push
    const authSpinner = spinner('Authenticating to ECR...')
    authSpinner.start()

    try {
      const { ECRClient } = await import('@stacksjs/ts-cloud') as any
      const ecr = new ECRClient(region)

      // Get ECR authorization token
      const authData = await ecr.getAuthorizationToken()
      const token = authData.authorizationData?.[0]

      if (!token?.authorizationToken) {
        throw new Error('No authorization token received from ECR')
      }

      // Decode base64 token (format: AWS:password)
      const decoded = Buffer.from(token.authorizationToken, 'base64').toString('utf-8')
      const password = decoded.split(':')[1]

      // Login to Docker using stdin for password (secure)
      const loginResult = Bun.spawnSync([
        'docker',
        'login',
        '--username',
        'AWS',
        '--password-stdin',
        `${accountId}.dkr.ecr.${region}.amazonaws.com`,
      ], {
        stdin: new TextEncoder().encode(password),
        stdout: 'pipe',
        stderr: 'pipe',
      })

      if (loginResult.exitCode !== 0) {
        const loginError = new TextDecoder().decode(loginResult.stderr)
        throw new Error(`Docker login failed: ${loginError}`)
      }

      authSpinner.succeed('Authenticated to ECR')
    } catch (error: any) {
      authSpinner.fail('ECR authentication failed')
      if (isVerbose) log.debug(`ECR auth error: ${error.message}`)
      throw error
    }

    // Step 5: Push Docker image to ECR
    console.log('')
    const pushSpinner = spinner('Pushing image to ECR...')
    pushSpinner.start()

    try {
      const { exec } = await import('node:child_process')
      const { promisify } = await import('node:util')
      const execAsync = promisify(exec)

      const pushCmd = `docker push ${imageTag}`
      await execAsync(pushCmd, { env: process.env })
      pushSpinner.succeed(`Image pushed: ${imageTag}`)
    } catch (error: any) {
      pushSpinner.fail('Docker push failed')
      if (isVerbose) log.debug(`Push error: ${error.message}`)
      throw error
    }

    console.log('')
    console.log('Container image ready in ECR. CloudFormation will use this image.')
    console.log('')
  } else {
    console.log('')
    console.log('Server deployment mode detected')
    console.log('Deploying EC2 infrastructure via CloudFormation...')
    console.log('')
  }

  // Helper function to get AWS account ID using ts-cloud SDK
  async function getAwsAccountId(region: string): Promise<string> {
    try {
      const { STSClient } = await import('@stacksjs/ts-cloud') as any
      const sts = new STSClient(region)
      const identity = await sts.getCallerIdentity()
      const accountId = identity.Account || process.env.AWS_ACCOUNT_ID || ''
      if (isVerbose) log.debug(`Retrieved AWS Account ID: ${accountId || '(empty)'}`)
      return accountId
    } catch (error: any) {
      if (isVerbose) log.debug(`Failed to get AWS Account ID: ${error.message}`)
      // Fallback to environment variable
      return process.env.AWS_ACCOUNT_ID || ''
    }
  }

  // Run custom deploy script: beforeDeploy hook
  try {
    const deployScript = await import(p.projectPath('cloud/deploy-script'))
    if (typeof deployScript.beforeDeploy === 'function') {
      await deployScript.beforeDeploy({ environment, region })
    }
  } catch (hookError: any) {
    // Only skip silently if the deploy-script module doesn't exist
    if (hookError.code === 'ERR_MODULE_NOT_FOUND' || hookError.code === 'MODULE_NOT_FOUND') {
      if (isVerbose) log.debug('No beforeDeploy hook found (cloud/deploy-script not found)')
    } else {
      console.warn(`⚠ beforeDeploy hook failed: ${hookError.message}`)
      if (isVerbose) log.debug(`beforeDeploy error stack: ${hookError.stack}`)
    }
  }

  // Deploy infrastructure stack
  // Note: For serverless mode, the Docker image is already pushed to ECR above
  // Note: deployStack outputs its own progress table, so we don't use a spinner here
  await deployStack({
    environment,
    region,
    waitForCompletion: true,
    verbose: isVerbose,
  })

  // Run custom deploy script: afterDeploy hook
  try {
    const deployScript = await import(p.projectPath('cloud/deploy-script'))
    if (typeof deployScript.afterDeploy === 'function') {
      const { CloudFormationClient } = await import('@stacksjs/ts-cloud') as any
      const cf = new CloudFormationClient(region)
      const stackName = `${projectName}-cloud`
      let stackOutputs: Record<string, string> = {}
      try {
        stackOutputs = await cf.getStackOutputs(stackName)
      } catch (e) {
        if (isVerbose) log.debug(`Failed to get stack outputs: ${e instanceof Error ? e.message : String(e)}`)
      }
      await deployScript.afterDeploy({ environment, region, outputs: stackOutputs })
    }
  } catch (hookError: any) {
    if (hookError.code === 'ERR_MODULE_NOT_FOUND' || hookError.code === 'MODULE_NOT_FOUND') {
      if (isVerbose) log.debug('No afterDeploy hook found (cloud/deploy-script not found)')
    } else {
      console.warn(`⚠ afterDeploy hook failed: ${hookError.message}`)
      if (isVerbose) log.debug(`afterDeploy error stack: ${hookError.stack}`)
    }
  }

  // Run database migrations after infrastructure is deployed
  // This ensures the RDS database is available before we try to migrate
  const migrateSpinner = spinner('Running database migrations...')
  migrateSpinner.start()
  try {
    const { generateMigrations, runDatabaseMigration } = await import('@stacksjs/database')

    // Generate migrations from models
    await generateMigrations()

    // Execute migrations against the production database
    await runDatabaseMigration()

    migrateSpinner.succeed('Database migrations completed')
  } catch (migrationError: any) {
    // Don't fail the entire deployment if migrations fail
    // The database might not be accessible from the deploy machine
    migrateSpinner.stop()
    console.log(`⚠ Database migrations skipped: ${migrationError.message}`)
    if (isVerbose) log.debug(`Migration error: ${migrationError.stack}`)
  }

  if (deploymentMode === 'server') {
    // Server mode: show instance IPs from stack outputs
    const serverOutputSpinner = spinner('Retrieving server instance details...')
    serverOutputSpinner.start()

    try {
      const { CloudFormationClient } = await import('@stacksjs/ts-cloud') as any
      const cf = new CloudFormationClient(region)
      const stackName = `${projectName}-cloud`
      const outputs = await cf.getStackOutputs(stackName)

      serverOutputSpinner.succeed('Server instances deployed')
      console.log('')
      console.log('Server instances:')
      for (const [key, value] of Object.entries(outputs)) {
        if ((key as string).endsWith('PublicIp')) {
          console.log(`  ${key}: ${value}`)
        }
        if ((key as string).endsWith('InstanceId')) {
          console.log(`  ${key}: ${value}`)
        }
      }
      console.log('')
    } catch (outputError: any) {
      serverOutputSpinner.stop()
      console.log(`⚠ Could not retrieve server details: ${outputError.message}`)
      if (isVerbose) log.debug(`Output retrieval error: ${outputError.stack}`)
    }
  }

  // Deploy frontend to S3 (works for both server and serverless modes)
  const frontendSpinner = spinner('Deploying frontend to S3...')
  frontendSpinner.start()

  try {
    const { S3Client, CloudFormationClient } = await import('@stacksjs/ts-cloud') as any
    const { existsSync, readdirSync, statSync, readFileSync, copyFileSync, mkdirSync, rmSync, writeFileSync } = await import('node:fs')
    const { join, extname } = await import('node:path')

    const s3 = new S3Client(region)
    const cf = new CloudFormationClient(region)

    // Get bucket name from stack outputs
    const stackName = `${projectName}-cloud`
    const outputs = await cf.getStackOutputs(stackName)
    const bucketName = outputs.FrontendBucketName

    if (!bucketName) {
      frontendSpinner.stop()
      console.log('⚠ Frontend bucket not found in stack outputs (add storage.public to infrastructure config)')
    } else {
      // Build directory for frontend files
      const buildDir = p.storagePath('framework/frontend-dist')

      // Clean and create build directory
      if (existsSync(buildDir)) {
        rmSync(buildDir, { recursive: true })
      }
      mkdirSync(buildDir, { recursive: true })
      mkdirSync(join(buildDir, 'assets'), { recursive: true })

      // Build the frontend index.html from the STX template
      const indexPath = p.resourcesPath('views/index.stx')
      if (existsSync(indexPath)) {
        let stxContent = readFileSync(indexPath, 'utf-8')

        // Pre-render the STX template to static HTML
        // 1. Extract and evaluate <script server> block
        const serverBlockMatch = stxContent.match(/<script server>([\s\S]*?)<\/script>/)
        let serverVars: Record<string, any> = {}

        if (serverBlockMatch) {
          const serverCode = serverBlockMatch[1]

          try {
            // Evaluate the server block using new Function() to properly handle
            // backtick template literals, complex arrays, and nested objects
            const varNames = [...serverCode.matchAll(/(?:const|let|var)\s+(\w+)\s*=/g)].map(m => m[1])
            const evalFn = new Function(`${serverCode}\nreturn { ${varNames.join(', ')} }`)
            serverVars = evalFn()
          } catch (evalErr) {
            if (isVerbose) log.debug(`  Server block evaluation failed: ${evalErr}, falling back to regex`)
            // Fallback: extract simple const string/number assignments via regex
            const constMatches = serverCode.matchAll(/const\s+(\w+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([\d.]+))/g)
            for (const m of constMatches) {
              serverVars[m[1]] = m[2] ?? m[3] ?? m[4]
            }
          }

          // Remove the <script server> block from output
          stxContent = stxContent.replace(/<script server>[\s\S]*?<\/script>\s*/, '')
        }

        // 2. Replace {{ variable }} interpolations (simple top-level vars)
        stxContent = stxContent.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName) => {
          const val = serverVars[varName]
          return val !== undefined && val !== null ? String(val) : ''
        })

        // 3. Process @foreach blocks
        const foreachRegex = /@foreach\s*\((\w+)\s+as\s+(\w+)\)([\s\S]*?)@endforeach/g
        stxContent = stxContent.replace(foreachRegex, (_, collectionName, itemVar, template) => {
          const collection = serverVars[collectionName]
          if (!Array.isArray(collection) || collection.length === 0) return ''

          let rendered = ''
          for (const item of collection) {
            let itemHtml = template
            // Replace {{ item.prop }}
            itemHtml = itemHtml.replace(new RegExp(`\\{\\{\\s*${itemVar}\\.(\\w+)\\s*\\}\\}`, 'g'), (__, prop) => {
              const val = item[prop]
              return val !== undefined && val !== null ? String(val) : ''
            })
            // Replace {!! item.prop !!} (raw/unescaped HTML)
            itemHtml = itemHtml.replace(new RegExp(`\\{!!\\s*${itemVar}\\.(\\w+)\\s*!!\\}`, 'g'), (__, prop) => {
              const val = item[prop]
              return val !== undefined && val !== null ? String(val) : ''
            })
            rendered += itemHtml
          }
          return rendered
        })

        // Replace /api/email/subscribe with Lambda function URL if available
        const subscribeApiUrl = outputs.SubscribeApiUrl
        if (subscribeApiUrl && stxContent.includes('/api/email/subscribe')) {
          stxContent = stxContent.replace(/['"]\/api\/email\/subscribe['"]/g, `'${subscribeApiUrl}'`)
          if (isVerbose) log.debug(`  Replaced subscribe API URL with Lambda: ${subscribeApiUrl}`)
        }

        // Inject STX signals runtime if reactive directives are present
        // The runtime must load BEFORE any scope scripts that use state()/effect()
        if (/data-stx-scope|@model|@show|@text|@class|@style|@bind:|@if=|@for=/.test(stxContent)) {
          const signalsRuntime = await getSignalsRuntime()
          if (signalsRuntime) {
            // Inject right after <body> tag so it loads before scope scripts
            const bodyMatch = stxContent.match(/<body[^>]*>/)
            if (bodyMatch) {
              const insertPos = (stxContent.indexOf(bodyMatch[0]) ?? 0) + bodyMatch[0].length
              stxContent = stxContent.slice(0, insertPos) + '\n' + signalsRuntime + stxContent.slice(insertPos)
            } else {
              // No body tag found, prepend
              stxContent = signalsRuntime + '\n' + stxContent
            }
            if (isVerbose) log.debug('  Injected STX signals runtime for client-side reactivity')
          }
        }

        writeFileSync(join(buildDir, 'index.html'), stxContent)
        if (isVerbose) log.debug(`  Built index.html from STX template`)
      } else {
        // Fallback to default index
        const defaultIndex = `<!DOCTYPE html>
<html><head><title>Stacks</title></head>
<body><h1>Welcome to Stacks</h1></body></html>`
        writeFileSync(join(buildDir, 'index.html'), defaultIndex)
      }

      // Copy assets directory
      const assetsPath = p.resourcesPath('assets')
      if (existsSync(assetsPath)) {
        const copyDir = (src: string, dest: string) => {
          if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
          for (const item of readdirSync(src)) {
            const srcPath = join(src, item)
            const destPath = join(dest, item)
            if (statSync(srcPath).isDirectory()) {
              copyDir(srcPath, destPath)
            } else {
              copyFileSync(srcPath, destPath)
            }
          }
        }
        copyDir(assetsPath, join(buildDir, 'assets'))
        if (isVerbose) log.debug(`  Copied assets directory`)
      }

      // Upload files to S3
      const uploadDir = async (dir: string, prefix = '') => {
        await traverseDirectory(dir, async (filePath, key) => {
          const content = readFileSync(filePath)
          const contentType = getMimeType(filePath)
          const cacheControl = key === 'index.html' || key.endsWith('/index.html')
            ? 'no-cache, no-store, must-revalidate'
            : 'public, max-age=31536000, immutable'
          await withS3Retry(() => s3.putObject({ bucket: bucketName, key, body: content, contentType, cacheControl }), `upload ${key}`)
          if (isVerbose) log.debug(`  Uploaded: ${key}`)
        })
      }

      await uploadDir(buildDir)

      // Invalidate CloudFront cache if distribution exists
      const distributionId = outputs.publicCloudFrontDistributionId || outputs.CloudFrontDistributionId
      if (distributionId) {
        if (isVerbose) log.debug('  Invalidating CloudFront cache...')
        const { AWSClient } = await import('@stacksjs/ts-cloud') as any
        const client = new AWSClient()
        await client.request({
          service: 'cloudfront',
          region: 'us-east-1', // CloudFront is always us-east-1
          method: 'POST',
          path: `/2020-05-31/distribution/${distributionId}/invalidation`,
          headers: {
            'Content-Type': 'application/xml',
          },
          body: `<?xml version="1.0" encoding="UTF-8"?>
<InvalidationBatch xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/">
  <CallerReference>${Date.now()}</CallerReference>
  <Paths>
    <Quantity>1</Quantity>
    <Items>
      <Path>/*</Path>
    </Items>
  </Paths>
</InvalidationBatch>`,
        })
      }

      frontendSpinner.succeed(`Frontend deployed to S3 (${bucketName})`)
    }
  } catch (frontendError: any) {
    frontendSpinner.fail(`Frontend deployment failed: ${frontendError.message}`)
    if (isVerbose) log.debug(`Frontend error: ${frontendError.stack}`)
  }

  // Deploy documentation to S3
  // Note: BunPress outputs to .bunpress subdirectory within outdir
  const docsDistPath = p.projectPath('dist/docs/.bunpress')
  const { existsSync: docsExists } = await import('node:fs')
  if (docsExists(docsDistPath)) {
    const docsDeploySpinner = spinner('Deploying documentation to S3...')
    docsDeploySpinner.start()

    try {
      const { S3Client, CloudFormationClient } = await import('@stacksjs/ts-cloud') as any
      const { readdirSync, statSync, readFileSync } = await import('node:fs')
      const { join, extname } = await import('node:path')

      const s3 = new S3Client(region)
      const cf = new CloudFormationClient(region)

      // Get docs bucket name from stack outputs
      const stackName = `${projectName}-cloud`
      const outputs = await cf.getStackOutputs(stackName)
      const docsBucketName = outputs.DocsBucketName

      if (!docsBucketName) {
        docsDeploySpinner.stop()
        console.log('⚠ Docs bucket not found in stack outputs (infrastructure may not be updated yet)')
      } else {
        // Upload docs files to S3 (files go to root since CloudFront routes /docs/* to this bucket)
        const uploadDocsDir = async (dir: string, prefix = '') => {
          await traverseDirectory(dir, async (filePath, key) => {
            const content = readFileSync(filePath)
            const contentType = getMimeType(filePath)
            const cacheControl = key.endsWith('.html')
              ? 'no-cache, no-store, must-revalidate'
              : 'public, max-age=31536000, immutable'
            await withS3Retry(() => s3.putObject({ bucket: docsBucketName, key, body: content, contentType, cacheControl }), `upload docs ${key}`)
            if (isVerbose) log.debug(`  Uploaded docs: ${key}`)
          }, '', ['.DS_Store', '.bunpress'])
        }

        await uploadDocsDir(docsDistPath)

        // Invalidate CloudFront cache for docs
        // Use the dedicated docs distribution if available, otherwise fall back to shared one
        const docsDistributionId = outputs.docsCloudFrontDistributionId || outputs.publicCloudFrontDistributionId || outputs.CloudFrontDistributionId
        if (docsDistributionId) {
          if (isVerbose) log.debug('  Invalidating CloudFront cache for docs...')
          const { AWSClient } = await import('@stacksjs/ts-cloud') as any
          const client = new AWSClient()
          await client.request({
            service: 'cloudfront',
            region: 'us-east-1',
            method: 'POST',
            path: `/2020-05-31/distribution/${docsDistributionId}/invalidation`,
            headers: {
              'Content-Type': 'application/xml',
            },
            body: `<?xml version="1.0" encoding="UTF-8"?>
<InvalidationBatch xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/">
  <CallerReference>docs-${Date.now()}</CallerReference>
  <Paths>
    <Quantity>1</Quantity>
    <Items>
      <Path>/*</Path>
    </Items>
  </Paths>
</InvalidationBatch>`,
          })
        }

        docsDeploySpinner.succeed(`Documentation deployed to S3 (${docsBucketName})`)
      }
    } catch (docsDeployError: any) {
      docsDeploySpinner.fail(`Documentation deployment failed: ${docsDeployError.message}`)
      if (isVerbose) log.debug(`Docs deploy error: ${docsDeployError.stack}`)
    }
  } else {
    if (isVerbose) log.debug('No docs build found at dist/docs, skipping docs deployment')
  }

  // Deploy blog static site to S3
  const blogDistPath = p.projectPath('dist/blog')
  const { existsSync: blogExists } = await import('node:fs')
  if (blogExists(blogDistPath)) {
    const blogDeploySpinner = spinner('Deploying blog to S3...')
    blogDeploySpinner.start()

    try {
      const { S3Client: BlogS3Client, CloudFormationClient: BlogCFClient } = await import('@stacksjs/ts-cloud') as any
      const { readFileSync: readBlogFile } = await import('node:fs')

      const blogS3 = new BlogS3Client(region)
      const blogCf = new BlogCFClient(region)

      const stackName = `${projectName}-cloud`
      const outputs = await blogCf.getStackOutputs(stackName)
      const blogBucketName = outputs.BlogBucketName

      if (!blogBucketName) {
        blogDeploySpinner.stop()
        console.log('⚠ Blog bucket not found in stack outputs')
      } else {
        await traverseDirectory(blogDistPath, async (filePath, key) => {
          const content = readBlogFile(filePath)
          const contentType = getMimeType(filePath)
          const cacheControl = key.endsWith('.html')
            ? 'no-cache, no-store, must-revalidate'
            : 'public, max-age=31536000, immutable'
          await withS3Retry(() => blogS3.putObject({ bucket: blogBucketName, key, body: content, contentType, cacheControl }), `upload blog ${key}`)
          if (isVerbose) log.debug(`  Uploaded blog: ${key}`)
        }, '', ['.DS_Store'])

        // Invalidate CloudFront cache for blog
        const blogDistributionId = outputs.blogCloudFrontDistributionId
        if (blogDistributionId) {
          if (isVerbose) log.debug('  Invalidating CloudFront cache for blog...')
          const { AWSClient: BlogAWSClient } = await import('@stacksjs/ts-cloud') as any
          const blogClient = new BlogAWSClient()
          await blogClient.request({
            service: 'cloudfront',
            region: 'us-east-1',
            method: 'POST',
            path: `/2020-05-31/distribution/${blogDistributionId}/invalidation`,
            headers: {
              'Content-Type': 'application/xml',
            },
            body: `<?xml version="1.0" encoding="UTF-8"?>
<InvalidationBatch xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/">
  <CallerReference>blog-${Date.now()}</CallerReference>
  <Paths>
    <Quantity>1</Quantity>
    <Items>
      <Path>/*</Path>
    </Items>
  </Paths>
</InvalidationBatch>`,
          })
        }

        blogDeploySpinner.succeed(`Blog deployed to S3 (${blogBucketName})`)
      }
    } catch (blogDeployError: any) {
      blogDeploySpinner.fail(`Blog deployment failed: ${blogDeployError.message}`)
      if (isVerbose) log.debug(`Blog deploy error: ${blogDeployError.stack}`)
    }
  } else {
    if (isVerbose) log.debug('No blog build found at dist/blog, skipping blog deployment')
  }

  // Deploy 404 page and configure CloudFront error responses
  const errorPageSpinner = spinner('Configuring 404 error page...')
  errorPageSpinner.start()

  try {
    const { S3Client, CloudFormationClient, AWSClient } = await import('@stacksjs/ts-cloud') as any
    const { existsSync: exists404, readFileSync: read404 } = await import('node:fs')

    const s3 = new S3Client(region)
    const cf = new CloudFormationClient(region)
    const awsClient = new AWSClient()

    // Get bucket names and distribution ID from stack outputs
    const stackName = `${projectName}-cloud`
    const outputs = await cf.getStackOutputs(stackName)
    const frontendBucket = outputs.FrontendBucketName
    const docsBucket = outputs.DocsBucketName
    const distributionId = outputs.publicCloudFrontDistributionId || outputs.CloudFrontDistributionId

    // Check for 404.html in docs build output
    const docs404Path = p.projectPath('dist/docs/.bunpress/404.html')
    let html404Content: string

    if (exists404(docs404Path)) {
      // Use the 404.html generated by BunPress
      html404Content = read404(docs404Path, 'utf-8')
      if (isVerbose) log.debug('  Using BunPress-generated 404.html')
    } else {
      // Generate a default VitePress-style 404 page
      html404Content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page Not Found</title>
  <meta name="robots" content="noindex">
  <style>
    :root {
      --vp-c-bg: #ffffff;
      --vp-c-divider: #e2e2e3;
      --vp-c-text-1: rgba(60, 60, 67);
      --vp-c-text-2: rgba(60, 60, 67, 0.78);
      --vp-c-brand-1: #3451b2;
      --vp-c-brand-2: #3a5ccc;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --vp-c-bg: #1b1b1f;
        --vp-c-divider: #2e2e32;
        --vp-c-text-1: rgba(255, 255, 245, 0.86);
        --vp-c-text-2: rgba(235, 235, 245, 0.6);
        --vp-c-brand-1: #a8b1ff;
        --vp-c-brand-2: #5c73e7;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; background: var(--vp-c-bg); color: var(--vp-c-text-1); font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    .NotFound { padding: 96px 32px 168px; text-align: center; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; }
    .code { font-size: 64px; font-weight: 600; line-height: 64px; }
    .title { padding-top: 12px; letter-spacing: 2px; font-size: 20px; font-weight: 700; }
    .divider { margin: 24px auto 18px; width: 64px; height: 1px; background: var(--vp-c-divider); }
    .quote { max-width: 256px; font-size: 14px; font-weight: 500; color: var(--vp-c-text-2); }
    .action { padding-top: 20px; }
    .link { display: inline-block; border: 1px solid var(--vp-c-brand-1); border-radius: 16px; padding: 3px 16px; font-size: 14px; font-weight: 500; color: var(--vp-c-brand-1); text-decoration: none; transition: border-color 0.25s, color 0.25s; }
    .link:hover { border-color: var(--vp-c-brand-2); color: var(--vp-c-brand-2); }
  </style>
</head>
<body>
  <div class="NotFound">
    <p class="code">404</p>
    <h1 class="title">PAGE NOT FOUND</h1>
    <div class="divider"></div>
    <blockquote class="quote">But if you don't change your direction, and if you keep looking, you may end up where you are heading.</blockquote>
    <div class="action"><a class="link" href="/docs/">Take me home</a></div>
  </div>
</body>
</html>`
      if (isVerbose) log.debug('  Using default 404.html template')
    }

    // Upload 404.html to frontend bucket
    if (frontendBucket) {
      await withS3Retry(() => s3.putObject({
        bucket: frontendBucket,
        key: '404.html',
        body: html404Content,
        contentType: 'text/html',
        cacheControl: 'no-cache, no-store, must-revalidate',
      }), 'upload 404.html to frontend bucket')
      if (isVerbose) log.debug(`  Uploaded 404.html to frontend bucket: ${frontendBucket}`)
    }

    // Upload 404.html to docs bucket
    if (docsBucket) {
      await withS3Retry(() => s3.putObject({
        bucket: docsBucket,
        key: '404.html',
        body: html404Content,
        contentType: 'text/html',
        cacheControl: 'no-cache, no-store, must-revalidate',
      }), 'upload 404.html to docs bucket')
      if (isVerbose) log.debug(`  Uploaded 404.html to docs bucket: ${docsBucket}`)
    }

    // Configure CloudFront custom error responses
    if (distributionId) {
      if (isVerbose) log.debug('  Configuring CloudFront custom error responses...')

      // Get current distribution config
      const getResult = await awsClient.request({
        service: 'cloudfront',
        region: 'us-east-1',
        method: 'GET',
        path: `/2020-05-31/distribution/${distributionId}/config`,
        returnHeaders: true,
      })

      const etag = getResult.headers?.etag || getResult.headers?.ETag || ''
      const currentConfig = getResult.body?.DistributionConfig || getResult.DistributionConfig

      if (currentConfig && etag) {
        // Check if custom error responses are already configured
        const existingErrors = currentConfig.CustomErrorResponses?.Quantity || 0
        const has404Config = existingErrors > 0 &&
          currentConfig.CustomErrorResponses?.Items?.CustomErrorResponse?.some?.(
            (err: any) => err.ErrorCode === 404 && err.ResponsePagePath === '/404.html'
          )

        if (!has404Config) {
          // Update custom error responses
          currentConfig.CustomErrorResponses = {
            Quantity: 2,
            Items: {
              CustomErrorResponse: [
                {
                  ErrorCode: 403,
                  ResponsePagePath: '/404.html',
                  ResponseCode: 404,
                  ErrorCachingMinTTL: 10,
                },
                {
                  ErrorCode: 404,
                  ResponsePagePath: '/404.html',
                  ResponseCode: 404,
                  ErrorCachingMinTTL: 10,
                },
              ],
            },
          }

          // Build XML for update
          const buildXmlElement = (name: string, value: any, indent: string = ''): string => {
            if (value === null || value === undefined) return ''
            if (typeof value === 'boolean') return `${indent}<${name}>${value}</${name}>\n`
            if (typeof value === 'number' || typeof value === 'string') return `${indent}<${name}>${value}</${name}>\n`
            if (Array.isArray(value)) return value.map(item => buildXmlElement(name, item, indent)).join('')
            if (typeof value === 'object') {
              if (name.startsWith('@_') || name === '?xml') return ''
              let children = ''
              for (const [key, val] of Object.entries(value)) {
                if (!key.startsWith('@_') && key !== '#text') {
                  children += buildXmlElement(key, val, `${indent}  `)
                }
              }
              if ((value as any)['#text'] !== undefined) return `${indent}<${name}>${(value as any)['#text']}</${name}>\n`
              return `${indent}<${name}>\n${children}${indent}</${name}>\n`
            }
            return ''
          }

          const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<DistributionConfig xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/">\n${Object.entries(currentConfig)
            .filter(([key]) => !key.startsWith('@_'))
            .map(([key, val]) => buildXmlElement(key, val, '  '))
            .join('')}</DistributionConfig>\n`

          // Update the distribution
          await awsClient.request({
            service: 'cloudfront',
            region: 'us-east-1',
            method: 'PUT',
            path: `/2020-05-31/distribution/${distributionId}/config`,
            body: xml,
            headers: {
              'Content-Type': 'application/xml',
              'If-Match': etag,
            },
          })
          if (isVerbose) log.debug('  CloudFront custom error responses configured')
        } else {
          if (isVerbose) log.debug('  CloudFront custom error responses already configured')
        }
      }
    }

    errorPageSpinner.succeed('404 error page configured')
  } catch (errorPageError: any) {
    errorPageSpinner.stop()
    console.log(`⚠ 404 page configuration skipped: ${errorPageError.message}`)
    if (isVerbose) log.debug(`Error page config error: ${errorPageError.stack}`)
  }
  console.log('')
  log.success('Deployment completed successfully!')
} catch (error) {
  log.error('Deployment failed:', error)
  process.exit(ExitCode.FatalError)
}

// Legacy CDK deployment (commented out for reference)
// const profile = process.env.AWS_PROFILE ?? 'stacks'
// const result = await runCommand(`bunx --bun cdk deploy --require-approval never --profile="${profile}"`, {
//   cwd: p.frameworkCloudPath(),
// })
// if (result.isErr) {
//   log.error(result.error)
//   process.exit(ExitCode.FatalError)
// }
// const t = result.value as Subprocess
// await t.exited
