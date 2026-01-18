# DNS Command

The `buddy dns` command queries DNS records for domains, providing a developer-friendly interface for DNS debugging and verification.

## Basic Usage

```bash
# Query DNS for your app domain
buddy dns

# Query specific domain
buddy dns example.com
```

## Command Syntax

```bash
buddy dns [domain] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `domain` | Domain to query (defaults to APP_URL) |

### Options

| Option | Description |
|--------|-------------|
| `-q, --query <query>` | Host name or IP address to query |
| `-t, --type <type>` | DNS record type (A, MX, NS, CNAME, etc.) |
| `-n, --nameserver <nameserver>` | Nameserver to query |
| `--class <class>` | Network class (IN, CH, HS) |
| `-U, --udp` | Use DNS over UDP |
| `-T, --tcp` | Use DNS over TCP |
| `-S, --tls` | Use DNS-over-TLS |
| `-H, --https` | Use DNS-over-HTTPS |
| `-1, --short` | Short mode - display only first result |
| `-J, --json` | Display output as JSON |
| `-p, --pretty` | Pretty-print JSON output |
| `--verbose` | Enable verbose output |

## Record Types

Query specific DNS record types:

| Type | Description |
|------|-------------|
| `A` | IPv4 address |
| `AAAA` | IPv6 address |
| `CNAME` | Canonical name (alias) |
| `MX` | Mail exchange server |
| `NS` | Nameserver |
| `TXT` | Text records |
| `SOA` | Start of authority |
| `SRV` | Service record |
| `CAA` | Certificate authority authorization |
| `ANY` | All records (default) |

## Examples

### Query All Records

```bash
buddy dns example.com
```

### Query A Records

```bash
buddy dns example.com --type A
```

### Query MX Records

```bash
buddy dns example.com --type MX
```

Output:
```
MX example.com.  300  IN  MX  10 mail.example.com.
MX example.com.  300  IN  MX  20 mail2.example.com.
```

### Query NS Records

```bash
buddy dns example.com --type NS
```

### Query TXT Records

```bash
buddy dns example.com --type TXT
```

### Short Output

```bash
buddy dns example.com --type A --short
```

Output:
```
93.184.216.34
```

### JSON Output

```bash
buddy dns example.com --type A --json
```

### Use Specific Nameserver

```bash
buddy dns example.com --nameserver 8.8.8.8
```

### DNS over HTTPS

```bash
buddy dns example.com --https
```

### DNS over TLS

```bash
buddy dns example.com --tls
```

## Use Cases

### Verify Domain Configuration

Before deployment:

```bash
# Check A record points to correct IP
buddy dns myapp.com --type A

# Check CNAME for www
buddy dns www.myapp.com --type CNAME

# Verify MX records for email
buddy dns myapp.com --type MX
```

### Debug DNS Propagation

Check if DNS changes have propagated:

```bash
# Check with Google DNS
buddy dns myapp.com --type A --nameserver 8.8.8.8

# Check with Cloudflare DNS
buddy dns myapp.com --type A --nameserver 1.1.1.1

# Check with authoritative nameserver
buddy dns myapp.com --type NS
buddy dns myapp.com --type A --nameserver ns1.example.com
```

### Verify SSL/TLS Setup

Check CAA records for SSL certificates:

```bash
buddy dns myapp.com --type CAA
```

### Email Configuration

Verify email DNS records:

```bash
# MX records
buddy dns myapp.com --type MX

# SPF record
buddy dns myapp.com --type TXT

# DKIM record
buddy dns selector._domainkey.myapp.com --type TXT

# DMARC record
buddy dns _dmarc.myapp.com --type TXT
```

### Subdomain Configuration

```bash
# Check subdomain
buddy dns api.myapp.com --type A

# Check wildcard
buddy dns *.myapp.com --type A
```

## DNS Record Verification

### CloudFront Distribution

```bash
# Should return CloudFront CNAME
buddy dns myapp.com --type CNAME
```

### AWS Load Balancer

```bash
# Should return ALB DNS name
buddy dns api.myapp.com --type CNAME
```

### Route 53 Alias

```bash
# Check alias target
buddy dns myapp.com --type A
```

## Troubleshooting

### No Records Found

```
Error: No records found
```

**Solutions**:
1. Verify the domain name is correct
2. Check if the record type exists
3. Try a different nameserver

### Timeout

```
Error: Query timed out
```

**Solutions**:
1. Try a different nameserver: `--nameserver 8.8.8.8`
2. Use TCP: `--tcp`
3. Check network connectivity

### NXDOMAIN

```
NXDOMAIN (domain does not exist)
```

**Solutions**:
1. Verify domain spelling
2. Check if domain is registered
3. Verify DNS configuration at registrar

### Inconsistent Results

Different results from different nameservers indicate propagation in progress:

```bash
# Compare results
buddy dns myapp.com --nameserver 8.8.8.8
buddy dns myapp.com --nameserver 1.1.1.1
```

Wait for DNS propagation (typically 1-48 hours).

## DNS Best Practices

### Before Deployment

1. Verify current DNS configuration
2. Plan changes carefully
3. Note existing TTL values

### During Changes

1. Lower TTL before making changes
2. Make changes
3. Verify propagation

### After Deployment

1. Verify all records are correct
2. Restore normal TTL values
3. Monitor for issues

## Common DNS Configurations

### Static Website

```
A     @     93.184.216.34
CNAME www   example.com.
```

### API Endpoint

```
CNAME api   api.example.cloudfront.net.
```

### Email

```
MX    @     10 mail.example.com.
TXT   @     "v=spf1 include:_spf.example.com ~all"
```

## Related Commands

- [buddy domains](/guide/buddy/domains) - Domain management
- [buddy deploy](/guide/buddy/deploy) - Deploy application
- [buddy cloud](/guide/buddy/cloud) - Cloud management
