# Key Command

The `buddy key:generate` command generates and sets a cryptographically secure application key for your Stacks project, used for encryption and security purposes.

## Basic Usage

```bash
buddy key:generate
```

## Command Syntax

```bash
buddy key:generate [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## What It Does

The `key:generate` command:

1. **Generates** a cryptographically secure random key
2. **Validates** the key meets security requirements
3. **Updates** your `.env` file with the new `APP_KEY`
4. **Confirms** successful key generation

## Examples

### Generate Application Key

```bash
buddy key:generate
```

Output:
```
buddy key:generate

Random application key set.

Completed in 0.12s
```

### Generate with Verbose Output

```bash
buddy key:generate --verbose
```

### Generate for Specific Project

```bash
buddy key:generate -p my-project
```

## Environment File Update

The command automatically updates your `.env` file:

```bash
# Before
APP_KEY=

# After
APP_KEY=base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## When to Generate a New Key

### New Project Setup

Generate a key when setting up a new project:

```bash
bunx stacks new my-project
cd my-project
buddy key:generate
```

### Security Incident

Regenerate the key if you suspect it may have been compromised:

```bash
buddy key:generate
```

**Warning**: This will invalidate all existing encrypted data and sessions.

### Key Rotation

For security best practices, rotate keys periodically:

```bash
# Backup current key
cp .env .env.backup

# Generate new key
buddy key:generate
```

## Key Format

The generated key follows this format:

```
base64:[32 random bytes encoded as base64]
```

Example:
```
APP_KEY=base64:Fd5VcGvY7JZO2h8jU3cR1QpZvN4bM9xK0wL6eT5fH8I=
```

## Security Considerations

### Keep Your Key Secret

- Never commit `.env` files to version control
- Use different keys for different environments
- Store production keys securely

### Environment-Specific Keys

Generate unique keys for each environment:

```bash
# Development
buddy key:generate  # Updates .env

# Staging
APP_ENV=staging buddy key:generate  # Updates .env.staging

# Production
APP_ENV=production buddy key:generate  # Updates .env.production
```

### Key Length

The generated key is:
- 32 bytes (256 bits) of random data
- Base64 encoded for storage
- Suitable for AES-256 encryption

## What the Key Is Used For

The application key is used for:

### Encryption

- Encrypting sensitive data in the database
- Securing cookies and session data
- Protecting API tokens

### Security Tokens

- CSRF token generation
- Password reset tokens
- Email verification links

### Sessions

- Signing session cookies
- Encrypting session data

## Troubleshooting

### Key Not Set Error

```
Error: Application key not set
```

**Solution**: Generate a key:
```bash
buddy key:generate
```

### Invalid Key Format

```
Error: Invalid application key format
```

**Solution**: Regenerate the key:
```bash
buddy key:generate
```

### Permission Denied

```
Error: Cannot write to .env file
```

**Solution**: Fix file permissions:
```bash
chmod 644 .env
buddy key:generate
```

### Key Already Exists

The command will overwrite existing keys. If you want to preserve the current key:

```bash
# Check current key
grep APP_KEY .env

# Only generate if empty
if [ -z "$(grep 'APP_KEY=' .env | cut -d'=' -f2)" ]; then
  buddy key:generate
fi
```

## Best Practices

### Secure Key Storage

For production environments:

1. Use environment variables instead of files
2. Use secrets management (AWS Secrets Manager, etc.)
3. Never log or display the key

### Different Keys Per Environment

```bash
# Development (.env)
APP_KEY=base64:devkey...

# Staging (.env.staging)
APP_KEY=base64:stagingkey...

# Production (.env.production)
APP_KEY=base64:prodkey...
```

### Backup Before Rotation

```bash
# Backup current key
echo "OLD_APP_KEY=$(grep APP_KEY .env)" >> .env.backup

# Generate new key
buddy key:generate
```

### CI/CD Configuration

In CI/CD, set the key as an environment variable:

```yaml
# GitHub Actions
env:
  APP_KEY: ${{ secrets.APP_KEY }}
```

```yaml
# Docker
environment:
  - APP_KEY=${APP_KEY}
```

## Related Commands

- [buddy env](/guide/buddy/intro) - Environment management
- [buddy deploy](/guide/buddy/deploy) - Deploy application
- [buddy generate](/guide/buddy/generate) - Code generation
