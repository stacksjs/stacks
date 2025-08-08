import type { BigintValidatorType, BinaryValidatorType, BlobValidatorType, BooleanValidatorType, DatetimeValidatorType, DateValidatorType, DecimalValidatorType, EnumValidatorType, FloatValidatorType, IntegerValidatorType, JsonValidatorType, NumberValidatorType, SmallintValidatorType, StringValidatorType, TimestampTzValidatorType, TimestampValidatorType, UnixValidatorType, ValidationType } from '@stacksjs/ts-validation'

export function isStringValidator(v: ValidationType): v is StringValidatorType {
  return v.name === 'string'
}

export function isNumberValidator(v: ValidationType): v is NumberValidatorType {
  return v.name === 'number'
}

export function enumValidator(v: ValidationType): v is EnumValidatorType {
  return v.name === 'enum'
}

export function isBooleanValidator(v: ValidationType): v is BooleanValidatorType {
  return v.name === 'boolean'
}

export function isDateValidator(v: ValidationType): v is DateValidatorType {
  return v.name === 'date'
}

export function isUnixValidator(v: ValidationType): v is UnixValidatorType {
  return v.name === 'unix'
}

export function isFloatValidator(v: ValidationType): v is FloatValidatorType {
  return v.name === 'float'
}

export function isDatetimeValidator(v: ValidationType): v is DatetimeValidatorType {
  return v.name === 'datetime'
}

export function isTimestampValidator(v: ValidationType): v is TimestampValidatorType {
  return v.name === 'timestamp'
}

export function isTimestampTzValidator(v: ValidationType): v is TimestampTzValidatorType {
  return v.name === 'timestampTz'
}

export function isDecimalValidator(v: ValidationType): v is DecimalValidatorType {
  return v.name === 'decimal'
}

export function isSmallintValidator(v: ValidationType): v is SmallintValidatorType {
  return v.name === 'smallint'
}

export function isIntegerValidator(v: ValidationType): v is IntegerValidatorType {
  return v.name === 'integer'
}

export function isBigintValidator(v: ValidationType): v is BigintValidatorType {
  return v.name === 'bigint'
}

export function isBinaryValidator(v: ValidationType): v is BinaryValidatorType {
  return v.name === 'binary'
}

export function isBlobValidator(v: ValidationType): v is BlobValidatorType {
  return v.name === 'blob'
}

export function isJsonValidator(v: ValidationType): v is JsonValidatorType {
  return v.name === 'json'
}

export function checkValidator(validator: ValidationType, driver: string): string {
  if (enumValidator(validator))
    return prepareEnumColumnType(validator, driver)

  // Check for base types
  if (isStringValidator(validator))
    return prepareTextColumnType(validator, driver)

  if (isNumberValidator(validator))
    return prepareNumberColumnType(validator, driver)

  if (isBooleanValidator(validator))
    return `'boolean'` // Use boolean type for both MySQL and SQLite

  if (isDateValidator(validator))
    return `'date'`

  if (isDatetimeValidator(validator))
    return `'datetime'`

  if (isUnixValidator(validator))
    return `'bigint'`

  if (isTimestampValidator(validator))
    return `'timestamp'`

  if (isTimestampTzValidator(validator))
    return `'timestamp'`

  if (isFloatValidator(validator))
    return `'float'`

  if (isSmallintValidator(validator))
    return `'smallint'`

  if (isDecimalValidator(validator))
    return `'decimal'`

  if (isIntegerValidator(validator))
    return `'integer'`

  if (isBigintValidator(validator))
    return `'bigint'`

  if (isBinaryValidator(validator))
    return `'binary'`

  return ''
}

export function prepareNumberColumnType(validator: NumberValidatorType, driver = 'mysql'): string {
  // SQLite uses integer for all numbers
  if (driver === 'sqlite')
    return `'integer'`

  // Check for integer types
  if ('getRules' in validator) {
    const minRule = validator.getRules().find((rule: any) => rule.name === 'min')
    const maxRule = validator.getRules().find((rule: any) => rule.name === 'max')

    const min = minRule?.params?.min ?? -2147483648
    const max = maxRule?.params?.max ?? 2147483647

    return min >= -2147483648 && max <= 2147483647 ? `'integer'` : `'bigint'`
  }

  return `'integer'`
}

// Add new function for enum column types
export function prepareEnumColumnType(validator: EnumValidatorType, driver = 'mysql'): string {
  const allowedValues = validator.getAllowedValues()

  if (!allowedValues)
    throw new Error('Enum rule found but no allowedValues defined')

  const enumStructure = allowedValues.map((value: any) => `'${value}'`).join(', ')

  if (driver === 'sqlite')
    return `'text'` // SQLite doesn't support ENUM, but we'll enforce values at app level

  return `sql\`enum(${enumStructure})\`` // MySQL supports native ENUM
}

export function prepareTextColumnType(validator: StringValidatorType, driver = 'mysql'): string {
  // SQLite uses TEXT for all string types
  if (driver === 'sqlite')
    return `'text'`

  // Get length and choose appropriate MySQL type
  const maxLength = findCharacterLength(validator)

  return `'varchar(${maxLength})'`
}

// Add new function for date/time column types
export function prepareDateTimeColumnType(validator: DateValidatorType, driver = 'mysql'): string {
  if (driver === 'sqlite')
    return `'text'` // SQLite uses TEXT for dates

  const name = validator.name
  // Try to determine specific date type

  if (name === 'unix')
    return `'bigint'`

  // Default to datetime
  return name || 'date'
}

export function findCharacterLength(validator: ValidationType): number {
  // Check for max length constraint
  if ('getRules' in validator) {
    const maxLengthRule = validator.getRules().find((rule: any) => rule.name === 'max')

    return maxLengthRule?.params?.length || maxLengthRule?.params?.max || 255
  }

  return 255
}
