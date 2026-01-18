# Domains Command

The `buddy domains` command provides comprehensive domain management capabilities, including purchasing, adding, and removing domains from your cloud infrastructure.

## Basic Usage

```bash
# Purchase a new domain
buddy domains:purchase example.com

# Add an existing domain
buddy domains:add example.com

# Remove a domain
buddy domains:remove example.com
```

## Command Syntax

```bash
buddy domains:purchase <domain> [options]
buddy domains:add <domain> [options]
buddy domains:remove <domain> [options]
```

## Available Commands

### Purchase Domain

Purchase a new domain through AWS Route 53:

```bash
buddy domains:purchase myapp.com
```

### Add Domain

Add an existing domain (owned through another registrar):

```bash
buddy domains:add myapp.com
```

### Remove Domain

Remove a domain from your cloud:

```bash
buddy domains:remove myapp.com
```

## Purchase Options

| Option | Description | Default |
|--------|-------------|---------|
| `--years <years>` | Number of years to purchase | 1 |
| `--privacy` | Enable privacy protection | true |
| `--auto-renew` | Enable auto-renewal | true |

### Registrant Information

| Option | Description |
|--------|-------------|
| `--first-name <name>` | Registrant first name |
| `--last-name <name>` | Registrant last name |
| `--organization <org>` | Organization name |
| `--address-line1 <addr>` | Address line 1 |
| `--address-line2 <addr>` | Address line 2 |
| `--city <city>` | City |
| `--state <state>` | State/Province |
| `--country <code>` | Country code (US, CA, etc.) |
| `--zip <zip>` | Postal code |
| `--phone <phone>` | Phone number |
| `--email <email>` | Email address |

### Admin Contact (Optional)

| Option | Description |
|--------|-------------|
| `--admin-first-name` | Admin first name |
| `--admin-last-name` | Admin last name |
| `--admin-organization` | Admin organization |
| `--admin-email` | Admin email |

### Tech Contact (Optional)

| Option | Description |
|--------|-------------|
| `--tech-first-name` | Tech contact first name |
| `--tech-last-name` | Tech contact last name |
| `--tech-organization` | Tech organization |
| `--tech-email` | Tech email |

## Examples

### Purchase Domain with Defaults

Using contact info from `config/dns.ts`:

```bash
buddy domains:purchase myapp.com
```

### Purchase with Custom Contact

```bash
buddy domains:purchase myapp.com \
  --first-name "John" \
  --last-name "Doe" \
  --email "john@example.com" \
  --phone "+1.5551234567" \
  --address-line1 "123 Main St" \
  --city "San Francisco" \
  --state "CA" \
  --country "US" \
  --zip "94102"
```

### Purchase for Multiple Years

```bash
buddy domains:purchase myapp.com --years 3
```

### Add Existing Domain

```bash
buddy domains:add myexistingdomain.com
```

### Remove Domain

```bash
buddy domains:remove myapp.com
```

### Skip Confirmation

```bash
buddy domains:remove myapp.com --yes
```

## Configuration

Configure default contact information in `config/dns.ts`:

```typescript
export default {
  contactInfo: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phoneNumber: '+1.5551234567',
    addressLine1: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    countryCode: 'US',
    zip: '94102',
    organizationName: 'My Company',

    // Optional: separate admin contact
    admin: {
      firstName: 'Jane',
      lastName: 'Admin',
      email: 'admin@example.com',
    },

    // Optional: separate tech contact
    tech: {
      firstName: 'Tech',
      lastName: 'Support',
      email: 'tech@example.com',
    },

    // Privacy settings
    privacy: true,
    privacyAdmin: true,
    privacyTech: true,
    privacyRegistrant: true,
  },
}
```

## Domain Workflow

### New Project Setup

```bash
# 1. Purchase domain
buddy domains:purchase myapp.com

# 2. Update APP_URL when prompted
# 3. Deploy application
buddy deploy

# 4. Verify DNS
buddy dns myapp.com
```

### Adding Existing Domain

```bash
# 1. Add domain to cloud
buddy domains:add myapp.com

# 2. Update nameservers at registrar
# (Stacks will provide the nameservers)

# 3. Wait for propagation
buddy dns myapp.com --nameserver 8.8.8.8

# 4. Deploy
buddy deploy
```

## Post-Purchase Actions

After purchasing, you may be prompted to:

1. **Verify email** - Check your inbox for verification
2. **Set APP_URL** - Update your environment configuration
3. **Deploy** - Deploy your application to the new domain

## Troubleshooting

### Domain Already Registered

```
Error: Domain is not available
```

**Solutions**:
1. Check domain availability on registrar websites
2. Try alternative domain names
3. Use `domains:add` for existing domains

### Email Verification Required

```
Warning: Please verify your email address
```

**Solution**: Check your email for a verification link from AWS/registrar.

### DNS Propagation

```
Warning: DNS changes may take 24-48 hours
```

**Solution**: Use specific nameservers to check propagation:
```bash
buddy dns myapp.com --nameserver 8.8.8.8
```

### Invalid Contact Information

```
Error: Invalid contact information
```

**Solution**: Ensure all required fields are provided and valid:
- Phone numbers in international format: `+1.5551234567`
- Valid country codes (2-letter ISO)
- Valid email addresses

### Permission Denied

```
Error: Access denied
```

**Solution**: Check AWS credentials and permissions in `.env.production`.

## Domain Pricing

Domain prices vary by TLD (Top-Level Domain):

| TLD | Approximate Price |
|-----|-------------------|
| .com | $12/year |
| .net | $11/year |
| .org | $12/year |
| .io | $39/year |
| .dev | $12/year |

Prices are determined by AWS Route 53 at time of purchase.

## Best Practices

### Use Privacy Protection

Always enable privacy protection:

```bash
buddy domains:purchase myapp.com --privacy
```

### Enable Auto-Renewal

Prevent accidental expiration:

```bash
buddy domains:purchase myapp.com --auto-renew
```

### Verify Contact Information

Ensure contact info is accurate for:
- ICANN compliance
- Domain transfer verification
- Important notifications

### Document DNS Changes

Keep records of DNS configurations:

```bash
# Export current records
buddy dns myapp.com --type ANY > dns-backup.txt
```

## Related Commands

- [buddy dns](/guide/buddy/dns) - DNS queries
- [buddy deploy](/guide/buddy/deploy) - Deploy application
- [buddy cloud](/guide/buddy/cloud) - Cloud management
