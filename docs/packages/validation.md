# TypeScript Validation Package

A powerful and flexible validation library for TypeScript that provides a fluent API for validating various data types.

## Installation

```bash
# Using bun
bun add @stacksjs/ts-validation

# Using npm
npm install @stacksjs/ts-validation

# Using yarn
yarn add @stacksjs/ts-validation

# Using pnpm
pnpm add @stacksjs/ts-validation
```

## Basic Usage

```typescript
import { v } from '@stacks/ts-validation'

// Basic string validation
const stringValidator = v.string().min(5).max(10)
const result = stringValidator.validate('hello')
console.log(result.valid) // true

// Object validation
const userValidator = v.object().shape({
  name: v.string().min(2),
  age: v.number().min(18),
  email: v.string().email()
})

const user = {
  name: 'John',
  age: 25,
  email: 'john@example.com'
}

const validationResult = userValidator.validate(user)
console.log(validationResult.valid) // true
```

## Available Validators

### String Validator

```typescript
const validator = v.string()
  .min(5) // minimum length
  .max(10) // maximum length
  .length(7) // exact length
  .email() // validate email format
  .alphanumeric() // only letters and numbers
```

### Number Validator

```typescript
const validator = v.number()
  .min(0) // minimum value
  .max(100) // maximum value
  .integer() // must be an integer
  .float() // can be a floating point number
```

Here are more examples of number validation:

```typescript
// Validate a positive integer
const positiveIntValidator = v.number()
  .positive()
  .integer()

// Validate a decimal number with specific options
const decimalValidator = v.number()
  .decimal({ decimal_digits: '2' })

// Validate a number divisible by 5
const divisibleValidator = v.number()
  .divisibleBy(5)

// Combine multiple rules
const scoreValidator = v.number()
  .min(0)
  .max(100)
  .decimal({ decimal_digits: '1' })
  .custom(value => value % 0.5 === 0, 'Score must be in 0.5 increments')

// Examples:
scoreValidator.validate(85.5) // valid
scoreValidator.validate(85.7) // invalid
scoreValidator.validate(-1) // invalid
```

### Array Validator

```typescript
const validator = v.array<string>()
  .min(2) // minimum length
  .max(4) // maximum length
  .length(3) // exact length
  .each(v.string().min(2)) // validate each item
  .unique() // all items must be unique
```

### Boolean Validator

```typescript
// Basic boolean validation
const boolValidator = v.boolean()

// Must be true validation
const requiredCheckbox = v.boolean()
  .isTrue()
  .custom(
    value => typeof value === 'boolean',
    'Checkbox must be checked'
  )

// Complex boolean validation
const toggleValidator = v.boolean()
  .custom(
    value => {
      // Custom validation logic
      return typeof value === 'boolean' && (value === true || value === false)
    },
    'Toggle must be either on or off'
  )

// Examples:
boolValidator.validate(true) // valid
boolValidator.validate(false) // valid
boolValidator.validate('true') // invalid
requiredCheckbox.validate(false) // invalid
```

### Enum Validator

```typescript
// Basic enum validation
const roleValidator = v.enum(['admin', 'user', 'guest'] as const)

// Enum with custom validation
const accessLevelValidator = v.enum(['read', 'write', 'admin'] as const)
  .custom(
    value => value !== 'admin' || isUserAdmin(), // hypothetical function
    'Only administrators can have admin access'
  )

// Numeric enum validation
const priorityValidator = v.enum([1, 2, 3, 5, 8] as const)
  .custom(
    value => value <= getCurrentUserMaxPriority(), // hypothetical function
    'Priority exceeds user\'s maximum allowed priority'
  )

// Examples:
type UserRole = 'admin' | 'user' | 'guest'
const userRoleValidator = v.enum<UserRole>(['admin', 'user', 'guest'] as const)

userRoleValidator.validate('admin') // valid
userRoleValidator.validate('superuser') // invalid
userRoleValidator.validate('guest') // valid

// Using with TypeScript discriminated unions
type UserStatus = 'active' | 'inactive' | 'suspended'
const statusValidator = v.enum<UserStatus>(['active', 'inactive', 'suspended'] as const)
```

### Date Validator

```typescript
const validator = v.date()
  .min(new Date('2023-01-01')) // minimum date
  .max(new Date('2023-12-31')) // maximum date
  .between(new Date('2023-01-01'), new Date('2023-12-31'))
  .isToday() // must be today
  .isWeekend() // must be weekend
  .isWeekday() // must be weekday
  .isBefore(new Date('2024-01-01'))
  .isAfter(new Date('2022-12-31'))
```

