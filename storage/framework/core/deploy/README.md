# Stacks Deployment with ts-cloud

This module provides AWS deployment capabilities for Stacks using ts-cloud, replacing AWS CLI and AWS SDK with native TypeScript implementations.

## Overview

The deployment system integrates ts-cloud into the Stacks framework, providing:

- **Infrastructure as Code** - CloudFormation templates generated from `cloud.config.ts`
- **Direct AWS API Calls** - No AWS CLI or SDK dependencies
- **Full Stack Deployment** - Infrastructure + Frontend + API
- **Environment Support** - Production, staging, and development

## Architecture

### Modules

1. **deploy.ts** - Frontend deployment to S3 and CloudFront
2. **stack.ts** - Infrastructure stack management via CloudFormation
3. **dev.ts** - Local development server

### Integration Points

- **Buddy CLI** (`./buddy deploy`) - Main deployment command
- **Actions** (`storage/framework/core/actions/src/deploy/`) - Deployment logic
- **Config** (`cloud.config.ts`) - Infrastructure configuration

## Quick Start

### Prerequisites

1. **AWS Credentials**
   ```bash
   export AWS_ACCESS_KEY_ID=your-access-key
   export AWS_SECRET_ACCESS_KEY=your-secret-key
   ```

2. **Configuration**

   Edit `cloud.config.ts` at the project root to configure your infrastructure.

### Deploy to Production

```bash
./buddy deploy
```

This will:
1. Build the framework
2. Build the documentation (if exists)
3. Build the views/frontend
4. Build the server
5. Deploy infrastructure stack to AWS
6. Upload frontend to S3
7. Invalidate CloudFront cache

### Development Server

```bash
./buddy dev
```

## Configuration

### config/cloud.ts

The `config/cloud.ts` file defines your infrastructure using the `tsCloud` export:

```typescript
import type { CloudConfig as TsCloudConfig } from '@ts-cloud/types'

export const tsCloud: TsCloudConfig = {
  project: {
    name: 'stacks',
    slug: 'stacks',
    region: 'us-east-1',
  },

  // No mode needed! Auto-detected from your infrastructure config

  environments: {
    production: {
      type: 'production',
      region: 'us-east-1',
    },
  },

  infrastructure: {
    storage: {
      'frontend': {
        public: true,
        website: true,
        encryption: true,
      },
    },

    cdn: {
      'frontend': {
        origin: 'stacks-production-frontend.s3.us-east-1.amazonaws.com',
        customDomain: 'your-domain.com',
      },
    },
  },
}

export default config
```

### Environment Variables

- `CLOUD_ENV` - Target environment (production, staging, development)
- `AWS_REGION` - AWS region (default: us-east-1)
- `AWS_ACCESS_KEY_ID` - AWS access key (required)
- `AWS_SECRET_ACCESS_KEY` - AWS secret key (required)
- `AWS_SESSION_TOKEN` - AWS session token (optional)

## Deployment Flow

### 1. Build Phase

The deployment automatically builds:
- Framework (`storage/framework`)
- Documentation (if `docs/` exists)
- Views (`storage/framework/views/web`) - unless in docMode
- Server (`storage/framework/server`)

### 2. Infrastructure Deployment

Using ts-cloud:
- Generates CloudFormation template from `cloud.config.ts`
- Creates or updates CloudFormation stack
- Waits for stack completion
- Displays stack outputs

### 3. Frontend Deployment

- Uploads built frontend to S3 bucket
- Sets appropriate cache headers
- Creates CloudFront invalidation
- Shows deployment URL

## Commands

### Main Deploy Command

```bash
./buddy deploy [env] [options]
```

**Options:**
- `--domain <domain>` - Specify deployment domain
- `-p, --project <project>` - Target specific project
- `--prod` - Deploy to production (default)
- `--dev` - Deploy to development
- `--staging` - Deploy to staging
- `--yes` - Skip confirmation prompts
- `--verbose` - Enable verbose output

**Examples:**
```bash
./buddy deploy                           # Deploy to production
./buddy deploy --staging                 # Deploy to staging
./buddy deploy --domain example.com      # Deploy to specific domain
./buddy deploy production --yes          # Skip confirmation
```

### Development

```bash
./buddy dev                              # Start dev server
```

## Module API

### deployStack()

Deploys infrastructure using CloudFormation:

