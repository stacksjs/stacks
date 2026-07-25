---
name: stacks-validation
description: Use when implementing validation in Stacks — type guards (isString, isNumber, isBoolean, isObject, isArray, isFunction, etc.), numeric checks (isPositive, isEven, isInteger), the schema builder for model attribute validation, or request validation. Covers @stacksjs/validation.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Validation

## Key Paths
- Core package: `storage/framework/core/validation/src/`
- Package: `@stacksjs/validation`

## Architecture

The `index.ts` re-exports from multiple sources:
```typescript
// Re-export everything from the validation library
export * from '@stacksjs/ts-validation'

// Local modules
export * from './reporter'    // error reporting
export * from './validator'   // model/custom validation
export { schema } from './schema'  // schema builder instance

// Type guard functions defined directly in index.ts
export function isString(value: unknown): value is string
export function isNumber(value: unknown): value is number
export function isBoolean(value: unknown): value is boolean
export function isObject(value: unknown): value is Record<string, unknown>
export function isArray(value: unknown): value is unknown[]
export function isFunction(value: unknown): value is Function
export function isUndefined(value: unknown): value is undefined
export function isNull(value: unknown): value is null
export function isNullOrUndefined(value: unknown): value is null | undefined
```

Additional type guards are in `is.ts` (but not directly imported by index.ts -- available via separate import).

## Type Guards (`index.ts`)

Basic type guards with TypeScript type narrowing:

```typescript
import { isString, isNumber, isBoolean, isObject, isArray, isFunction } from '@stacksjs/validation'

isString('hello')          // true   -- typeof value === 'string'
isNumber(42)               // true   -- typeof value === 'number' && !Number.isNaN(value)
isNumber(NaN)              // FALSE  -- NaN is explicitly excluded
isBoolean(true)            // true   -- typeof value === 'boolean'
isObject({})               // true   -- typeof === 'object' && !== null && !Array.isArray
isObject([])               // FALSE  -- arrays are excluded
isObject(null)             // FALSE  -- null is excluded
isArray([])                // true   -- Array.isArray()
isFunction(() => {})       // true   -- typeof value === 'function'
isUndefined(undefined)     // true
isNull(null)               // true
isNullOrUndefined(null)    // true
isNullOrUndefined(undefined) // true
```

## Extended Type Guards (`is.ts`)

Additional guards using `getTypeName()` from `@stacksjs/types` and `toString()` from `@stacksjs/strings`:

```typescript
isDef(value)                // true if typeof value !== 'undefined'
isMap(new Map())            // true  -- toString check '[object Map]'
isSet(new Set())            // true  -- toString check '[object Set]'
isPromise(Promise.resolve()) // true -- toString check '[object Promise]'
isSymbol(Symbol())          // true
isDate(new Date())          // true
isRegExp(/test/)            // true
isWindow(globalThis)        // true in browser -- toString check '[object Window]'
isPrimitive(42)             // true (string, number, boolean, null, undefined, symbol)
isPrimitive({})             // false

// Environment detection
isBrowser: boolean          // typeof window !== 'undefined'
isServer: boolean           // typeof document === 'undefined'
```

## Numeric Checks (`is.ts`)

```typescript
isInteger(42)               // true   -- Number.isInteger()
isInteger(42.0)             // true   -- 42.0 is an integer in JS
isFloat(3.14)               // true   -- isNumber && !Number.isInteger
isFloat(42)                 // false

isPositive(5)               // true   -- > 0
isNegative(-5)              // true   -- < 0
isEven(4)                   // true   -- % 2 === 0
isOdd(3)                    // true   -- % 2 !== 0

// Classification functions (return string, not boolean)
isEvenOrOdd(4)              // 'even'
isEvenOrOdd(3)              // 'odd'
isEvenOrOdd('not a number') // 'odd'  -- non-numbers default to 'odd'

isPositiveOrNegative(5)     // 'positive'
isPositiveOrNegative(-5)    // 'negative'
isPositiveOrNegative('x')   // 'negative'  -- non-numbers default to 'negative'

isIntegerOrFloat(42)        // 'integer'
isIntegerOrFloat(3.14)      // 'float'
isIntegerOrFloat('x')       // 'float'  -- non-numbers default to 'float'
```

