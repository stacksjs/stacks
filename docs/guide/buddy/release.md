# Release Command

The `buddy release` command creates and publishes new versions of your libraries and packages, triggering the CI/CD release workflow.

## Basic Usage

```bash
buddy release
```

## Command Syntax

```bash
buddy release [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Run the release without actually releasing |
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## Release Process

When you run `buddy release`, Stacks:

1. **Validates** the current git state
2. **Determines** the next version (based on commits)
3. **Updates** version numbers in package files
4. **Generates** changelog entries
5. **Creates** git tag
6. **Triggers** GitHub Actions release workflow
7. **Publishes** packages to npm

## Examples

### Standard Release

```bash
buddy release
```

Output:
```
buddy release

Triggered CI/CD Release via GitHub Actions

Follow along: https://github.com/stacksjs/stacks/actions

Completed in 1.23s
```

### Dry Run

Preview what would happen without making changes:

```bash
buddy release --dry-run
```

### Verbose Release

```bash
buddy release --verbose
```

## Version Determination

Versions are determined automatically based on conventional commits:

| Commit Type | Version Bump |
|-------------|--------------|
| `fix:` | Patch (0.0.X) |
| `feat:` | Minor (0.X.0) |
| `feat!:` or `BREAKING CHANGE` | Major (X.0.0) |

### Examples

```
fix: resolve login issue       -> 1.0.0 to 1.0.1
feat: add new dashboard        -> 1.0.1 to 1.1.0
feat!: redesign API            -> 1.1.0 to 2.0.0
```

## Pre-release Checklist

Before releasing:

1. **All tests pass**
   ```bash
   buddy test
   ```

2. **Code is linted**
   ```bash
   buddy lint
   ```

3. **Types are valid**
   ```bash
   buddy test:types
   ```

4. **Working directory is clean**
   ```bash
   git status
   ```

5. **On the correct branch**
   ```bash
   git branch
   ```

## CI/CD Integration

The release command triggers a GitHub Actions workflow that:

1. Runs all tests
2. Builds all packages
3. Publishes to npm
4. Creates GitHub release
5. Updates documentation

### Workflow Configuration

The release workflow is defined in `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      - run: bun run test
      - run: npm publish
```

## npm Publishing

Ensure npm is configured for publishing:

```bash
# Login to npm
npm login

# Or use token in CI
NPM_TOKEN=your-token
```

## Changelog Generation

Releases automatically update `CHANGELOG.md`:

```markdown
## [1.2.0] - 2024-01-15

### Features
- Add user dashboard (#123)
- Implement dark mode (#124)

### Bug Fixes
- Fix login timeout issue (#125)
```

## Troubleshooting

### Dirty Working Directory

```
Error: Working directory is not clean
```

**Solution**: Commit or stash changes:
```bash
git add .
buddy commit
# or
git stash
```

### Not on Main Branch

```
Error: Must be on main branch to release
```

**Solution**: Switch to main:
```bash
git checkout main
git pull
buddy release
```

### npm Publish Failed

```
Error: npm publish failed
```

**Solutions**:
1. Check npm login: `npm whoami`
2. Verify package name is available
3. Check npm token permissions

### No Commits to Release

```
Error: No new commits since last release
```

**Solution**: Ensure you have conventional commits:
```bash
buddy commit
buddy release
```

### GitHub Actions Failed

Check the Actions tab in GitHub for details:
```
https://github.com/your-repo/actions
```

## Best Practices

### Use Dry Run First

```bash
# Preview the release
buddy release --dry-run

# If everything looks good
buddy release
```

### Keep Main Branch Clean

```bash
# Always work in feature branches
git checkout -b feature/my-feature

# Merge to main when ready
git checkout main
git merge feature/my-feature

# Then release
buddy release
```

### Write Good Commit Messages

Following conventional commits ensures proper versioning:

```bash
# Good
feat(auth): add OAuth2 support
fix(ui): resolve modal z-index issue

# Bad
update stuff
fix bug
```

### Release Frequently

Small, frequent releases are better than large, infrequent ones:
- Easier to debug issues
- Faster feedback
- Lower risk

## Related Commands

- [buddy commit](/guide/buddy/commit) - Create conventional commits
- [buddy changelog](/guide/buddy/changelog) - Generate changelog
- [buddy build](/guide/buddy/build) - Build packages
