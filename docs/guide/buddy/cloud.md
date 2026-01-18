# Cloud Command

The `buddy cloud` command provides tools for interacting with and managing your Stacks cloud infrastructure on AWS.

## Basic Usage

```bash
# Show cloud options
buddy cloud

# SSH into cloud infrastructure
buddy cloud --ssh

# View infrastructure diff
buddy cloud --diff
```

## Command Syntax

```bash
buddy cloud [options]
buddy cloud:add [options]
buddy cloud:remove [options]
buddy cloud:cleanup [options]
buddy cloud:optimize-cost [options]
buddy cloud:invalidate-cache [options]
buddy cloud:diff [options]
```

## Available Commands

### Cloud SSH

Connect to your cloud infrastructure via SSH:

```bash
buddy cloud --ssh
# or
buddy cloud --connect
```

This uses AWS Systems Manager Session Manager to connect to your jump box.

### Cloud Diff

Preview infrastructure changes before deploying:

```bash
buddy cloud --diff
# or
buddy cloud:diff
```

### Invalidate CDN Cache

Invalidate CloudFront cache:

```bash
buddy cloud --invalidate-cache
buddy cloud:invalidate-cache
buddy cloud:invalidate-cache --paths "/*"
```

## Cloud Add Commands

### Add Jump Box

Add a jump box (bastion host) to your cloud infrastructure:

```bash
buddy cloud:add --jump-box
```

This creates an EC2 instance that allows you to SSH into your VPC.

## Cloud Remove Commands

### Remove Infrastructure

Remove all cloud infrastructure:

```bash
buddy cloud:remove
# or
buddy cloud:destroy
buddy cloud:rm
buddy undeploy
```

### Remove Jump Box

Remove only the jump box to reduce costs:

```bash
buddy cloud:remove --jump-box
```

### Force Removal

Force deletion of stuck stacks:

```bash
buddy cloud:remove --force
```

### Skip Confirmation

Skip confirmation prompts:

```bash
buddy cloud:remove --yes
```

## Cloud Cleanup

Clean up retained resources after infrastructure removal:

```bash
buddy cloud:cleanup
# or
buddy cloud:clean-up
```

This removes:
- Jump boxes
- S3 buckets
- Lambda functions
- Log groups
- Parameter store entries
- VPCs and subnets
- CDK remnants
- IAM users

## Cost Optimization

Remove non-essential resources to reduce costs:

```bash
buddy cloud:optimize-cost
```

By default, this removes the jump box which can be re-added later.

## Options Reference

### Common Options

| Option | Description |
|--------|-------------|
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

### Cloud Command Options

| Option | Description |
|--------|-------------|
| `--ssh` | SSH into the cloud |
| `--connect` | Alias for --ssh |
| `--invalidate-cache` | Invalidate CloudFront cache |
| `--paths [paths]` | Paths to invalidate |
| `--diff` | Show infrastructure diff |

### Cloud Remove Options

| Option | Description |
|--------|-------------|
| `--jump-box` | Remove only the jump box |
| `--force` | Force deletion of stuck stacks |
| `--yes` | Skip confirmation prompts |

## Examples

### SSH into Cloud

```bash
buddy cloud --ssh
```

Once connected, you can:
- Debug application issues
- Check logs
- Run database commands
- Test network connectivity

### Preview Infrastructure Changes

```bash
buddy cloud:diff
```

Review changes before deploying to avoid surprises.

### Complete Infrastructure Removal

```bash
# Remove infrastructure
buddy cloud:remove

# If any resources remain, clean them up
buddy cloud:cleanup
```

### Add Jump Box for Debugging

```bash
# Add jump box
buddy cloud:add --jump-box

# SSH into it
buddy cloud --ssh

# Remove when done (to save costs)
buddy cloud:remove --jump-box
```

### Invalidate Specific Paths

```bash
buddy cloud:invalidate-cache --paths "/api/*,/static/*"
```

## AWS Configuration

### Environment Variables

Set these in your `.env.production` file:

```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
```

### AWS Credentials File

Alternatively, configure `~/.aws/credentials`:

```ini
[stacks]
aws_access_key_id = your-access-key
aws_secret_access_key = your-secret-key

[default]
aws_access_key_id = your-access-key
aws_secret_access_key = your-secret-key
```

## Troubleshooting

### SSH Connection Failed

```bash
# Ensure SSM agent is running
# Check AWS credentials
buddy cloud --ssh --verbose
```

### Stack Stuck in DELETE_FAILED

```bash
# Use force deletion
buddy cloud:remove --force

# Then cleanup remaining resources
buddy cloud:cleanup
```

### Access Denied Errors

1. Check AWS credentials are valid
2. Verify IAM permissions include necessary actions
3. Check if MFA is required

```bash
# View detailed error
buddy cloud:remove --verbose
```

### Resources Not Fully Removed

Some resources are retained by design (like S3 buckets with data). Use cleanup:

```bash
buddy cloud:cleanup
```

### Credentials Expired

```bash
# Check credential validity
aws sts get-caller-identity

# Refresh credentials if needed
```

## Best Practices

### Cost Management

```bash
# Remove jump box when not needed
buddy cloud:remove --jump-box

# Or use cost optimization
buddy cloud:optimize-cost
```

### Before Major Changes

```bash
# Always preview changes
buddy cloud:diff

# Then deploy
buddy deploy
```

### Complete Teardown

```bash
# Step 1: Remove infrastructure
buddy cloud:remove --yes

# Step 2: Clean up remaining resources
buddy cloud:cleanup
```

## Related Commands

- [buddy deploy](/guide/buddy/deploy) - Deploy to cloud
- [buddy domains](/guide/buddy/domains) - Manage domains
- [buddy dns](/guide/buddy/dns) - DNS management
