# Fresh Command

The `buddy fresh` command performs a clean reinstallation of all npm dependencies, removing existing node_modules and lock files before installing fresh copies.

## Basic Usage

```bash
buddy fresh
```

## Command Syntax

```bash
buddy fresh [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## What Happens

The fresh command performs these steps in order:

1. **Removes** all `node_modules` directories
2. **Removes** lock files (`bun.lockb`, etc.)
3. **Clears** package manager caches
4. **Installs** all dependencies fresh

## Interactive Confirmation

By default, fresh asks for confirmation:

```bash
$ buddy fresh

? This will remove and reinstall all dependencies. Continue? (y/N)
```

### Skip Confirmation

```bash
buddy fresh --force
# or
buddy fresh --no-interaction
```

## Examples

### Fresh Install with Verbose Output

```bash
buddy fresh --verbose
```

### Fresh Install for Specific Project

```bash
buddy fresh -p my-project
```

### CI/CD Usage

```bash
buddy fresh --no-interaction
```

## Use Cases

### Resolving Dependency Conflicts

When you encounter dependency resolution issues:

```bash
buddy fresh
```

### After Merging Branches

After merging a branch with significant dependency changes:

```bash
git pull origin main
buddy fresh
```

### Updating Lock Files

To regenerate lock files with the latest compatible versions:

```bash
buddy fresh
```

### Clearing Corrupted Caches

When experiencing strange behavior from cached packages:

```bash
buddy fresh --verbose
```

### After Changing Bun/Node Version

When you've upgraded your JavaScript runtime:

```bash
buddy fresh
```

## Comparison with Clean

| Command | Removes Dependencies | Reinstalls |
|---------|---------------------|------------|
| `buddy clean` | Yes | No |
| `buddy fresh` | Yes | Yes |

## Performance

The fresh command may take several minutes depending on:

- Number of dependencies
- Network speed
- Package manager cache state

For faster subsequent installs, Bun caches packages locally.

## Troubleshooting

### Installation Fails After Clean

If installation fails after cleaning:

```bash
# Check for sufficient disk space
df -h

# Verify network connectivity
ping registry.npmjs.org

# Try with verbose output
buddy fresh --verbose
```

### Permission Errors

```bash
# Fix ownership
sudo chown -R $(whoami) .

# Retry
buddy fresh
```

### Specific Package Fails

If a specific package fails to install:

```bash
# Try installing dependencies manually
bun install

# Check the package's repository for known issues
```

### Lock File Conflicts

If you have conflicts in lock files:

```bash
# Remove conflicting lock files
rm bun.lockb package-lock.json yarn.lock pnpm-lock.yaml

# Fresh install
buddy fresh
```

## Best Practices

### When to Use Fresh

- After major dependency updates
- When experiencing unexplained build errors
- After merging branches with dependency changes
- When switching between branches with different dependencies

### When NOT to Use Fresh

- For routine development (use `buddy install` instead)
- When you need to preserve exact lock file versions
- In production deployments (use `buddy install` with lock file)

## Related Commands

- [buddy clean](/guide/buddy/clean) - Remove dependencies without reinstalling
- [buddy install](/guide/buddy/intro) - Install dependencies
- [buddy upgrade](/guide/buddy/upgrade) - Upgrade dependencies
