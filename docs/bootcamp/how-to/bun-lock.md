# Bun Lockfile Management

This guide covers managing Bun's lockfile (`bun.lock`) in your Stacks application, including best practices for version control, troubleshooting, and team collaboration.

## Understanding bun.lock

Bun uses a text-based lockfile format (`bun.lock`) that is human-readable and git-friendly. This format provides:

- **Human-readable** - Text-based JSONC format that can be inspected and diffed
- **Git-friendly** - Easy to review changes in pull requests
- **Integrity** - Contains checksums for all packages
- **Deterministic installs** - Ensures consistent dependencies across environments
- **Faster parsing** - Optimized for Bun's package resolution

::: tip Migration Note
If you have an older project with `bun.lockb` (binary format), Bun will automatically migrate to `bun.lock` when you run `bun install`. You can safely delete the old `bun.lockb` file after migration.
:::

## Basic Commands

### Installing Dependencies

```bash
# Install all dependencies from bun.lock
bun install

# Install with frozen lockfile (CI/CD)
bun install --frozen-lockfile

# Install and update lockfile
bun install

# Force fresh install (regenerate lockfile)
rm -rf node_modules bun.lock && bun install
```

### Updating Dependencies

```bash
# Update all dependencies
bun update

# Update specific package
bun update package-name

# Update to latest (ignore semver)
bun update package-name --latest
```

### Adding Dependencies

```bash
# Add production dependency
bun add package-name

# Add dev dependency
bun add -d package-name

# Add exact version
bun add package-name@1.2.3

# Add from git
bun add github:user/repo
```

### Removing Dependencies

```bash
# Remove package
bun remove package-name
```

## Version Control

### Git Configuration

Add to `.gitignore`:

```gitignore
# Node modules
node_modules/

# DO NOT ignore bun.lock - it should be committed
# bun.lock
```

::: info
Since `bun.lock` is now a text-based format, you no longer need special `.gitattributes` configuration. Git will handle it like any other text file.
:::

### Committing the Lockfile

Always commit `bun.lock` to version control:

```bash
git add bun.lock
git commit -m "chore: update dependencies"
```

### Viewing Lockfile Changes

Since `bun.lock` is text-based JSONC format, you can view changes directly:

```bash
# View lockfile changes
git diff bun.lock

# View lockfile changes in a PR
gh pr diff --name-only | grep bun.lock
```

The text format makes code review much easier - you can see exactly which packages changed and to what versions.

## CI/CD Configuration

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests
        run: bun test

      - name: Build
        run: bun run build
```

### Caching Dependencies

```yaml
- name: Cache Bun dependencies
  uses: actions/cache@v4
  with:
    path: ~/.bun/install/cache
    key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
    restore-keys: |
      ${{ runner.os }}-bun-
```

### Docker

```dockerfile
# Dockerfile
FROM oven/bun:1 as base

WORKDIR /app

# Copy lockfile and package.json for caching
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN bun run build

# Production
FROM oven/bun:1-slim
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
CMD ["bun", "run", "start"]
```

## Troubleshooting

### Lockfile Out of Sync

When lockfile doesn't match package.json:

```bash
# Error: lockfile does not match package.json
# Solution: Regenerate lockfile
bun install
```

### Corrupted or Invalid Lockfile

If the lockfile appears corrupted or has syntax errors:

```bash
# Remove and regenerate
rm bun.lock
bun install
```

::: tip
Since `bun.lock` is now text-based, you can often fix minor issues by editing the file directly. However, regenerating is usually safer.
:::

### Dependency Conflicts

When packages have conflicting versions:

```bash
# Check for conflicts
bun pm ls

# Use overrides in package.json
{
  "overrides": {
    "conflicting-package": "^1.0.0"
  }
}

# Regenerate lockfile
bun install
```

### Platform-Specific Issues

If lockfile works on one platform but not another:

```bash
# Install without optional dependencies
bun install --ignore-scripts

