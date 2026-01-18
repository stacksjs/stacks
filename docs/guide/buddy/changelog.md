# Changelog Command

The `buddy changelog` command generates a `CHANGELOG.md` file based on your conventional commit history, providing a clear record of changes across versions.

## Basic Usage

```bash
buddy changelog
```

## Command Syntax

```bash
buddy changelog [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-q, --quiet` | Minimal output |
| `-d, --dry-run` | Output changes without writing to file |
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## Examples

### Generate Changelog

```bash
buddy changelog
```

Output:
```
buddy changelog

Generated CHANGELOG.md

Completed in 0.89s
```

### Preview Changes (Dry Run)

```bash
buddy changelog --dry-run
```

This shows what would be written without modifying the file.

### Quiet Mode

```bash
buddy changelog --quiet
```

Minimal output, useful for CI/CD.

### Verbose Output

```bash
buddy changelog --verbose
```

Shows detailed information about processing.

## Changelog Format

The generated changelog follows the Keep a Changelog format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.2.0] - 2024-01-15

### Added
- Add user dashboard (#123)
- Implement dark mode (#124)

### Fixed
- Fix login timeout issue (#125)
- Resolve database connection leak (#126)

### Changed
- Update dependency versions
- Improve error messages

## [1.1.0] - 2024-01-01

### Added
- Initial authentication system
- Basic CRUD operations
```

## Commit Type Mapping

Conventional commits are mapped to changelog sections:

| Commit Type | Changelog Section |
|-------------|-------------------|
| `feat` | Added |
| `fix` | Fixed |
| `docs` | Documentation |
| `style` | Changed |
| `refactor` | Changed |
| `perf` | Performance |
| `test` | Testing |
| `build` | Build |
| `ci` | CI |
| `chore` | Maintenance |
| `revert` | Reverted |

## Breaking Changes

Breaking changes are highlighted prominently:

```markdown
## [2.0.0] - 2024-02-01

### BREAKING CHANGES
- API response format changed from object to array
- Removed deprecated authentication methods

### Added
- New REST API endpoints
```

## Configuration

Changelog generation can be configured in your project:

```typescript
// config/changelog.ts
export default {
  // Sections to include
  sections: ['Added', 'Fixed', 'Changed', 'Removed'],

  // Skip certain types
  skipTypes: ['chore', 'ci'],

  // Custom header
  header: '# Project Changelog\n\nAll notable changes are documented here.',
}
```

## Workflow Integration

### Before Releases

Generate changelog before releasing:

```bash
buddy changelog
buddy release
```

### Automated Updates

In CI/CD, update changelog automatically:

```yaml
# .github/workflows/release.yml
- name: Generate Changelog
  run: buddy changelog

- name: Commit Changelog
  run: |
    git add CHANGELOG.md
    git commit -m "docs: update changelog"
    git push
```

## Best Practices

### Write Good Commit Messages

The changelog quality depends on commit messages:

**Good commits produce good changelogs:**
```
feat(auth): add two-factor authentication support

- Add TOTP generation
- Add backup codes
- Add QR code display
```

**Bad commits produce unclear changelogs:**
```
update auth
fix stuff
```

### Use Scopes

Scopes help organize the changelog:

```
feat(api): add rate limiting
feat(ui): implement dark mode
fix(auth): resolve token expiration bug
```

### Reference Issues

Link to issues for more context:

```
fix(cart): resolve checkout race condition (#456)
```

### Keep Entries Concise

Good changelog entries are:
- Clear and concise
- Written in imperative mood
- Focused on the "what", not "how"

## Troubleshooting

### No Commits Found

```
Warning: No commits found since last release
```

**Solution**: Ensure you have conventional commits:
```bash
# Check recent commits
git log --oneline -10

# Make commits with proper format
buddy commit
```

### File Permission Error

```
Error: Cannot write to CHANGELOG.md
```

**Solution**:
```bash
chmod 644 CHANGELOG.md
buddy changelog
```

### Missing Version Tags

```
Warning: No version tags found
```

**Solution**: Create an initial tag:
```bash
git tag v0.0.1
buddy changelog
```

### Incorrect Dates

Dates come from git tags. If incorrect:
```bash
# Check tag dates
git tag -l --format='%(refname:short) %(creatordate:short)'
```

## Manual Editing

While the changelog is auto-generated, you can manually edit it:

1. Run `buddy changelog`
2. Review `CHANGELOG.md`
3. Add clarifications or context
4. Keep edits in dedicated sections

```markdown
## [1.2.0] - 2024-01-15

### Added
- Add user dashboard (#123)

### Notes
> This release includes significant UI improvements.
> Please report any issues via GitHub.
```

## Related Commands

- [buddy commit](/guide/buddy/commit) - Create conventional commits
- [buddy release](/guide/buddy/release) - Create releases
- [buddy version](/guide/buddy/version) - View version information
