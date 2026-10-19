import { printAsync, printErrorAsync } from '../src'
import { print, printError } from '../src/output'

type Expect<T extends true> = T
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

export type PrintCompletion = Expect<Equal<ReturnType<typeof printAsync>, Promise<void>>>
export type DiagnosticCompletion = Expect<Equal<ReturnType<typeof printErrorAsync>, Promise<void>>>
export type SyncPrintCompletion = Expect<Equal<ReturnType<typeof print>, void>>
export type SyncDiagnosticCompletion = Expect<Equal<ReturnType<typeof printError>, void>>
