import type { BoundedProcessOptions, BoundedProcessResult } from '../src/process'
import { runBoundedProcess } from '../src/process'

type Expect<T extends true> = T
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

export type CancellationOption = Expect<Equal<BoundedProcessOptions['signal'], AbortSignal | undefined>>
export type CaptureResult = Expect<Equal<ReturnType<typeof runBoundedProcess>, Promise<BoundedProcessResult>>>

const options = { timeoutMs: 1000, stdoutBytes: 1024, stderrBytes: 1024, label: 'Typed capture' }
export const cancelable = { ...options, signal: new AbortController().signal } satisfies BoundedProcessOptions
export const unchanged = { ...options } satisfies BoundedProcessOptions
// @ts-expect-error A cancellation flag is not an AbortSignal.
export const invalid = { ...options, signal: true } satisfies BoundedProcessOptions
