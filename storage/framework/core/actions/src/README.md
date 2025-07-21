# Code Generation Templates

This directory contains the code generation system for the Stacks framework's `make` command.

## Overview

The code generation system uses a template-based approach to create consistent, maintainable code files. All templates are centralized in the `templates.ts` file and use a simple substitution format.

## Template Format

Templates use the `{0}`, `{1}`, etc. format for parameter substitution, which works with the `@stacksjs/strings` template function.

### Example

```typescript
// Template definition
const actionTemplate = `import { Action } from '@stacksjs/actions'

export default new Action({
  name: '{0}',
  description: '{0} action',

  handle() {
    return 'Hello World action'
  },
})`

// Usage
const generatedCode = template(actionTemplate, 'MyAction')
```

## Available Templates

- **action**: Creates a new Action class
- **component**: Creates a new Vue component
- **page**: Creates a new Vue page
- **function**: Creates a new composable function
- **language**: Creates a new language file
- **notification**: Creates a new notification
- **middleware**: Creates a new middleware
- **model**: Creates a new model
- **migration**: Creates a new database migration
- **job**: Creates a new job
- **event**: Creates a new event
- **listener**: Creates a new listener
- **command**: Creates a new CLI command

## Adding New Templates

1. Add the template to `templates.ts` in the `CODE_TEMPLATES` object
2. Update the `TemplateKey` type to include your new template
3. Create the corresponding generation function in `make.ts`
4. Add the template to the `invoke` function if needed

### Example: Adding a Service Template

```typescript
// In templates.ts
export const CODE_TEMPLATES = {
  // ... existing templates
  service: `import { Service } from '@stacksjs/services'

export default new Service({
  name: '{0}',
  description: '{0} service',

  async handle() {
    // Your service logic here
  },
})`,
} as const

// In make.ts
export async function createService(options: MakeOptions): Promise<void> {
  const name = options.name
  await createFileWithTemplate(p.userServicesPath(`${name}.ts`), 'service', name)
}
```

## Helper Functions

### `generateCode(templateKey, ...args)`

Generates code from a template with the given arguments.

### `createFileWithTemplate(path, templateKey, ...args)`

Creates a file at the specified path with generated code from a template.

## Benefits

1. **Centralized**: All templates are in one place
2. **Consistent**: Uses the same substitution format throughout
3. **Maintainable**: Easy to update templates without touching generation logic
4. **Type-safe**: TypeScript ensures template keys are valid
5. **Reusable**: Templates can be used across different generation functions
6. **Readable**: Clear separation between template content and generation logic

## Best Practices

1. Keep templates simple and focused
2. Use descriptive parameter placeholders
3. Include helpful comments in generated code
4. Follow the existing code style conventions
5. Test templates with various inputs
6. Document any special requirements or dependencies 