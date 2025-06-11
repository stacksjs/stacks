// export declare class ValidationError extends Error {
//   messages: any
//   status: number
//   code: string
//   constructor(messages: any, options?: ErrorOptions)
//   get [Symbol.toStringTag](): string
//   toString(): string
// }

export type CommandError = Error

export interface ErrorResponse {
  status: number // HTTP status code
  errors: string | object // Error message(s), which can be a string or an object
  stack?: string // Optional stack trace
  name: string
  message: string
}

export interface ErrorOptions {
  messages: {
    'string': string
    'email': string
    'regex': string
    'url': string
    'activeUrl': string
    'alpha': string
    'alphaNumeric': string
    'maxLength': string
    'fixedLength': string
    'confirmed': string
    'endsWith': string
    'startsWith': string
    'sameAs': string
    'notSameAs': string
    'in': string
    'notIn': string
    'ipAddress': string
    'uuid': string
    'ascii': string
    'creditCard': string
    'hexCode': string
    'iban': string
    'jwt': string
    'coordinates': string
    'mobile': string
    'passport': string
    'postalCode': string

    // boolean
    'boolean': string

    // number
    'number': string
    'min': string
    'max': string
    'range': string
    'positive': string
    'negative': string
    'decimal': string
    'withoutDecimals': string

    // date
    'date': string
    'date.equals': string
    'date.after': string
    'date.before': string
    'date.afterOrEqual': string
    'date.beforeOrEqual': string
    'date.sameAs': string
    'date.notSameAs': string
    'date.afterField': string

    // accepted
    'accepted': string

    // enum
    'enum': string

    // literal
    'literal': string

    // object
    'object': string

    // record
    'record': string
    'record.min': string
    'record.maxLength': string
    'record.fixedLength': string

    // array
    'array': string
    'array.min': string
    'array.maxLength': string
    'array.fixedLength': string
    'notEmpty': string
    'distinct': string

    // tuple
    'tuple': string

    // union
    'union': string
    'unionGroup': string
    'unionOfTypes': string
  }
}

export type ErrorConfig = Partial<ErrorOptions>
