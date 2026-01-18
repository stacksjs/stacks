# Publish

This guide covers publishing packages and libraries from your Stacks application, including npm publishing, versioning, and package configuration.

## Getting Started

Stacks provides tools for building and publishing reusable packages to npm or other registries.

```bash
# Build and publish your library
buddy publish
```

## Package Configuration

### Library Configuration

```ts
// config/library.ts
import type { LibraryConfig } from '@stacksjs/types'

export default {
  name: 'my-awesome-library',
  description: 'A useful library built with Stacks',
  author: 'Your Name <your@email.com>',
  license: 'MIT',
  repository: 'https://github.com/username/my-library',

  // Entry points
  entry: './src/index.ts',

  // Output formats
  formats: ['esm', 'cjs', 'umd'],

  // External dependencies (not bundled)
  externals: ['vue', 'react'],

  // TypeScript declarations
  dts: true,

  // Minification
  minify: true,

  // Source maps
  sourcemap: true,
} satisfies LibraryConfig
```

### Package.json Configuration

```json
{
  "name": "@yourscope/my-library",
  "version": "1.0.0",
  "description": "A useful library built with Stacks",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./components": {
      "import": "./dist/components/index.js",
      "require": "./dist/components/index.cjs",
      "types": "./dist/components/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "buddy build:lib",
    "prepublishOnly": "bun run build"
  },
  "keywords": ["stacks", "typescript", "library"],
  "author": "Your Name <your@email.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/username/my-library.git"
  },
  "publishConfig": {
    "access": "public"
  },
  "peerDependencies": {
    "vue": "^3.0.0"
  }
}
```

## Building Libraries

### Build Command

```bash
# Build the library
buddy build:lib

# Build with watch mode
buddy build:lib --watch

# Build specific format
buddy build:lib --format=esm
```

### Build Configuration

```ts
// buddy.config.ts
import { defineConfig } from '@stacksjs/buddy'

export default defineConfig({
  library: {
    // Entry file
    entry: 'src/index.ts',

    // Output directory
    outDir: 'dist',

    // Build formats
    formats: ['esm', 'cjs'],

    // External packages
    external: [
      'vue',
      '@vue/*',
      /^@stacksjs\//,
    ],

    // Global variable name for UMD builds
    name: 'MyLibrary',

    // Minification options
    minify: {
      mangle: true,
      compress: {
        drop_console: true,
      },
    },

    // TypeScript configuration
    typescript: {
      declaration: true,
      declarationDir: 'dist/types',
    },
  },
})
```

### Multiple Entry Points

```ts
// config/library.ts
export default {
  entries: {
    '.': './src/index.ts',
    './components': './src/components/index.ts',
    './utils': './src/utils/index.ts',
    './composables': './src/composables/index.ts',
  },
}
```

## Versioning

### Semantic Versioning

```bash
# Bump version
buddy version patch    # 1.0.0 -> 1.0.1
buddy version minor    # 1.0.0 -> 1.1.0
buddy version major    # 1.0.0 -> 2.0.0

# Prerelease versions
buddy version prepatch --preid=alpha   # 1.0.0 -> 1.0.1-alpha.0
buddy version preminor --preid=beta    # 1.0.0 -> 1.1.0-beta.0
buddy version premajor --preid=rc      # 1.0.0 -> 2.0.0-rc.0

# Prerelease increment
buddy version prerelease               # 1.0.0-alpha.0 -> 1.0.0-alpha.1
```

### Version Configuration

```ts
// config/release.ts
export default {
  // Automatically generate changelog
  changelog: true,

  // Commit message format
  commitMessage: 'chore(release): v${version}',

  // Tag format
  tagFormat: 'v${version}',

  // Files to update version in
  files: [
    'package.json',
    'config/app.ts',
  ],

  // Git hooks
  hooks: {
    before: async () => {
      await runTests()
      await runLint()
    },
    after: async () => {
      await buildDocs()
    },
  },
}
```

### Changelog Generation

```bash
# Generate changelog
buddy changelog

# Preview changelog without writing
buddy changelog --dry-run
```

## Publishing

### NPM Publishing