### Datetime Validator

```typescript
const validator = v.datetime()
  // Validates that the value is a valid Date object
  // within MySQL DATETIME range (1000-01-01 to 9999-12-31)

// Examples:
validator.validate(new Date()) // valid
validator.validate(new Date('999-12-31')) // invalid (before 1000-01-01)
validator.validate(new Date('10000-01-01')) // invalid (after 9999-12-31)
validator.validate('2023-01-01') // invalid (must be Date object)
```

### Timestamp Validator

```typescript
const validator = v.timestamp()
  // Validates that the value is a valid timestamp
  // within MySQL TIMESTAMP range (1970-01-01 to 2038-01-19)

// Examples:
validator.validate(Date.now()) // valid
validator.validate('1672531200000') // valid (string timestamp)
validator.validate(-1) // invalid (before 1970-01-01)
validator.validate(2147483648) // invalid (after 2038-01-19)
validator.validate('123456789') // invalid (too short)
validator.validate('12345678901234') // invalid (too long)
```

### Unix Validator

```typescript
const validator = v.unix()
  // Validates that the value is a valid Unix timestamp
  // Must be a positive number or string with 10-13 digits

// Examples:
validator.validate(Math.floor(Date.now() / 1000)) // valid (10 digits)
validator.validate(Date.now()) // valid (13 digits)
validator.validate('1672531200') // valid (string timestamp)
validator.validate(-1) // invalid (negative number)
validator.validate('123456789') // invalid (too short)
validator.validate('12345678901234') // invalid (too long)
```

### Object Validator

```typescript
// Basic object shape
const userValidator = v.object().shape({
  username: v.string().min(3),
  age: v.number().min(18)
})

// Nested object with strict mode
const profileValidator = v.object().shape({
  user: v.object().shape({
    firstName: v.string(),
    lastName: v.string(),
    contact: v.object().shape({
      email: v.string().email(),
      phone: v.string().optional()
    })
  }),
  settings: v.object().shape({
    newsletter: v.boolean(),
    theme: v.enum(['light', 'dark'] as const)
  })
}).strict()

// Example usage:
const profile = {
  user: {
    firstName: 'John',
    lastName: 'Doe',
    contact: {
      email: 'john@example.com',
      phone: '+1234567890'
    }
  },
  settings: {
    newsletter: true,
    theme: 'dark'
  }
}

const result = profileValidator.validate(profile)
console.log(result.valid) // true

// Invalid example with extra field (strict mode)
const invalidProfile = {
  user: {
    firstName: 'John',
    lastName: 'Doe',
    contact: {
      email: 'john@example.com'
    },
    extraField: 'not allowed' // This will fail in strict mode
  },
  settings: {
    newsletter: true,
    theme: 'light'
  }
}
```

### Custom Validator

```typescript
const validator = v.custom(
  (value: string) => value.startsWith('test-'),
  'Must start with "test-"'
)
```

## Validation Results

All validators provide detailed validation results:

```typescript
const validator = v.string().min(5).max(10)
const result = validator.validate('hi')

console.log(result.valid) // false
console.log(result.errors) // [{message: 'Must be at least 5 characters long'}]
```

## Optional Values

Any validator can be made optional:

```typescript
const validator = v.string().email().optional()
const result = validator.validate(undefined)
console.log(result.valid) // true
```

## Complex Example

Here's a more complex example showing multiple validations:

```typescript
const userValidator = v.object().shape({
  name: v.string().min(2).max(50),
  email: v.string().email(),
  age: v.number().min(18).integer(),
  website: v.string().url().optional(),
  tags: v.array<string>().each(v.string()).optional(),
  address: v.object().shape({
    street: v.string(),
    city: v.string(),
    zip: v.string()
  }).optional()
})

const user = {
  name: 'John Doe',
  email: 'john@example.com',
  age: 25,
  website: 'https://example.com',
  tags: ['developer', 'typescript'],
  address: {
    street: '123 Main St',
    city: 'New York',
    zip: '10001'
  }
}

const result = userValidator.validate(user)
console.log(result.valid) // true
```

## Error Handling

When validation fails, you get detailed error messages:

```typescript
const validator = v.object().shape({
  name: v.string().min(2),
  age: v.number().min(18),
  email: v.string().email()
})

const result = validator.validate({
  name: 'J',
  age: 16,
  email: 'invalid-email'
})

console.log(result.valid) // false
console.log(result.errors)
// [
//   { message: 'name: Must be at least 2 characters long' },
//   { message: 'age: Must be at least 18' },
//   { message: 'email: Must be a valid email address' }
// ]
```
