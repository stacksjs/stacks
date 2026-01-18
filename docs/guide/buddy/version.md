# Version Command

The `buddy version` command displays version information for your Stacks project, including the framework version and Bun runtime version.

## Basic Usage

```bash
buddy version
```

## Command Syntax

```bash
buddy version
```

There are no additional options for this command.

## Example

```bash
buddy version
```

Output:
```
buddy version

@stacksjs/    1.0.0
Bun:          1.0.25

Completed in 0.05s
```

## Information Displayed

### Stacks Version

The version of the Stacks framework installed in your project:

```
@stacksjs/    1.0.0
```

This is read from your project's `package.json` file.

### Bun Version

The version of the Bun runtime:

```
Bun:          1.0.25
```

## Use Cases

### Verify Installation

After installing or upgrading:

```bash
buddy version
```

### Bug Reports

Include version information in bug reports:

```bash
# Capture version info
buddy version > version-info.txt
```

### Compatibility Check

Verify version compatibility with documentation:

```bash
buddy version
# Compare with required versions in docs
```

### Pre-Deployment Check

Verify versions before deploying:

```bash
buddy version
buddy test
buddy deploy
```

## Version Comparison

### Check for Updates

Compare your version with the latest:

```bash
# Current version
buddy version

# Check for updates
buddy outdated
```

### Required Versions

Check if your versions meet requirements:

| Component | Minimum Version |
|-----------|-----------------|
| Stacks | 1.0.0 |
| Bun | 1.0.0 |

## CLI Version

You can also check the version using flags:

```bash
buddy --version
buddy -v
```

Output:
```
stacks 1.0.0
```

## Package Versions

To see versions of all Stacks packages:

```bash
# List all @stacksjs packages
bun pm ls | grep @stacksjs
```

Output:
```
@stacksjs/actions@1.0.0
@stacksjs/cli@1.0.0
@stacksjs/config@1.0.0
@stacksjs/database@1.0.0
...
```

## Version in package.json

Your project version is defined in `package.json`:

```json
{
  "name": "my-stacks-project",
  "version": "1.0.0",
  "dependencies": {
    "@stacksjs/stacks": "^1.0.0"
  }
}
```

## Semantic Versioning

Stacks follows semantic versioning (semver):

- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, backward compatible

### Version Ranges

In `package.json`:

```json
{
  "dependencies": {
    // Exact version
    "@stacksjs/core": "1.0.0",

    // Compatible versions (1.x.x)
    "@stacksjs/core": "^1.0.0",

    // Patch versions only (1.0.x)
    "@stacksjs/core": "~1.0.0",

    // Latest
    "@stacksjs/core": "latest"
  }
}
```

## Troubleshooting

### Version Not Showing

```
Error: Unable to read version
```

**Solutions**:
1. Ensure you're in a Stacks project
2. Check `package.json` exists and is valid
3. Run `buddy install`

### Outdated Version

If your version is outdated:

```bash
buddy upgrade
```

### Version Mismatch

If versions don't match expectations:

```bash
# Clean and reinstall
buddy fresh

# Verify
buddy version
```

## CI/CD Usage

### Log Version in CI

```yaml
# .github/workflows/ci.yml
- name: Log versions
  run: buddy version
```

### Version-Based Deployment

```yaml
- name: Get version
  id: version
  run: echo "version=$(buddy version | grep @stacksjs | awk '{print $2}')" >> $GITHUB_OUTPUT

- name: Deploy
  run: |
    echo "Deploying version ${{ steps.version.outputs.version }}"
    buddy deploy
```

## Programmatic Access

Access version in your code:

```typescript
import { version } from '@stacksjs/stacks'

console.log(`Running Stacks v${version}`)
```

Or from package.json:

```typescript
import pkg from './package.json'

console.log(`App version: ${pkg.version}`)
```

## Version History

View version history:

```bash
# Git tags
git tag -l

# Changelog
cat CHANGELOG.md
```

## Related Commands

- [buddy upgrade](/guide/buddy/upgrade) - Upgrade versions
- [buddy list](/guide/buddy/intro) - List all commands
- [buddy changelog](/guide/buddy/changelog) - View changelog
