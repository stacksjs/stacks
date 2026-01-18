# Generate Command

The `buddy generate` command provides code generation capabilities for various project artifacts, from TypeScript types to IDE helpers and component metadata.

## Basic Usage

```bash
# Interactive generator selection
buddy generate

# Generate specific artifact
buddy generate:types
```

## Command Syntax

```bash
buddy generate [options]
buddy generate:<type> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-t, --types` | Generate TypeScript types |
| `-e, --entries` | Generate library entry points |
| `-w, --web-types` | Generate web-types.json for IDEs |
| `-c, --custom-data` | Generate VS Code custom data |
| `-i, --ide-helpers` | Generate IDE helpers |
| `--component-meta` | Generate component metadata |
| `-p, --pantry` | Generate pantry configuration |
| `-m, --model-files` | Generate model files |
| `-o, --openapi` | Generate OpenAPI specification |
| `--core-symlink` | Generate core framework symlink |
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## Available Generators

### TypeScript Types

Generate types for components, functions, and views:

```bash
buddy generate:types
# or
buddy types:generate
```

### Library Entry Points

Generate entry files for component and function libraries:

```bash
buddy generate:entries
```

### Web Types

Generate `web-types.json` for IDE support (JetBrains, etc.):

```bash
buddy generate:web-types
```

### VS Code Custom Data

Generate custom element data for VS Code:

```bash
buddy generate:vscode-custom-data
```

### IDE Helpers

Generate IDE helper files for improved developer experience:

```bash
buddy generate:ide-helpers
```

### Component Meta

Generate component metadata information:

```bash
buddy generate:component-meta
```

### Pantry Config

Generate pantry configuration file:

```bash
buddy generate:pantry-config
```

### Model Files

Generate ORM model files:

```bash
buddy generate:model-files
```

### OpenAPI Specification

Generate OpenAPI (Swagger) specification:

```bash
buddy generate:openapi-spec
# or
buddy generate:openapi
```

### Core Symlink

Generate symlink to core framework (for developers):

```bash
buddy generate:core-symlink
```

## Examples

### Generate All Types

```bash
buddy generate:types
```

### Generate OpenAPI Spec

```bash
buddy generate:openapi-spec
```

Output:
```
buddy generate:openapi-spec

Generated OpenAPI specification

Completed in 1.23s
```

### Generate Model Files

```bash
buddy generate:model-files
```

This reads your model definitions and generates:
- TypeScript interfaces
- Database migration helpers
- Model instance types

### Generate with Verbose Output

```bash
buddy generate:types --verbose
```

## IDE Integration

### Web Types

After generating web types, JetBrains IDEs provide:
- Component autocompletion
- Prop validation
- Documentation on hover

### VS Code Custom Data

After generating custom data, VS Code provides:
- Custom element completion
- Attribute hints
- Documentation

### IDE Helpers

Generated helpers provide:
- Path aliases
- Type definitions
- Configuration hints

## Auto-Generation

Many generators run automatically during development:

```bash
# Starts dev server and runs generators
buddy dev
```

Auto-triggered generators:
- TypeScript types
- Entry points
- IDE helpers

## Generated Files

| Generator | Output File(s) |
|-----------|----------------|
| types | `*.d.ts` files |
| web-types | `web-types.json` |
| custom-data | `custom-elements.json` |
| ide-helpers | `.ide-helpers/` |
| component-meta | `component-meta.json` |
| openapi | `openapi.json` |

## Type Generation Details

### Component Types

Generates types for your Vue components:

```typescript
// Generated types
declare module '@stacksjs/components' {
  export const Button: DefineComponent<{
    variant?: 'primary' | 'secondary'
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
  }>
}
```

### Function Types

Generates types for your functions:

```typescript
// Generated types
declare module '@stacksjs/functions' {
  export function formatDate(date: Date, format?: string): string
  export function calculateTotal(items: Item[]): number
}
```

## Model File Generation

The model file generator creates:

### Instance Types

```typescript
// Generated from User model
interface UserInstance {
  id: number
  name: string
  email: string
  createdAt: Date
  updatedAt: Date
}
```

### Query Helpers

```typescript
// Generated query helpers
const user = await User.find(1)
const users = await User.where('active', true).get()
```

## OpenAPI Generation

Generates a complete OpenAPI 3.0 specification:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": {
    "/api/users": {
      "get": {
        "summary": "List all users",
        "responses": {
          "200": {
            "description": "Success"
          }
        }
      }
    }
  }
}
```

## Troubleshooting

### Types Not Generated

```
Error: No components found
```

**Solution**: Ensure components exist in the expected location:
```
app/
  Components/
    Button.vue
    Modal.vue
```

### Generation Fails

```
Error: Failed to generate types
```

**Solutions**:
1. Check for syntax errors in source files
2. Run with `--verbose` for details
3. Ensure all dependencies are installed

### IDE Not Recognizing Types

After generating types:

1. Restart your IDE
2. Ensure `tsconfig.json` includes generated types
3. Check file paths are correct

### OpenAPI Missing Routes

Ensure routes are properly annotated:

```typescript
// Annotate your API routes
/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: List users
 */
```

## Best Practices

### Commit Generated Files

Include generated files in version control for:
- Consistent IDE experience across team
- CI/CD compatibility
- Documentation

### Regenerate After Changes

After modifying:
- Models: `buddy generate:model-files`
- Components: `buddy generate:types`
- API routes: `buddy generate:openapi`

### Use in CI/CD

```yaml
# Verify generated files are up to date
- run: buddy generate:types
- run: git diff --exit-code
```

## Related Commands

- [buddy make:model](/guide/buddy/generate) - Create new model
- [buddy build](/guide/buddy/build) - Build project
- [buddy dev](/guide/buddy/dev) - Development server
