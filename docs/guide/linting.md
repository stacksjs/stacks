# Linting & Formatting

Stacks provides built-in linting and formatting tools to maintain consistent code quality across your project. Based on ESLint and Prettier with sensible defaults.

## Overview

Stacks linting features:

- **Zero configuration** - Works out of the box
- **TypeScript-first** - Full TypeScript support
- **Vue support** - Lint Vue SFC files
- **Auto-fix** - Fix issues automatically
- **IDE integration** - Real-time feedback

## Quick Start

### Run Linting

```bash
# Check for issues
buddy lint

# Fix auto-fixable issues
buddy lint --fix

# Lint specific files
buddy lint src/components/

# Check formatting only
buddy format:check

# Fix formatting
buddy format
```

## ESLint Configuration

### Default Rules

Stacks uses a curated set of ESLint rules:

```typescript
// eslint.config.ts
import { defineConfig } from '@stacksjs/eslint'

export default defineConfig({
  // Default configuration
})
```

### Customizing Rules

```typescript
// eslint.config.ts
import { defineConfig } from '@stacksjs/eslint'

export default defineConfig({
  rules: {
    // Override rules
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
    }],
  },

  ignores: [
    'dist/**',
    'node_modules/**',
    '*.gen.ts',
  ],
})
```

### Extending Configuration

```typescript
import { defineConfig, presets } from '@stacksjs/eslint'

export default defineConfig({
  extends: [
    presets.recommended,
    presets.vue,
    presets.typescript,
  ],

  rules: {
    // Your custom rules
  },
})
```

## TypeScript Rules

### Strict Type Checking

```typescript
export default defineConfig({
  typescript: {
    strict: true,
    typeChecked: true,
  },

  rules: {
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
  },
})
```

### Common TypeScript Rules

```typescript
rules: {
  // Require explicit return types
  '@typescript-eslint/explicit-function-return-type': 'warn',

  // Disallow any type
  '@typescript-eslint/no-explicit-any': 'error',

  // Require type annotations
  '@typescript-eslint/typedef': ['error', {
    parameter: true,
    propertyDeclaration: true,
  }],

  // Prefer interfaces over type aliases
  '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

  // Enforce consistent type imports
  '@typescript-eslint/consistent-type-imports': ['error', {
    prefer: 'type-imports',
  }],
}
```

## Vue Rules

### Vue-Specific Linting

```typescript
export default defineConfig({
  vue: {
    version: 3,
    scriptSetup: true,
  },

  rules: {
    // Component naming
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],

    // Prop naming
    'vue/prop-name-casing': ['error', 'camelCase'],

    // Event naming
    'vue/custom-event-name-casing': ['error', 'camelCase'],

    // No unused refs
    'vue/no-unused-refs': 'error',

    // Require default props
    'vue/require-default-prop': 'error',

    // Order of component options
    'vue/order-in-components': 'error',
  },
})
```

### Vue Template Rules

```typescript
rules: {
  // Self-closing tags
  'vue/html-self-closing': ['error', {
    html: { normal: 'never', void: 'always' },
    svg: 'always',
    math: 'always',
  }],

  // Max attributes per line
  'vue/max-attributes-per-line': ['error', {
    singleline: 3,
    multiline: 1,
  }],

  // Attribute order
  'vue/attributes-order': ['error', {
    order: [
      'DEFINITION',
      'LIST_RENDERING',
      'CONDITIONALS',
      'RENDER_MODIFIERS',
      'GLOBAL',
      'UNIQUE',
      'TWO_WAY_BINDING',
      'OTHER_DIRECTIVES',
      'OTHER_ATTR',
      'EVENTS',
      'CONTENT',
    ],
  }],
}
```

## Prettier Integration

### Formatting Configuration

```typescript
// prettier.config.ts
import { defineConfig } from '@stacksjs/prettier'

export default defineConfig({
  // Defaults
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  printWidth: 100,

  // Override per file type
  overrides: [
    {
      files: '*.md',
      options: {
        proseWrap: 'always',
      },
    },
    {
      files: '*.json',
      options: {
        tabWidth: 2,
      },
    },
  ],
})
```

### Running Prettier

```bash
# Check formatting
buddy format:check

# Fix formatting
buddy format

# Format specific files
buddy format src/**/*.ts
```

## IDE Integration

### VS Code

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.validate": [
    "javascript",
    "typescript",
    "vue"
  ],
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### Recommended Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "vue.volar"
  ]
}
```

### WebStorm / IntelliJ

1. Go to **Settings > Languages & Frameworks > JavaScript > Code Quality Tools > ESLint**
2. Enable **Automatic ESLint configuration**
3. Check **Run eslint --fix on save**

## Pre-commit Hooks

### Setup with Husky

```bash
# Install hooks
buddy hooks:install
```

```typescript
// .husky/pre-commit
#!/bin/sh
bun run lint-staged
```

### Lint-Staged Configuration

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,vue}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  }
}
```

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/lint.yml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint
      - run: bun run format:check
```

## Common Rules

### Import Ordering

```typescript
rules: {
  'import/order': ['error', {
    groups: [
      'builtin',
      'external',
      'internal',
      'parent',
      'sibling',
      'index',
    ],
    'newlines-between': 'always',
    alphabetize: {
      order: 'asc',
      caseInsensitive: true,
    },
  }],
}
```

### Naming Conventions

```typescript
rules: {
  '@typescript-eslint/naming-convention': [
    'error',
    // Variables: camelCase
    { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
    // Functions: camelCase
    { selector: 'function', format: ['camelCase'] },
    // Classes: PascalCase
    { selector: 'class', format: ['PascalCase'] },
    // Interfaces: PascalCase with I prefix optional
    { selector: 'interface', format: ['PascalCase'] },
    // Types: PascalCase
    { selector: 'typeAlias', format: ['PascalCase'] },
    // Enums: PascalCase
    { selector: 'enum', format: ['PascalCase'] },
  ],
}
```

## Disable Rules

### Per-Line

```typescript
// eslint-disable-next-line no-console
console.log('Debug output')

const value = 42 // eslint-disable-line no-magic-numbers
```

### Per-File

```typescript
/* eslint-disable no-console */
// All console statements allowed in this file

console.log('Hello')
console.log('World')

/* eslint-enable no-console */
```

### For Block

```typescript
/* eslint-disable */
// All rules disabled
const messy = code
/* eslint-enable */
```

## Best Practices

1. **Start strict** - Begin with strict rules, relax as needed
2. **Fix gradually** - Use `--fix` to auto-fix, review changes
3. **Consistent formatting** - Let Prettier handle formatting
4. **IDE integration** - Get real-time feedback
5. **Pre-commit hooks** - Catch issues before commit
6. **CI enforcement** - Fail builds on lint errors

## Related

- [Testing](/guide/testing) - Testing your code
- [CI](/guide/ci) - Continuous integration
- [Configuration](/guide/config) - Project configuration