# Or specify platform
{
  "supportedArchitectures": {
    "os": ["darwin", "linux", "win32"],
    "cpu": ["x64", "arm64"]
  }
}
```

### Cache Issues

Clear Bun's cache if experiencing issues:

```bash
# Clear Bun cache
bun pm cache rm

# Fresh install
rm -rf node_modules
bun install
```

## Team Collaboration

### Synchronizing Dependencies

When pulling changes with lockfile updates:

```bash
# Always run install after pulling
git pull
bun install
```

### Resolving Merge Conflicts

When lockfile has merge conflicts:

```bash
# Accept one version and regenerate
git checkout --theirs bun.lock  # or --ours
bun install
git add bun.lock
git commit -m "resolve lockfile conflict"
```

Or regenerate fresh:

```bash
# Remove conflicted file
rm bun.lock

# Regenerate
bun install

# Commit
git add bun.lock
git commit -m "regenerate lockfile after merge"
```

::: tip
Since `bun.lock` is text-based, you can sometimes manually resolve conflicts by editing the file. However, regenerating is usually safer and faster.
:::

### Dependency Update Workflow

Recommended workflow for updating dependencies:

```bash
# 1. Create branch
git checkout -b deps/update-dependencies

# 2. Update dependencies
bun update

# 3. Run tests
bun test

# 4. Build to verify
bun run build

# 5. Commit changes
git add package.json bun.lock
git commit -m "chore: update dependencies"

# 6. Create PR
gh pr create
```

## Best Practices

### DO

- **Commit bun.lock** - Always include in version control
- **Use frozen lockfile in CI** - Ensures reproducible builds
- **Update regularly** - Keep dependencies current for security
- **Review lockfile changes** - Check what's being updated in PRs
- **Use exact versions for critical deps** - Avoid unexpected updates

### DON'T

- **Don't ignore the lockfile** - It ensures consistent installs
- **Don't delete without reinstalling** - Can cause version drift
- **Don't mix package managers** - Stick with Bun

::: tip
Unlike the old binary format, you can now safely inspect and even manually edit `bun.lock` if needed. The text-based format makes debugging dependency issues much easier.
:::

### Security

```bash
# Audit dependencies
bun pm audit

# Check for outdated packages
bun pm outdated
```

## Converting From Other Package Managers

### From npm

```bash
# Remove npm artifacts
rm -rf node_modules package-lock.json

# Install with Bun
bun install
```

### From yarn

```bash
# Remove yarn artifacts
rm -rf node_modules yarn.lock .yarn

# Install with Bun
bun install
```

### From pnpm

```bash
# Remove pnpm artifacts
rm -rf node_modules pnpm-lock.yaml

# Install with Bun
bun install
```

## Inspecting the Lockfile

### List Installed Packages

```bash
# List all packages
bun pm ls

# List specific package
bun pm ls package-name

# Show why a package is installed
bun pm why package-name
```

### Package Information

```bash
# Get package info
bun pm info package-name

# Check package versions
bun pm pack package-name
```

## Performance Tips

### Faster Installs

```bash
# Use concurrency (default)
bun install

# Skip optional dependencies
bun install --ignore-optional

# Skip postinstall scripts
bun install --ignore-scripts
```

### CI Optimization

```yaml
# Use caching and frozen lockfile
- run: bun install --frozen-lockfile
  env:
    BUN_INSTALL_CACHE_DIR: ~/.bun/install/cache
```

## Configuration

### bunfig.toml

```toml
# bunfig.toml

[install]
# Use exact versions by default
exact = true

# Registry configuration
registry = "https://registry.npmjs.org"

# Scoped registries
[install.scopes]
"@mycompany" = "https://npm.mycompany.com"

[install.cache]
# Cache directory
dir = "~/.bun/install/cache"

# Disable cache
# disable = true
```

### package.json Scripts

```json
{
  "scripts": {
    "preinstall": "npx only-allow bun",
    "postinstall": "bun run prepare"
  }
}
```

This documentation covers Bun lockfile management for Stacks applications. Each section is designed for reliable dependency management across development and production environments.