## Schema Builder (`schema.ts`)

The `schema` object is an instance of `ValidationInstance` from `@stacksjs/ts-validation`. It provides fluent validators for model attribute definitions.

```typescript
import { schema } from '@stacksjs/validation'
```

### Available Schema Types

```typescript
// String types
schema.string()                    // StringValidatorType
schema.string().minLength(2)       // chain: min length
schema.string().maxLength(100)     // chain: max length
schema.string().email()            // chain: must be email
schema.string().url()              // chain: must be URL
schema.string().matches(/pattern/) // chain: regex match
schema.string().equals('exact')    // chain: exact match
schema.string().alphanumeric()     // chain: alphanumeric only
schema.string().alpha()            // chain: letters only
schema.string().numeric()          // chain: numeric string
schema.string().custom(fn, msg)    // chain: custom validator
schema.text()                      // TextValidatorType (extends StringValidatorType)

// Number types
schema.number()                    // NumberValidatorType
schema.number().min(0).max(100)    // chain: min/max
schema.bigint()                    // BigintValidatorType
schema.integer()                   // IntegerValidatorType
schema.smallint()                  // SmallintValidatorType
schema.float()                     // FloatValidatorType
schema.double()                    // DoubleValidatorType
schema.decimal()                   // DecimalValidatorType

// Boolean
schema.boolean()                   // BooleanValidatorType

// Enum
schema.enum(['draft', 'published', 'archived'])  // EnumValidatorType

// Date/time types
schema.date()                      // DateValidatorType
schema.datetime()                  // DatetimeValidatorType
schema.timestamp()                 // TimestampValidatorType
schema.timestampTz()               // TimestampTzValidatorType (with timezone)
schema.unix()                      // UnixValidatorType
schema.time()                      // TimeValidatorType

// Binary/blob
schema.binary()                    // BinaryValidatorType
schema.blob()                      // BlobValidatorType

// JSON
schema.json()                      // JsonValidatorType

// Password
schema.password()                  // PasswordValidatorType

// Array
schema.array<T>()                  // ArrayValidatorType<T>

// Object
schema.object<T>(shapeSchema?)     // ObjectValidatorType<T>

// Custom
schema.custom<T>(validationFn, message)  // CustomValidatorType<T>
```

### Model Attribute Usage

Schema validators are used in `defineModel()` attribute validation:

```typescript
import { defineModel } from '@stacksjs/config'
import { schema } from '@stacksjs/validation'

export default defineModel({
  attributes: {
    name: {
      validation: {
        rule: schema.string().minLength(2).maxLength(100),
        message: {
          minLength: 'Name must be at least 2 characters',
          maxLength: 'Name cannot exceed 100 characters',
        }
      }
    },

    email: {
      validation: {
        rule: schema.string().email(),
        message: {
          email: 'Please provide a valid email address',
        }
      }
    },

    price: {
      validation: {
        rule: schema.number().min(1),
        message: {
          min: 'Price must be at least 1',
        }
      }
    },

    status: {
      validation: {
        rule: schema.enum(['active', 'inactive', 'archived']),
        message: {
          enum: 'Invalid status value',
        }
      }
    },

    bio: {
      validation: {
        rule: schema.string().maxLength(500),
        message: {
          maxLength: 'Bio cannot exceed 500 characters',
        }
      }
    },
  }
})
```

## Model Validation (`validator.ts`)

### `validateField(modelFile, params)`

Validates request data against a model's attribute rules. Used internally by the framework for API request validation.

```typescript
import { validateField } from '@stacksjs/validation'

// Loads model file, extracts validation rules, validates params
const result = await validateField('User', { name: 'John', email: 'john@example.com' })
```

