---
title: Upgrade Command
description: "The  command upgrades your project's dependencies, the Stacks framework, Bun runtime, and shell integrations to their latest versions."
---
# Upgrade Command

The `buddy upgrade` command upgrades your project's dependencies, the Stacks framework, Bun runtime, and shell integrations to their latest versions.

## Basic Usage

```bash
# Upgrade the Stacks framework
buddy upgrade

# Upgrade everything (framework, dependencies, Bun & binary)
buddy upgrade:all
```

## Command Syntax

```bash
buddy upgrade [options]
buddy upgrade:<type> [options]
```

`buddy update` is an alias for `buddy upgrade`.

### Options

| Option | Description |
|--------|-------------|
| `-v, --version <version>` | Install a specific version (e.g., 0.70.23) |
| `--canary` | Upgrade to the latest canary (bleeding-edge `main`) build |
| `--stable` | Switch to the latest vetted stable release |
| `--dry-run` | Preview which dependencies would change without writing or installing |
| `-f, --force` | Force re-download, bypassing cache and version checks |
| `--from <path>` | Sync from a local stacks checkout (e.g. ~/Code/stacks), skips GitHub |
| `--no-postinstall` | Skip post-sync hooks (auto-imports, bun install, migrate) |
| `--verbose` | Enable verbose output |

## Available Upgrade Commands

### Upgrade Framework

Run without a subcommand to upgrade the Stacks framework to the latest version:

```bash
buddy upgrade
```

### Upgrade All

Upgrade framework, dependencies, Bun, and binary at once:

```bash
buddy upgrade:all
```

### Upgrade Dependencies

Update package.json and pantry.yaml dependencies:

```bash
buddy upgrade:dependencies
# or
buddy upgrade:deps
```

### Upgrade Bun

Upgrade to the latest Bun version:

```bash
buddy upgrade:bun
```

### Upgrade Shell Integration

Update shell completions and aliases:

```bash
buddy upgrade:shell
```

### Upgrade Binary

Upgrade the global `stacks` binary (requires sudo):

```bash
sudo buddy upgrade:binary
```

## Examples

### Full Upgrade

```bash
buddy upgrade:all
```

Output:

```
buddy upgrade:all

Upgrading dependencies...
Upgrading framework...
Upgrading Bun...

All upgrades complete.

Completed in 45.23s
```

### Upgrade with Verbose Output

```bash
buddy upgrade:all --verbose
```

### Force Framework Update

Force a re-download of the framework, bypassing cache and version checks:

```bash
buddy upgrade --force
```

### Upgrade Specific Project

```bash
buddy upgrade:dependencies -p my-project
```

## What Gets Upgraded

### Dependencies

- npm packages in `package.json`
- Pantry modules in `pantry.yaml`
- Development dependencies
- Peer dependencies

### Framework

- Core Stacks packages
- Framework utilities
- Type definitions
- Configuration defaults

### Bun Runtime

- Bun version matching project requirements
- Bun dependencies and lockfile

### Shell Integration

- Oh My Zsh plugin
- Command completions
- Shell aliases

### Binary

- Global `stacks` command
- CLI utilities

## Update Strategy

### Minor and Patch Updates

By default, upgrades to compatible versions:

```
express: ^4.17.0 -> ^4.18.2
```

### Major Updates

Major version updates require confirmation:

```
? Upgrade express from 4.x to 5.x? (Breaking changes may occur)
```

### Security Updates

Security-related updates are prioritized:

```
! express 4.17.0 has known vulnerabilities
  Upgrading to 4.17.3 (security fix)
```

## Pre-Upgrade Checklist

Before upgrading:

1. **Commit current changes**

   ```bash
   git add . && git commit -m "chore: pre-upgrade snapshot"
   ```

2. **Run tests**

   ```bash
   buddy test
   ```

3. **Check for breaking changes**

   ```bash
   buddy outdated
   ```

## Post-Upgrade Steps

After upgrading:

1. **Install new dependencies**

   ```bash
   buddy install
   ```

2. **Run tests**

   ```bash
   buddy test
   ```

3. **Check for deprecation warnings**

   ```bash
   buddy dev --verbose
   ```

4. **Update configurations** (if needed)

## Troubleshooting

### Upgrade Fails

```
Error: Failed to upgrade dependencies
```

**Solutions**:

1. Clear package cache: `buddy clean`
2. Fresh install: `buddy fresh`
3. Try with verbose: `buddy upgrade --verbose`

### Compatibility Issues

```
Error: Peer dependency conflict
```

**Solutions**:

1. Check conflicting packages
2. Update related packages together
3. Use `--force` flag (with caution)

### Binary Upgrade Permission

```
Error: Permission denied
```

**Solution**: Run with sudo:

```bash
sudo buddy upgrade:binary
```

### Shell Integration Issues

```
Error: Shell integration failed
```

**Solutions**:

1. Ensure Oh My Zsh is installed
2. Check shell configuration file
3. Restart terminal after upgrade

### Bun Version Mismatch

```
Warning: Bun version mismatch
```

**Solution**: Upgrade Bun:

```bash
buddy upgrade:bun
```

## Rollback

If an upgrade causes issues:

### Restore from Git

```bash
# Restore package.json
git checkout HEAD -- package.json bun.lockb

# Reinstall
buddy install
```

### Restore Specific Package

```bash
# Install specific version
bun add express@4.17.0
```

### Framework Rollback

```bash
# Install specific framework version
bun add @stacksjs/core@1.0.0
```

## Automation

### Scheduled Upgrades

Create a script for regular upgrades:

```bash
# !/bin/bash
# upgrade-all.sh

echo "Checking for updates..."
buddy outdated

echo "Upgrading dependencies..."
buddy upgrade:dependencies

echo "Running tests..."
buddy test

if [ $? -eq 0 ]; then
  echo "All tests passed!"
  buddy commit -m "chore: upgrade dependencies"
else
  echo "Tests failed, rolling back..."
  git checkout -- package.json bun.lockb
  buddy install
fi
```

### CI/CD Integration

```yaml
# .github/workflows/upgrade.yml
name: Dependency Update

on:
  schedule:

    - cron: '0 0 * * 0' # Weekly

jobs:
  upgrade:
    runs-on: ubuntu-latest
    steps:

      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1

      - name: Upgrade dependencies

        run: buddy upgrade:dependencies

      - name: Run tests

        run: buddy test

      - name: Create PR

        uses: peter-evans/create-pull-request@v5
        with:
          title: 'chore: upgrade dependencies'
```

## Best Practices

### Regular Updates

Update dependencies regularly (weekly/monthly) to:

- Get security fixes
- Avoid large upgrade jumps
- Keep current with features

### Test After Upgrades

Always run tests after upgrading:

```bash
buddy upgrade:dependencies && buddy test
```

### Review Changelogs

Before major upgrades, review package changelogs for:

- Breaking changes
- Deprecations
- Migration guides

### Stage Upgrades

Test upgrades in staging before production:

```bash
# Staging
APP*ENV=staging buddy upgrade:all
buddy test

# Production (after verification)
APP*ENV=production buddy upgrade:all
```

## Related Commands

- [buddy fresh](/guide/buddy/fresh) - Fresh install
- [buddy clean](/guide/buddy/clean) - Clean dependencies
- [buddy version](/guide/buddy/version) - View versions