```bash
# Publish to npm
buddy publish

# Publish with specific tag
buddy publish --tag=beta

# Publish to specific registry
buddy publish --registry=https://npm.pkg.github.com

# Dry run (don't actually publish)
buddy publish --dry-run
```

### Authentication

```bash
# Login to npm
npm login

# For scoped packages
npm login --scope=@yourscope

# Set auth token (CI/CD)
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> .npmrc
```

### Private Registry

```ts
// .npmrc
@yourscope:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### GitHub Packages

```json
// package.json
{
  "name": "@username/my-library",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

## CI/CD Publishing

### GitHub Actions

```yaml
# .github/workflows/publish.yml
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run tests
        run: bun test

      - name: Build
        run: bun run build

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Automated Release

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Create Release
        run: bunx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Documentation

### Generating API Docs

```bash
# Generate TypeDoc documentation
buddy docs:api

# Serve docs locally
buddy docs:serve
```

### TypeDoc Configuration

```json
// typedoc.json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs/api",
  "name": "My Library",
  "readme": "README.md",
  "theme": "default",
  "excludePrivate": true,
  "excludeProtected": true,
  "plugin": ["typedoc-plugin-markdown"]
}
```

### README Template

```markdown
# My Library

A brief description of what this library does.

## Installation

\`\`\`bash
npm install @yourscope/my-library
# or
bun add @yourscope/my-library
\`\`\`

## Usage

\`\`\`ts
import { myFunction } from '@yourscope/my-library'

const result = myFunction('hello')
\`\`\`

## API

### myFunction(input: string): string

Description of what the function does.

**Parameters:**
- `input` - Description of the input

**Returns:** Description of the return value

## License

MIT
```

## Publishing Components

### Vue Component Library

```ts
// src/index.ts
import type { App } from 'vue'
import MyButton from './components/MyButton.vue'
import MyInput from './components/MyInput.vue'
import MyModal from './components/MyModal.vue'

export { MyButton, MyInput, MyModal }

export default {
  install(app: App) {
    app.component('MyButton', MyButton)
    app.component('MyInput', MyInput)
    app.component('MyModal', MyModal)
  },
}
```

### Component Package.json

```json
{
  "name": "@yourscope/components",
  "version": "1.0.0",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./style.css": "./dist/style.css"
  },
  "sideEffects": ["*.css"],
  "peerDependencies": {
    "vue": "^3.3.0"
  }
}
```

## Publishing Functions

### Function Library

```ts
// src/index.ts
export { useDebounce } from './composables/useDebounce'
export { useLocalStorage } from './composables/useLocalStorage'
export { useAsync } from './composables/useAsync'
export { formatDate, formatCurrency } from './utils/formatters'
export { validateEmail, validatePhone } from './utils/validators'

// Types
export type { DebounceOptions } from './composables/useDebounce'
export type { AsyncState } from './composables/useAsync'
```

## Pre-publish Checklist

Before publishing, ensure:

1. **Tests pass**
   ```bash
   bun test
   ```

2. **Types are correct**
   ```bash
   bun run typecheck
   ```

3. **Linting passes**
   ```bash
   bun run lint
   ```

4. **Build succeeds**
   ```bash
   bun run build
   ```

5. **Package contents are correct**
   ```bash
   npm pack --dry-run
   ```

6. **Version is correct**
   ```bash
   npm version patch
   ```

7. **Changelog is updated**
   ```bash
   buddy changelog
   ```

## Error Handling

```ts
try {
  await publish()
} catch (error) {
  if (error.message.includes('403')) {
    console.error('Not authorized to publish. Check npm login.')
  } else if (error.message.includes('409')) {
    console.error('Version already exists. Bump version first.')
  } else if (error.message.includes('404')) {
    console.error('Package not found. Check package name.')
  } else {
    console.error('Publish failed:', error.message)
  }
}
```

## Best Practices

1. **Use semantic versioning** - Follow semver for predictable updates
2. **Write good documentation** - Include README, API docs, and examples
3. **Include TypeScript types** - Generate .d.ts files
4. **Test before publishing** - Run tests in CI
5. **Keep bundle size small** - Use tree-shaking, externalize dependencies
6. **Maintain backwards compatibility** - Use deprecation warnings

This documentation covers publishing packages and libraries from Stacks. Each step is designed for reliable and professional package distribution.