Behavior:
1. Finds the model file by name in user models or framework defaults
2. Extracts validation rules from model attributes
3. Converts attribute names to snake_case for validation
4. Sets custom error messages via `MessageProvider`
5. Validates using `schema.object(ruleObject).validate(params)`
6. Throws `HttpError(422)` with error JSON on validation failure
7. Throws `HttpError(404)` if model not found
8. Skips validation for attributes with default values unless `isRequired` is true

### `customValidate(attributes, params)`

Validates request data against custom attribute rules (not tied to a model):

```typescript
import { customValidate } from '@stacksjs/validation'

const result = await customValidate({
  email: {
    rule: schema.string().email(),
    message: { email: 'Invalid email' }
  },
  age: {
    rule: schema.number().min(18),
    message: { min: 'Must be at least 18' }
  }
}, requestData)
```

Uses `schema.object().shape(ruleObject)` for validation.

### `isObjectNotEmpty(obj)`

```typescript
isObjectNotEmpty({})            // false
isObjectNotEmpty({ a: 1 })      // true
isObjectNotEmpty(undefined)     // false
```

## Error Reporter (`reporter.ts`)

Simple error accumulator for validation:

```typescript
import { reportError, getErrors } from '@stacksjs/validation'

reportError([{ message: 'Invalid', value: '', field: 'email' }])
const errors = getErrors()   // returns accumulated MessageObject[]
```

Interface: `{ message: string, value: string, field: string }`

## Error Reporter Contract (from `rules.ts`)

VineJS-inspired types for the validation pipeline:

```typescript
interface FieldContext {
  value: unknown
  data: any              // top-level object under validation
  meta: Record<string, any>
  mutate: (newValue: any, field: FieldContext) => void
  report: ErrorReporterContract['report']
  isValid: boolean
  isDefined: boolean
  wildCardPath: string   // nested pointer, '*' for array members
  parent: any
  name: string | number
  isArrayMember: boolean
}

interface ErrorReporterContract {
  hasErrors: boolean
  createError: () => Error
  report: (message: string, rule: string, field: FieldContext, args?: Record<string, any>) => any
}
```

## Re-exports from @stacksjs/ts-validation

The package re-exports everything from `@stacksjs/ts-validation`, which includes:

- `v` and `schema` -- the validation instance
- `validator` -- the validator library (default export from lib)
- `MessageProvider`, `setCustomMessages` -- custom message handling
- All type definitions (ValidatorType, StringValidatorType, NumberValidatorType, etc.)
- Configuration utilities

## Validation Types (`types/index.ts`)

Local type definitions:
```typescript
interface ValidationResult {
  valid: boolean
  errors?: Array<{ message: string }>
}

interface ValidationRule {
  validate: (value: unknown) => ValidationResult
}

type ValidationBoolean = ValidationRule
type ValidationEnum = ValidationRule
type ValidationNumber = ValidationRule
type ValidationString = ValidationRule
```

## Gotchas
- `isNumber()` in `index.ts` returns FALSE for `NaN` -- this differs from `typeof NaN === 'number'`
- `isObject()` in `index.ts` excludes arrays and null -- `isObject([])` is false
- `isObject()` in `is.ts` uses `toString()` check (`[object Object]`) which also excludes arrays/null but through a different mechanism
- `isPrimitive()` includes null and undefined (6 primitive types: string, number, boolean, null, undefined, symbol)
- Numeric classification functions (`isEvenOrOdd`, etc.) return string defaults for non-numbers rather than throwing
- Schema validators map to database column types -- `schema.integer()` creates an integer column, `schema.string()` creates a varchar, etc.
- `validateField` converts attribute names to snake_case using `snakeCase()` from `@stacksjs/strings`
- `validateField` skips attributes with default values unless `isRequired` is explicitly set
- Validation error messages are customizable per-rule in model definitions via the `message` object
- The `schema` export is the `v` instance from `@stacksjs/ts-validation` -- they are the same object
- Custom validators can be added with `schema.custom<T>(fn, message)` for types not covered by built-in validators
- `customValidate` uses `schema.object().shape()` while `validateField` uses `schema.object(ruleObject)` -- slightly different API
