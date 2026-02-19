export type CatchCallbackFn = (error: Error) => void
export type ProtectCallbackFn = () => void

export type IntRange<Min extends number, Max extends number> = number extends Min | Max
  ? never
  : number | [Min | number, Max | number]
