---
title: HTTP Command
description: "The  command sends a GET request to a URL and prints the response, handy for smoke-testing an endpoint from the terminal. It is powered by httx."
---
# HTTP Command

The `buddy http` command sends a GET request to a URL and prints the response, handy for smoke-testing an endpoint from the terminal. It is powered by [httx](https://github.com/stacksjs/httx).

## Basic Usage

```bash
# GET your configured app URL
buddy http

# GET a specific URL
buddy http example.com/api/hello
```

## Command Syntax

```bash
buddy http [domain] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `domain` | The URL to send the GET request to (defaults to your configured app URL) |

### Options

| Option | Description |
|--------|-------------|
| `-p, --project [project]` | Target a specific project |
| `-v, --verbose` | Enable verbose output |

## How It Works

The command always sends a GET request:

- If the URL does not start with `http`, the `https://` scheme is prefixed automatically.
- The status line and response time are printed, followed by the response body (pretty-printed when it is JSON).

A request method, headers, and a body cannot be passed today. For anything beyond a GET smoke test, use a full HTTP client.

## Examples

### Basic GET Request

```bash
buddy http example.com/api/hello
```

Output:

```
GET https://example.com/api/hello
200 OK (123ms)
{"hello":"world"}
```

### Verbose Output

See the request as it is being sent:

```bash
buddy http -v example.com/api/hello
```

### Local Development

```bash
# Smoke-test your local API
buddy http localhost:3000/api/health
```

## Related Commands

- [buddy dev:api](/guide/buddy/dev) - Start API development server
- [buddy dns](/guide/buddy/dns) - DNS queries
- [buddy test](/guide/buddy/test) - Run tests
