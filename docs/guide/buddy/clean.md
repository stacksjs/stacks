# Clean Command

The `buddy clean` command removes all node_modules directories and lock files from your project, providing a clean slate for dependency reinstallation.

## Basic Usage

```bash
buddy clean
```

## Command Syntax

```bash
buddy clean [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## What Gets Cleaned

The clean command removes:

- All `node_modules` directories (root and nested)
- Lock files (`bun.lockb`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`)
- Build cache directories
- Temporary files

## Interactive Confirmation

By default, the clean command asks for confirmation before proceeding:

```bash
$ buddy clean

? This will remove all node_modules and lock files. Continue? (y/N)
```

### Skip Confirmation

To skip the confirmation prompt (useful in CI/CD):

```bash
buddy clean --force
# or
buddy clean --no-interaction
```

## Examples

### Clean with Verbose Output

```bash
buddy clean --verbose
```

This shows detailed information about what's being removed.

### Clean Specific Project

```bash
buddy clean -p my-project
```

### Clean in CI/CD Pipeline

```bash
buddy clean --no-interaction
```

## Use Cases

### Fresh Dependency Installation

When you want to completely reinstall all dependencies:

```bash
buddy clean
buddy install
```

### Troubleshooting Dependency Issues

If you're experiencing strange behavior due to cached or corrupted dependencies:

```bash
buddy clean
buddy install
```

### Switching Package Managers

When switching between package managers (npm, yarn, pnpm, bun):

```bash
buddy clean
# Switch to new package manager
buddy install
```

### Reducing Disk Space

To free up disk space by removing node_modules:

```bash
buddy clean
```

## Comparison with Fresh

| Command | Description |
|---------|-------------|
| `buddy clean` | Only removes dependencies and lock files |
| `buddy fresh` | Removes dependencies AND reinstalls them |

If you want to clean and immediately reinstall:

```bash
# Option 1: Two commands
buddy clean && buddy install

# Option 2: Use fresh command
buddy fresh
```

## Troubleshooting

### Permission Denied

If you encounter permission errors:

```bash
sudo buddy clean
```

Or fix permissions first:

```bash
sudo chown -R $(whoami) node_modules
buddy clean
```

### Files Still Present After Clean

Some files may be locked by running processes:

1. Stop all development servers
2. Close your IDE
3. Run `buddy clean` again

### Clean Takes Too Long

For large projects with many nested node_modules:

```bash
# Use verbose to see progress
buddy clean --verbose
```

## Related Commands

- [buddy fresh](/guide/buddy/fresh) - Clean and reinstall dependencies
- [buddy install](/guide/buddy/intro) - Install dependencies
- [buddy upgrade](/guide/buddy/upgrade) - Upgrade dependencies
