
import type { BooleanValidatorType, DatetimeValidatorType, DateValidatorType, EnumValidatorType, NumberValidatorType, StringValidatorType, TimestampValidatorType, UnixValidatorType, ValidationType, FloatValidatorType } from '@stacksjs/ts-validation'

export function isStringValidator(v: ValidationType): v is StringValidatorType {
  return v.name === 'string'
}
  
export function isNumberValidator(v: ValidationType): v is NumberValidatorType {
  return v.name === 'number'
}

export function enumValidator(v: ValidationType): v is EnumValidatorType<string | number> {
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
  