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
| `server` | Optional. Specify which server to start (frontend, api, components, dashboard, desktop, docs, system-tray) |

### Options

| Option | Description |
|--------|-------------|
| `-f, --frontend` | Start the frontend development server |
| `-a, --api` | Start the API development server |
| `-e, --email` | Start the Email development server |
| `-c, --components` | Start the Components development server |
| `-d, --dashboard` | Start the Dashboard development server |
| `-t, --desktop` | Start the Desktop App development server |
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

Start the Vue components development server:

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

Start the desktop application development server (powered by Tauri):

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
  Email
  Components
  Documentation
```

## Aliases

For Laravel developers familiar with `artisan serve`:

```bash
buddy serve              # alias for buddy dev
buddy serve:components   # alias for buddy dev:components
buddy serve:desktop      # alias for buddy dev:desktop
buddy serve:views        # alias for buddy dev:views
buddy serve:functions    # alias for buddy dev:functions
buddy serve:docs         # alias for buddy dev:docs
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

Stacks provides pretty development URLs out of the box:

- `https://your-project.localhost` instead of `http://localhost:3000`

This is configured automatically based on your `APP_URL` environment variable.

## Troubleshooting

### Port Already in Use

If you see an error about port being in use:

```bash
# Check which process is using the port
buddy ports

# Or use a different port in your configuration
```

### SSL Certificate Issues

Development servers use HTTPS with self-signed certificates. If your browser shows a warning:

1. Click "Advanced" or "Details"
2. Click "Proceed" or "Accept the Risk"

### Server Won't Start

1. Ensure all dependencies are installed: `buddy install`
2. Check for syntax errors in your configuration files
3. Run with verbose mode: `buddy dev --verbose`

## Related Commands

- [buddy build](/guide/buddy/build) - Build for production
- [buddy test](/guide/buddy/test) - Run tests
- [buddy lint](/guide/buddy/lint) - Lint your code
