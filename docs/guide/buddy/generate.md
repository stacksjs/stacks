---
title: Generate Command
description: "The  command provides code generation capabilities for various project artifacts, from TypeScript types to IDE helpers and component metadata."
---
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
| `-o, --openapi` | Generate OpenAPI specification |
| `--images` | Generate the imagery declared in `config/images.ts` |
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

### Migrations

Diff your models against the current schema and emit SQL migration files into `database/migrations/`:

```bash
buddy generate:migrations
```

### Vitess VSchema

Derive a [Vitess](https://vitess.io/) keyspace VSchema from your models and write it to `database/vschema.json`:

```bash
buddy generate:vschema

# Print it without writing
buddy generate:vschema --dry-run

# Write somewhere else
buddy generate:vschema --out infra/vschema.json
```

A VSchema tells vtgate which column decides each table's shard. Stacks derives it from your relationship graph: a table with a `belongsTo` shards by the key of its parent, so the two stay on the same shard and a join between them does not fan out across the cluster.

The command prints the topology it chose, grouped by reason, along with any table whose joins will still scatter. Review that output rather than trusting the file - a wrong sharding key is not an error, just a query that quietly costs several times more than it should.

See [Scaling the Database](/guide/database-scaling#generating-a-vschema) for the full picture.

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

### Images

Build the imagery declared in `config/images.ts` — the social cards link
previews show, the App Store screenshot set, and the app icon and favicon sets.
See [Generated Images](/features/images) for the configuration.

```bash
# Everything declared
buddy generate:images

# Or one at a time
buddy generate:og          # social cards      (alias: generate:social)
buddy generate:app-store   # store screenshots (alias: generate:screenshots)
buddy generate:app-icons   # icon + favicon sets
```

`buddy generate:images` also takes `--social`, `--app-store` and `--app-icons`
to restrict a run. Each generator no-ops unless its section is `enabled`, so
this is safe to wire into a build.

Output:

```
buddy generate:images

Generated 9 social card(s), 6 App Store screenshot(s)

Completed in 4.10s
```

### Generate Migrations

```bash
buddy generate:migrations
```

This reads your model definitions, diffs them against the current database schema, and writes the resulting SQL migration files into `database/migrations/`.

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

Generates types for your STX components:

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

## Model Type Generation

The type generator (`buddy generate:types`) also creates model types, for example:

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
    Button.stx
    Modal.stx
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
 * get:
 * summary: List users

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

- Models: `buddy generate:migrations`
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
