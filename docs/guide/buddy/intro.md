# Buddy CLI

Buddy is the official command-line interface for the Stacks framework. It provides a comprehensive set of commands to help you develop, build, test, and deploy your Stacks applications with ease.

## Overview

The Buddy CLI is designed with developer experience in mind, following the "convention over configuration" philosophy. It provides sensible defaults while remaining highly configurable for advanced use cases.

## Installation

Buddy comes pre-installed with every Stacks project. When you create a new Stacks project, Buddy is automatically available:

```bash
# Create a new Stacks project
bunx stacks new my-project

# Navigate to your project
cd my-project

# Buddy is now available
buddy --help
```

### Global Installation

You can also install Buddy globally for system-wide access:

```bash
bun install -g @stacksjs/buddy
```

## Configuration

Buddy automatically reads configuration from your project's config files. Most commands work out of the box without any additional setup.

### Project Configuration

Buddy respects your project's configuration files located in the `config/` directory:

- `config/app.ts` - Application settings
- `config/database.ts` - Database configuration
- `config/cloud.ts` - Cloud deployment settings
- `config/dns.ts` - DNS configuration

## CLI Aliases

Buddy can be invoked using any of the following aliases:

```bash
buddy fresh    # Full command name
bud fresh      # Short alias
stx fresh      # Alternative alias
```

## Command Structure

Buddy commands follow a consistent structure:

```bash
buddy <command> [subcommand] [arguments] [options]
```

### Common Options

Most commands support these common options:

| Option | Description |
|--------|-------------|
| `--help` | Display help information for the command |
| `--verbose` | Enable verbose output for debugging |
| `-p, --project [project]` | Target a specific project |

## Getting Help

To see all available commands:

```bash
buddy --help
```

To get help for a specific command:

```bash
buddy <command> --help
```

## Quick Reference

Here are some of the most commonly used commands:

```bash
# Development
buddy dev              # Start development server
buddy dev:api          # Start API development server
buddy dev:docs         # Start documentation server

# Building
buddy build            # Build for production
buddy build:components # Build component library

# Database
buddy migrate          # Run database migrations
buddy seed             # Seed database with data

# Testing
buddy test             # Run test suite
buddy lint             # Run linter

# Deployment
buddy deploy           # Deploy to cloud
buddy cloud:remove     # Remove cloud infrastructure
```

## Troubleshooting

### Command Not Found

If you encounter a "command not found" error:

1. Ensure you're in a Stacks project directory
2. Run `buddy install` to install dependencies
3. Check that Bun is properly installed

### Permission Issues

Some commands may require elevated permissions:

```bash
sudo buddy upgrade:binary  # Upgrade the Buddy binary
```

### Verbose Mode

Enable verbose mode to see detailed output for debugging:

```bash
buddy <command> --verbose
```

## Learn More

Explore the individual command documentation for detailed information:

- [Development Server](/guide/buddy/dev) - Start dev servers
- [Build Commands](/guide/buddy/build) - Build for production
- [Database Commands](/guide/buddy/migrate) - Manage database
- [Testing Commands](/guide/buddy/test) - Run tests
- [Deployment](/guide/buddy/deploy) - Deploy applications
