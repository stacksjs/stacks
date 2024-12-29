import type { CatchCallbackFn, CronOptions, ProtectCallbackFn } from 'croner'

export type {
  CatchCallbackFn,
  CronOptions,
  ProtectCallbackFn,
}

export type IntRange<Min extends number, Max extends number> = number extends Min | Max
  ? never
  : number | [Min | number, Max | number]
