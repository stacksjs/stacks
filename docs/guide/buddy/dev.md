---
title: Development Server
description: The  command starts development servers for your Stacks application with hot module replacement (HMR) and live reload capabilities.
---
# Development Server

The `buddy dev` command starts development servers for your Stacks application with hot module replacement (HMR) and live reload capabilities.

## Basic Usage

```bash
# Start the default development server
buddy dev

# Start with interactive mode to select which server to run
buddy dev -i
```

## Command Syntax

```bash
buddy dev [server] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `server` | Optional. Specify which server to start (frontend, api, components, dashboard, desktop, native, docs, system-tray) |

### Options

| Option | Description |
|--------|-------------|
| `-f, --frontend` | Start the frontend development server |
| `-a, --api` | Start the API development server |
| `-e, --email` | Start the Email development server |
| `-c, --components` | Start the Components development server |
| `-d, --dashboard` | Start the Dashboard development server |
| `-k, --desktop` | Start the Desktop App development server |
| `-n, --native` | Start the app in a native Craft window |
| `--docs` | Start the Documentation development server |
| `--system-tray` | Start the System Tray development server |
| `-i, --interactive` | Get prompted to select which server to start |
| `-l, --with-localhost` | Include the localhost URL in the output |
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## Available Dev Servers

### Frontend Server

Start the frontend/views development server:

```bash
buddy dev frontend
# or
buddy dev:frontend
# or
buddy dev:views
buddy dev:pages
```

### API Server

Start the API development server:

```bash
buddy dev api
# or
buddy dev:api
```

### Components Server

Start the STX components development server:

```bash
buddy dev components
# or
buddy dev:components
```

### Dashboard Server

Start the admin dashboard development server:

```bash
buddy dev dashboard
# or
buddy dev:dashboard
buddy dev:admin
```

### Desktop Server

Start the desktop application development server in a native Craft window:

```bash
buddy dev desktop
# or
buddy dev:desktop
```

### Documentation Server

Start the documentation development server:

```bash
buddy dev docs
# or
buddy dev:docs
```

### System Tray Server

Start the system tray application development server:

```bash
buddy dev system-tray
# or
buddy dev:system-tray
buddy dev:tray
```

## Interactive Mode

Use interactive mode to be prompted for which server to start:

```bash
buddy dev -i
```

This presents a selection menu:

```
Which development server are you trying to start?
> All
  Frontend
  Backend
  Dashboard
  Desktop
  Native App
  Email
  Components
  Documentation
```

## Production Servers

`buddy serve` is not a dev alias: it boots the production HTTP server, and it is
the same entry the deploy target runs as a service. Only two serve commands exist:

```bash
buddy serve      # start the production HTTP server (STX views + /api proxy)
buddy serve:api  # start the production API server
```

## Examples

### Start Frontend with Verbose Output

```bash
buddy dev frontend --verbose
```

### Start API Server for Specific Project

```bash
buddy dev:api -p my-project
```

### Start Multiple Servers

To run multiple development servers, open separate terminal windows:

```bash
# Terminal 1
buddy dev:frontend

# Terminal 2
buddy dev:api

# Terminal 3
buddy dev:docs
```

## Hot Module Replacement

All development servers support Hot Module Replacement (HMR), which means:

- Changes to your code are reflected immediately without full page reloads
- Component state is preserved during updates
- CSS changes are applied instantly

## Pretty URLs

Stacks provides pretty HTTPS development URLs out of the box. Set the hostname
with `APP_URL` in `.env`:

```bash
APP_URL=my-project.localhost
```

`buddy dev` uses rpx and tlsx to serve:

- `<https://your-project.localhost>` instead of `<http://localhost:3000>`

Run `buddy setup:ssl` once to authorize the shared rpx daemon on ports 80 and
443 and trust its tlsx-generated local CA. This is the only interactive setup
step. A `*.localhost` name resolves to loopback automatically, so it does not
need an `/etc/hosts` entry. Other development domains can require rpx-managed
DNS or hosts-file setup.

If that one-time setup has not run, `buddy dev` detects the missing system
authorization immediately and serves `<http://localhost:3000>` for the current
session. It never waits for a hidden sudo prompt. Use
`STACKS_DEV_LOCALHOST=1 buddy dev` to request that fallback explicitly.

## Troubleshooting

### Port Already in Use

If you see an error about port being in use:

```bash
# Check which process is using the port
buddy ports

# Or use a different port in your configuration
```

### SSL Certificate Issues

Pretty URLs use a locally trusted development certificate. If your browser
shows a warning, rerun the setup:

```bash
buddy setup:ssl
```

### Server Won't Start

1. Ensure all dependencies are installed: `buddy install`
2. Check for syntax errors in your configuration files
3. Run with verbose mode: `buddy dev --verbose`

## Related Commands

- [buddy build](/guide/buddy/build) - Build for production
- [buddy test](/guide/buddy/test) - Run tests
- [buddy lint](/guide/buddy/lint) - Lint your code
