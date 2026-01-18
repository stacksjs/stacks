# Build Command

The `buddy build` command compiles your Stacks application and libraries for production use, optimizing assets for deployment to npm, CDNs, or cloud providers.

## Basic Usage

```bash
# Interactive build - select what to build
buddy build

# Build specific target
buddy build components
```

## Command Syntax

```bash
buddy build [type] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `type` | Optional. Specify build target (components, vue, web-components, functions, views, docs, buddy, cli, stacks, server) |

### Options

| Option | Description |
|--------|-------------|
| `-c, --components` | Build your component library |
| `-v, --vue-components` | Build your Vue component library |
| `-w, --web-components` | Build your framework-agnostic web component library |
| `-e, --elements` | Alias for --web-components |
| `-f, --functions` | Build your function library |
| `-p, --views` | Build your frontend views |
| `--pages` | Alias for --views |
| `-d, --docs` | Build your documentation site |
| `-b, --buddy` | Build the Buddy binary |
| `-s, --stacks` | Build Stacks framework |
| `--server` | Build the Stacks cloud server (Docker image) |
| `--project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## Build Targets

### Components Library

Build both Vue and Web Component libraries:

```bash
buddy build:components
# or
buddy prod:components
```

This creates production-ready component libraries for distribution via npm or CDN.

### Vue Components

Build Vue 2 & 3 compatible component library:

```bash
buddy build:vue-components
# or
buddy build:vue
buddy prod:vue-components
buddy prod:vue
```

### Web Components

Build framework-agnostic Web Components (Custom Elements):

```bash
buddy build:web-components
# or
buddy build:wc
buddy prod:web-components
buddy prod:wc
```

### Functions Library

Build your function library for npm distribution:

```bash
buddy build:functions
```

### Frontend Views

Build your frontend for static site generation (SSG):

```bash
buddy build:views
```

### Documentation

Build your documentation site:

```bash
buddy build:docs
# or
buddy build:documentation
buddy prod:docs
buddy prod:documentation
```

### CLI

Build the Buddy CLI binary:

```bash
buddy build:cli
# or
buddy prod:cli
```

### Desktop Application

Build the desktop application using Tauri:

```bash
buddy build:desktop
# or
buddy prod:desktop
```

### Server Docker Image

Build the production server Docker image:

```bash
buddy build:server
# or
buddy prod:server
buddy build:docker
```

### Stacks Framework

Build the entire Stacks framework (for core developers):

```bash
buddy build:stacks
```

### Core Packages

Build core framework packages:

```bash
buddy build:core
```

## Production Aliases

The `prod` command is an alias for `build`:

```bash
buddy prod              # Same as buddy build
buddy prod:components   # Same as buddy build:components
buddy prod:desktop      # Same as buddy build:desktop
buddy prod:library      # Same as buddy build:library
buddy prod:views        # Same as buddy build:views
buddy prod:functions    # Same as buddy build:functions
buddy prod:vue-components
buddy prod:web-components
buddy prod:all
buddy production        # Same as buddy prod
```

## Examples

### Build Components with Verbose Output

```bash
buddy build:components --verbose
```

### Build Multiple Targets

```bash
# Build everything
buddy build:all

# Or build specific targets sequentially
buddy build:components && buddy build:functions && buddy build:docs
```

### Build for Specific Project

```bash
buddy build:views --project my-project
```

## Output Locations

Build outputs are placed in the following locations:

| Target | Output Directory |
|--------|-----------------|
| Vue Components | `dist/vue/` |
| Web Components | `dist/web-components/` |
| Functions | `dist/functions/` |
| Views | `dist/views/` |
| Documentation | `dist/docs/` |
| Desktop | `dist/desktop/` |

## Build Optimization

Stacks automatically applies production optimizations:

- **Minification** - JavaScript and CSS are minified
- **Tree Shaking** - Unused code is removed
- **Code Splitting** - Code is split into optimal chunks
- **Asset Optimization** - Images and assets are optimized
- **Compression** - Brotli and gzip compression support

## Troubleshooting

### Build Fails with Memory Error

For large projects, you may need to increase Node's memory limit:

```bash
NODE_OPTIONS="--max-old-space-size=4096" buddy build
```

### TypeScript Errors

If you encounter TypeScript errors during build:

```bash
# Run type checking first
buddy test:types

# Fix issues, then rebuild
buddy build
```

### Missing Dependencies

If build fails due to missing dependencies:

```bash
buddy install
buddy build
```

## Related Commands

- [buddy dev](/guide/buddy/dev) - Development server
- [buddy deploy](/guide/buddy/deploy) - Deploy to cloud
- [buddy test](/guide/buddy/test) - Run tests