```typescript
import { deployStack } from '@stacksjs/deploy'

await deployStack({
  environment: 'production',
  region: 'us-east-1',
  stackName: 'my-stack',      // optional
  waitForCompletion: true,    // optional
})
```

### deployFrontend()

Deploys frontend to S3 and CloudFront:

```typescript
import { deployFrontend } from '@stacksjs/deploy'

await deployFrontend({
  environment: 'production',
  region: 'us-east-1',
  buildDir: 'dist',           // optional
  bucket: 'frontend',         // optional
})
```

### startDevServer()

Starts local development server:

```typescript
import { startDevServer } from '@stacksjs/deploy'

await startDevServer({
  environment: 'development',
  region: 'us-east-1',
  port: 3000,                 // optional
  autoDeploy: false,          // optional
})
```

## AWS Services

The deployment uses these AWS services:

- **CloudFormation** - Infrastructure as code
- **S3** - Static file hosting and storage
- **CloudFront** - CDN and global distribution
- **IAM** - Permissions and roles
- **Lambda** - Serverless functions (if configured)
- **API Gateway** - API endpoints (if configured)

## Direct API Implementation

All AWS operations use direct HTTPS requests with AWS Signature V4:

- ✅ No AWS CLI required
- ✅ No AWS SDK required
- ✅ Pure TypeScript implementation
- ✅ Faster execution
- ✅ Better error handling
- ✅ Full type safety

## Migrating from CDK

The deployment action (`storage/framework/core/actions/src/deploy/index.ts`) has been updated to use ts-cloud instead of CDK.

**Before (CDK):**
```typescript
await runCommand(`bunx --bun cdk deploy --profile="${profile}"`, {
  cwd: p.frameworkCloudPath(),
})
```

**After (ts-cloud):**
```typescript
const { deployStack, deployFrontend } = await import('../../deploy')

await deployStack({ environment, region, waitForCompletion: true })
await deployFrontend({ environment, region })
```

The legacy CDK code is preserved as comments for reference.

## Troubleshooting

### Missing AWS Credentials

```bash
# Set credentials
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret

# Or use AWS profile
export AWS_PROFILE=stacks
```

### Build Failures

Ensure all build scripts work individually:
```bash
cd storage/framework && bun run build
cd storage/framework/views/web && bun run build
cd storage/framework/server && bun build.ts
```

### Stack Already Exists

The deployment automatically updates existing stacks. If you see "No updates to be performed", your infrastructure is current.

### Import Errors

If you see module import errors:
```bash
# Re-link ts-cloud
cd ~/Code/ts-cloud/packages/ts-cloud && bun link
cd ~/Code/stacks && bun link ts-cloud

# Or reinstall
cd ~/Code/stacks/storage/framework/core/deploy && bun install
```

## Development Workflow

1. **Make Changes** - Edit your code
2. **Test Locally** - `./buddy dev`
3. **Build** - Automatic during deploy
4. **Deploy** - `./buddy deploy --staging` (test first)
5. **Production** - `./buddy deploy` (when ready)

## Files Structure

```
stacks/
├── cloud.config.ts                              # Infrastructure config
├── buddy                                        # CLI entry point
└── storage/framework/core/
    ├── deploy/                                  # Deployment modules
    │   ├── deploy.ts                            # Frontend deployment
    │   ├── stack.ts                             # Stack management
    │   ├── dev.ts                               # Dev server
    │   ├── index.ts                             # Module exports
    │   ├── package.json                         # Dependencies
    │   └── README.md                            # This file
    ├── actions/src/deploy/index.ts              # Deploy action
    └── buddy/src/commands/deploy.ts             # Deploy command
```

## Next Steps

1. **Customize Configuration** - Edit `cloud.config.ts`
2. **Set AWS Credentials** - Configure your AWS access
3. **Test Deployment** - Run `./buddy deploy --staging`
4. **Deploy to Production** - Run `./buddy deploy`

## Resources

- [ts-cloud Documentation](https://github.com/stacksjs/ts-cloud)
- [AWS CloudFormation](https://aws.amazon.com/cloudformation/)
- [Stacks Framework](https://github.com/stacksjs/stacks)

## Support

For issues or questions:
- Check the troubleshooting section above
- Review the [ts-cloud issues](https://github.com/stacksjs/ts-cloud/issues)
- Join the Stacks Discord community
