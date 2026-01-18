# Lint Command

The `buddy lint` command analyzes your codebase for code quality issues, style violations, and potential bugs using the Pickier linter.

## Basic Usage

```bash
# Run linter
buddy lint

# Run linter and fix issues automatically
buddy lint --fix
```

## Command Syntax

```bash
buddy lint [options]
buddy lint:fix [options]
buddy format [options]
buddy format:check [options]
```

### Lint Options

| Option | Description |
|--------|-------------|
| `-f, --fix` | Automatically fix lint errors |
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

### Format Options

| Option | Description |
|--------|-------------|
| `-w, --write` | Write changes to files |
| `-c, --check` | Check formatting without making changes |
| `--verbose` | Enable verbose output |

## Available Commands

### Lint

Check for code quality issues:

```bash
buddy lint
```

### Lint with Auto-fix

Check and automatically fix issues:

```bash
buddy lint --fix
# or
buddy lint:fix
```

### Format

Format code according to style rules:

```bash
buddy format
```

### Format Check

Check formatting without modifying files:

```bash
buddy format --check
# or
buddy format:check
```

## Examples

### Run Linter

```bash
buddy lint
```

Output:
```
buddy lint

src/components/Button.vue
  12:5  error  Unexpected console statement  no-console
  24:1  error  Missing return type           @typescript-eslint/explicit-function-return-type

2 problems (2 errors, 0 warnings)

Linted your project

Completed in 2.34s
```

### Fix All Issues

```bash
buddy lint:fix
```

### Format Code

```bash
buddy format
```

### Check Formatting Only

```bash
buddy format:check
```

## Configuration

Linting is configured via `pickier.config.ts` in your project root:

```typescript
// pickier.config.ts
export default {
  rules: {
    // TypeScript rules
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',

    // Vue rules
    'vue/multi-word-component-names': 'off',
    'vue/require-default-prop': 'warn',

    // General rules
    'no-console': 'warn',
    'no-debugger': 'error',
  },

  ignores: [
    'node_modules',
    'dist',
    'coverage',
  ],
}
```

## What Gets Linted

By default, the linter checks:

- TypeScript files (`.ts`, `.tsx`)
- Vue components (`.vue`)
- JavaScript files (`.js`, `.jsx`)
- Configuration files

## Common Rules

### TypeScript

| Rule | Description |
|------|-------------|
| `no-unused-vars` | Disallow unused variables |
| `explicit-function-return-type` | Require return types |
| `no-explicit-any` | Disallow `any` type |
| `strict-boolean-expressions` | Require strict boolean checks |

### Vue

| Rule | Description |
|------|-------------|
| `require-default-prop` | Require default values for props |
| `no-v-html` | Disallow v-html directive |
| `component-name-in-template-casing` | Enforce component name casing |

### General

| Rule | Description |
|------|-------------|
| `no-console` | Disallow console statements |
| `no-debugger` | Disallow debugger statements |
| `eqeqeq` | Require === and !== |

## IDE Integration

Stacks provides excellent IDE integration:

### VS Code

Install the ESLint extension for real-time linting feedback.

Settings are pre-configured in `.vscode/settings.json`:

```json
{
  "eslint.validate": [
    "javascript",
    "typescript",
    "vue"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Pre-commit Hooks

Stacks automatically sets up pre-commit hooks to lint staged files:

```bash
# When you commit, linting runs automatically
git commit -m "feat: add new feature"

# If linting fails, the commit is blocked
```

## Troubleshooting

### Lint Takes Too Long

For large projects:

```bash
# Lint specific directory
buddy lint src/

# Or increase timeout
buddy lint --timeout 60000
```

### Rule Conflicts

If you encounter conflicting rules:

1. Check `pickier.config.ts` for custom rules
2. Disable specific rules for a file:

```typescript
// eslint-disable-next-line no-console
console.log('Debugging')
```

### Can't Auto-fix

Some issues cannot be auto-fixed and require manual intervention:

- Complex type errors
- Unused variable removal (safety check)
- Breaking logic changes

### Ignoring Files

Add patterns to ignore in config:

```typescript
// pickier.config.ts
export default {
  ignores: [
    'node_modules',
    'dist',
    '**/*.generated.ts',
    'coverage',
  ],
}
```

## Best Practices

### Run Before Committing

```bash
buddy lint:fix && buddy commit
```

### CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/ci.yml
- name: Lint
  run: buddy lint
```

### Fix Issues Progressively

For large codebases:

1. Start with `warn` level for new rules
2. Fix warnings gradually
3. Change to `error` level once clean

## Related Commands

- [buddy test](/guide/buddy/test) - Run tests
- [buddy commit](/guide/buddy/commit) - Commit changes
- [buddy build](/guide/buddy/build) - Build project
