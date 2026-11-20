/**
 * The zig-waf C ABI (`include/zig_waf.h`, ABI 1.1) through `bun:ffi`.
 *
 * Handles are opaque pointers passed as 64-bit integers. Structs are laid out
 * by hand from the header: every one starts with `struct_size` and
 * `abi_version`, and the library refuses a struct whose size does not cover a
 * field it reads, so a wrong size fails loudly instead of reading past the end.
 */

import { dlopen, FFIType, ptr } from 'bun:ffi'

/** The ABI this binding was written against: major 1, minor 1. */
export const ABI_VERSION = 0x00010001

export const Status = {
  OK: 0,
  INVALID_ARGUMENT: 1,
  UNSUPPORTED_ABI: 2,
  OUT_OF_MEMORY: 3,
  INVALID_CONFIG: 4,
  INVALID_LIFECYCLE: 5,
  LIMIT_EXCEEDED: 6,
  BUSY: 7,
  NOT_FOUND: 8,
  INTERNAL: 255,
} as const

const STATUS_NAMES = Object.fromEntries(Object.entries(Status).map(([name, code]) => [code, name])) as Record<number, string>

export function statusName(code: number): string {
  return STATUS_NAMES[code] ?? `status ${code}`
}

export const Mode = { ENABLED: 0, DETECTION_ONLY: 1 } as const
export const Phase = { REQUEST_HEADERS: 1, REQUEST_BODY: 2, LOGGING: 5 } as const
export const AuditFormat = { JSON: 1 } as const

/** `zig_waf_config_t`: 4 x u32, 5 x size_t, a pointer, 7 x u64. */
export const CONFIG_SIZE = 120
/** `zig_waf_intervention_t`: header, action, status, enforced, has_rule_id, rule_id, then 4 x u64. */
export const INTERVENTION_SIZE = 56

const u64 = FFIType.u64
const symbols = {
  zig_waf_abi_version: { args: [], returns: FFIType.u32 },
  zig_waf_create_with_rules_at: { args: [FFIType.ptr, FFIType.ptr, u64, FFIType.ptr, u64, FFIType.ptr], returns: FFIType.i32 },
  zig_waf_destroy: { args: [u64], returns: FFIType.i32 },
  zig_waf_transaction_create: { args: [u64, FFIType.ptr], returns: FFIType.i32 },
  zig_waf_transaction_destroy: { args: [u64], returns: FFIType.void },
  zig_waf_transaction_process_connection: { args: [u64, FFIType.ptr, u64, FFIType.u16, FFIType.ptr, u64, FFIType.u16], returns: FFIType.i32 },
  zig_waf_transaction_process_uri: { args: [u64, FFIType.ptr, u64, FFIType.ptr, u64, FFIType.ptr, u64], returns: FFIType.i32 },
  zig_waf_transaction_add_request_header: { args: [u64, FFIType.ptr, u64, FFIType.ptr, u64], returns: FFIType.i32 },
  zig_waf_transaction_process_request_headers: { args: [u64], returns: FFIType.i32 },
  zig_waf_transaction_write_request_body: { args: [u64, FFIType.ptr, u64], returns: FFIType.i32 },
  zig_waf_transaction_process_request_body: { args: [u64], returns: FFIType.i32 },
  zig_waf_transaction_evaluate_phase: { args: [u64, FFIType.u32], returns: FFIType.i32 },
  zig_waf_transaction_intervention: { args: [u64, FFIType.ptr], returns: FFIType.i32 },
} as const

export type ZigWafLibrary = ReturnType<typeof dlopen<typeof symbols>>['symbols']

const opened = new Map<string, ZigWafLibrary>()

/**
 * Open the library at `path` and check its ABI: same major, and a minor at
 * least the one this binding needs. A library that predates the binding is
 * refused rather than called with structs it does not know.
 */
export function openLibrary(path: string): ZigWafLibrary {
  const cached = opened.get(path)
  if (cached)
    return cached

  const library = dlopen(path, symbols).symbols
  const abi = library.zig_waf_abi_version()
  if (abi >>> 16 !== ABI_VERSION >>> 16 || (abi & 0xFFFF) < (ABI_VERSION & 0xFFFF))
    throw new Error(`${path} speaks zig-waf ABI ${formatAbi(abi)}; @stacksjs/waf needs ${formatAbi(ABI_VERSION)} or a later minor of the same major.`)

  opened.set(path, library)
  return library
}

function formatAbi(abi: number): string {
  return `${abi >>> 16}.${abi & 0xFFFF}`
}

/** A buffer the library reads, kept alive by the caller for the call. */
export function bytes(value: string | Uint8Array): Uint8Array {
  return typeof value === 'string' ? Buffer.from(value) : value
}

export { ptr }
