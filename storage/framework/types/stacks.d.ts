/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import type { MoneyValidator } from 'stacks:validation'

/**
 * Inform TypeScript about the custom/user-added macros
 */
declare module 'stacks:validation' {
  interface Validator {
    money(): MoneyValidator
  }
}

declare module 'stacks:arrays' {
  interface Validator {
    // add custom methods to arrays
  }
}

declare module 'stacks:strings' {
  interface Validator {
    // add custom methods to strings
  }
}

/**
 * Inform TypeScript about the custom/user-added macros
 */
declare module '@stacksjs/validation' {
  interface Validator {
    money(): MoneyValidator
  }
}

declare module '@stacksjs/arrays' {
  interface Validator {
    // add custom methods to arrays
  }
}

declare module '@stacksjs/strings' {
  interface Validator {
    // add custom methods to strings
  }
}
