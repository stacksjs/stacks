# Commit Command

The `buddy commit` command provides an interactive interface for creating conventional commits with proper formatting and messages.

## Basic Usage

```bash
buddy commit
```

## Command Syntax

```bash
buddy commit [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## Interactive Commit Flow

When you run `buddy commit`, you are guided through an interactive process:

1. **Select commit type** (feat, fix, docs, etc.)
2. **Enter scope** (optional component/area)
3. **Write description** (short summary)
4. **Add body** (optional detailed description)
5. **Note breaking changes** (if any)
6. **Reference issues** (optional)

## Commit Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, semicolons) |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `build` | Build system changes |
| `ci` | CI configuration changes |
| `chore` | Other changes (maintenance) |
| `revert` | Reverting a previous commit |

## Examples

### Basic Commit

```bash
buddy commit
```

Interactive prompts:
```
? Select the type of change: feat
? What is the scope? (optional): auth
? Write a short description: add OAuth2 login support
? Provide a longer description? (optional): 
? Are there any breaking changes? No
? Does this commit close any issues? #123

# Creates commit:
# feat(auth): add OAuth2 login support
#
# Closes #123
```

### Commit After Staging

```bash
# Stage your changes first
git add .

# Then commit
buddy commit
```

### Commit with Verbose Output

```bash
buddy commit --verbose
```

## Commit Message Format

Commits follow the Conventional Commits specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Examples

**Simple commit:**
```
feat: add user authentication
```

**Commit with scope:**
```
fix(api): resolve race condition in database queries
```

**Commit with body:**
```
refactor(components): simplify modal state management

- Remove redundant state variables
- Consolidate event handlers
- Improve TypeScript types
```

**Breaking change:**
```
feat(api)!: change response format for user endpoints

BREAKING CHANGE: The user endpoint now returns an array instead of an object.
Clients need to update their parsing logic.
```

## Integration with Git Hooks

Stacks configures commit message validation via git hooks. Invalid commit messages are rejected automatically.

## Best Practices

### Write Good Descriptions

**Good:**
```
feat(auth): add password reset functionality
fix(ui): prevent button from submitting twice
```

**Bad:**
```
feat: stuff
fix: fix bug
```

### Use Meaningful Scopes

Common scopes:
- `api` - API changes
- `ui` - User interface
- `auth` - Authentication
- `db` - Database
- `config` - Configuration
- `deps` - Dependencies

### Reference Issues

Always reference related issues:
```
fix(auth): resolve login timeout issue

Fixes #456
```

### Breaking Changes

Mark breaking changes clearly:
```
feat(api)!: update authentication flow

BREAKING CHANGE: Access tokens now expire after 1 hour instead of 24 hours.
```

## Troubleshooting

### Nothing to Commit

```
Error: Nothing to commit
```

**Solution**: Stage changes first:
```bash
git add .
buddy commit
```

### Commit Hook Failed

If the commit hook rejects your message:

1. Review the error message
2. Ensure you're using a valid commit type
3. Check that the description is not empty
4. Run `buddy commit` to use the interactive mode

### Reverting a Commit

To undo the last commit:
```bash
git reset --soft HEAD~1
```

To create a revert commit:
```bash
git revert HEAD
```

## Workflow Example

```bash
# 1. Make changes to your code
# ...

# 2. Stage changes
git add src/auth/

# 3. Commit with buddy
buddy commit
# Select: feat
# Scope: auth
# Description: add two-factor authentication

# 4. Push changes
git push
```

## Related Commands

- [buddy release](/guide/buddy/release) - Create releases
- [buddy changelog](/guide/buddy/changelog) - Generate changelog
- [buddy lint](/guide/buddy/lint) - Lint code before committing
