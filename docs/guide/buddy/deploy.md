# Deploy Command

The `buddy deploy` command deploys your Stacks application to cloud infrastructure, handling all aspects of the deployment process including DNS configuration, SSL certificates, and CDN setup.

## Basic Usage

```bash
# Deploy application
buddy deploy

# Undeploy (remove) application
buddy undeploy
```

## Command Syntax

```bash
buddy deploy [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## Deployment Process

When you run `buddy deploy`, Stacks:

1. **Validates** configuration and credentials
2. **Builds** your application for production
3. **Provisions** cloud infrastructure (if needed)
4. **Deploys** your application code
5. **Configures** DNS and SSL
6. **Sets up** CDN distribution
7. **Runs** post-deployment tasks

## Prerequisites

Before deploying, ensure you have:

1. **AWS Credentials** configured in `.env.production`:

```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
```

2. **Application URL** set in your environment:

```bash
APP_URL=your-domain.com
```

3. **Cloud configuration** in `config/cloud.ts`

## Examples

### Basic Deployment

```bash
buddy deploy
```

Output shows CDK-style progress:

```
Deploying application...

stacks-production | 0/15 | 10:30:00 | CREATE_IN_PROGRESS | AWS::CloudFormation::Stack
stacks-production | 1/15 | 10:30:05 | CREATE_COMPLETE    | AWS::S3::Bucket
...
stacks-production | 15/15 | 10:35:00 | CREATE_COMPLETE   | AWS::CloudFormation::Stack

Deployment complete!
```

### Deploy with Verbose Output

```bash
buddy deploy --verbose
```

### Deploy Specific Project

```bash
buddy deploy -p my-project
```

## Environment-Specific Deployment

Deploy to different environments:

```bash
# Deploy to staging
APP_ENV=staging buddy deploy

# Deploy to production
APP_ENV=production buddy deploy
```

## What Gets Deployed

Stacks deploys a complete cloud infrastructure:

### Compute
- Lambda functions for API
- Edge functions for routing

### Storage
- S3 buckets for static assets
- DynamoDB tables (if configured)

### Networking
- VPC and subnets
- CloudFront CDN
- Route 53 DNS records

### Security
- SSL/TLS certificates (ACM)
- IAM roles and policies
- Security groups

## DNS Configuration

### Automatic DNS

If your domain is managed by Route 53, DNS is configured automatically.

### External DNS

For domains managed elsewhere, Stacks provides the necessary records:

```
Type: CNAME
Name: www
Value: d1234567890.cloudfront.net

Type: A (Alias)
Name: @
Value: d1234567890.cloudfront.net
```

## Post-Deployment

After successful deployment:

```bash
# Check deployment status
buddy cloud --diff

# View your application
open https://your-domain.com

# SSH into infrastructure (if jump box is added)
buddy cloud --ssh
```

## Rollback

If deployment fails or you need to rollback:

```bash
# Remove current deployment
buddy undeploy

# Re-deploy previous version
git checkout <previous-commit>
buddy deploy
```

## Undeploy

Remove your cloud infrastructure:

```bash
buddy undeploy
# or
buddy cloud:remove
```

**Warning**: This removes all cloud resources. Data in S3 buckets may be retained.

## Troubleshooting

### AWS Credentials Error

```
Error: AWS credentials are invalid or expired
```

**Solution**:
1. Check credentials in `.env.production`
2. Verify credentials are active in AWS console
3. Ensure proper IAM permissions

### Domain Not Verified

```
Error: Domain verification pending
```

**Solution**:
1. Check email for verification link
2. Add DNS verification records if using external DNS

### Stack Already Exists

```
Error: Stack stacks-production already exists
```

**Solution**:
```bash
# Remove existing stack
buddy cloud:remove

# Wait for removal to complete
# Then redeploy
buddy deploy
```

### Deployment Timeout

```
Error: Deployment timed out
```

**Solution**:
1. Check AWS CloudFormation console for status
2. Review CloudWatch logs for errors
3. Run with `--verbose` for more details

### Missing Environment Variables

```
Error: Required environment variable not set
```

**Solution**:
Ensure all required variables are in your `.env.production`:

```bash
APP_URL=your-domain.com
APP_ENV=production
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
```

## Best Practices

### Pre-Deployment Checklist

1. Run tests: `buddy test`
2. Check types: `buddy test:types`
3. Build locally: `buddy build`
4. Review environment variables
5. Preview changes: `buddy cloud --diff`

### Staging First

Always deploy to staging before production:

```bash
# Deploy to staging
APP_ENV=staging buddy deploy

# Test staging environment
# ...

# Deploy to production
APP_ENV=production buddy deploy
```

### Monitor Deployments

After deployment:
1. Check CloudWatch logs
2. Monitor CloudFront metrics
3. Test critical paths

## Related Commands

- [buddy cloud](/guide/buddy/cloud) - Cloud management
- [buddy build](/guide/buddy/build) - Build for production
- [buddy domains](/guide/buddy/domains) - Domain management
