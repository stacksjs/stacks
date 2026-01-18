# HTTP Command

The `buddy http` command provides a powerful HTTP client for testing and debugging API endpoints, proxying the httpie tool for a developer-friendly experience.

## Basic Usage

```bash
# GET request to your app URL
buddy http

# GET request to specific URL
buddy http httpie.io/hello
```

## Command Syntax

```bash
buddy http [domain] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `domain` | The URL to send the request to (defaults to APP_URL) |

### Options

| Option | Description |
|--------|-------------|
| `-p, --project [project]` | Target a specific project |

## Request Methods

### GET Request

```bash
buddy http GET https://api.example.com/users
# or simply
buddy http https://api.example.com/users
```

### POST Request

```bash
buddy http POST https://api.example.com/users name=John email=john@example.com
```

### PUT Request

```bash
buddy http PUT https://api.example.com/users/1 name=Jane
```

### DELETE Request

```bash
buddy http DELETE https://api.example.com/users/1
```

## Examples

### Basic GET Request

```bash
buddy http httpie.io/hello
```

### POST with JSON Data

```bash
buddy http POST pie.dev/post hello=World
```

### Custom Headers

```bash
buddy http PUT pie.dev/put X-API-Token:123 name=John
```

### Verbose Output

See the request being sent:

```bash
buddy http -v pie.dev/get
```

### Form Submission

```bash
buddy http -f POST pie.dev/post hello=World
```

### Offline Mode

View request without sending:

```bash
buddy http --offline pie.dev/post hello=offline
```

### Authentication

Basic authentication:

```bash
buddy http -a USERNAME POST https://api.github.com/repos/user/repo/issues/1/comments body='Comment'
```

### File Upload

Send file contents:

```bash
buddy http pie.dev/post < files/data.json
```

### Download File

```bash
buddy http pie.dev/image/png > image.png
# or
buddy http --download pie.dev/image/png
```

### Sessions

Persist cookies across requests:

```bash
# Login and save session
buddy http --session=logged-in -a username:password pie.dev/get API-Key:123

# Use saved session
buddy http --session=logged-in pie.dev/headers
```

### Custom Host Header

```bash
buddy http localhost:8000 Host:example.com
```

## Output Formats

### Default Output

Shows response headers and body:

```bash
buddy http httpie.io/json
```

### Headers Only

```bash
buddy http --headers httpie.io/json
```

### Body Only

```bash
buddy http --body httpie.io/json
```

### JSON Output

```bash
buddy http --json httpie.io/json
```

## Testing Your API

### Local Development

```bash
# Test your local API (uses APP_URL)
buddy http

# Test specific endpoint
buddy http localhost:3000/api/users
```

### With Authentication

```bash
buddy http localhost:3000/api/protected Authorization:"Bearer your-token"
```

### POST JSON Data

```bash
buddy http POST localhost:3000/api/users \
  name="John Doe" \
  email="john@example.com" \
  role="admin"
```

## HTTPS Support

### HTTPS Request

```bash
buddy https httpie.io/hello
```

This is equivalent to:

```bash
buddy http https://httpie.io/hello
```

## Common Patterns

### API Testing Workflow

```bash
# 1. Test health endpoint
buddy http localhost:3000/api/health

# 2. Create a resource
buddy http POST localhost:3000/api/users name="Test User"

# 3. Verify creation
buddy http localhost:3000/api/users/1

# 4. Update resource
buddy http PUT localhost:3000/api/users/1 name="Updated User"

# 5. Delete resource
buddy http DELETE localhost:3000/api/users/1
```

### Debug API Issues

```bash
# Verbose mode shows full request/response
buddy http -v localhost:3000/api/endpoint

# Check headers
buddy http --headers localhost:3000/api/endpoint
```

## Troubleshooting

### Connection Refused

```
Error: Connection refused
```

**Solutions**:
1. Ensure the server is running: `buddy dev:api`
2. Check the correct port
3. Verify firewall settings

### SSL Certificate Error

```
Error: SSL certificate verification failed
```

**Solution**: For local development, use `--verify=no`:
```bash
buddy http --verify=no https://localhost:3000/api
```

### Timeout

```
Error: Request timed out
```

**Solution**: Increase timeout:
```bash
buddy http --timeout=30 slow-api.example.com
```

### Invalid JSON

```
Error: Invalid JSON response
```

**Solution**: View raw response:
```bash
buddy http --body api.example.com/endpoint
```

## Best Practices

### Use Environment Variables

Store API tokens securely:

```bash
export API_TOKEN=your-token
buddy http localhost:3000/api Authorization:"Bearer $API_TOKEN"
```

### Document API Calls

Create a file with common requests:

```bash
# api-tests.sh
buddy http localhost:3000/api/health
buddy http localhost:3000/api/users
buddy http POST localhost:3000/api/auth/login email=test@test.com password=test
```

### Test Before Deployment

```bash
# Test local
buddy http localhost:3000/api/health

# Test staging
buddy http staging.yourapp.com/api/health

# Test production
buddy http yourapp.com/api/health
```

## Related Commands

- [buddy dev:api](/guide/buddy/dev) - Start API development server
- [buddy dns](/guide/buddy/dns) - DNS queries
- [buddy test](/guide/buddy/test) - Run tests
