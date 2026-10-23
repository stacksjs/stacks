import { dlopen, FFIType as f, ptr } from 'bun:ffi'
const { symbols: api } = dlopen('kernel32.dll', {
  GetCurrentProcess: { args: [], returns: f.u64 },
  CreateJobObjectW: { args: [f.ptr, f.ptr], returns: f.u64 },
  SetInformationJobObject: { args: [f.u64, f.i32, f.ptr, f.u32], returns: f.i32 },
  QueryInformationJobObject: { args: [f.u64, f.i32, f.ptr, f.u32, f.ptr], returns: f.i32 },
  CloseHandle: { args: [f.u64], returns: f.i32 },
})
if (api.GetCurrentProcess() !== 0xffffffffffffffffn) throw new Error('Unexpected process pseudo-handle')
const job = api.CreateJobObjectW(null, null)
if (job === 0n) throw new Error('Job Object creation failed')
const limits = new BigUint64Array(18)
new DataView(limits.buffer).setUint32(16, 0x2000, true)
if (!api.SetInformationJobObject(job, 9, ptr(limits), limits.byteLength)) throw new Error('Job limits failed')
const accounting = new BigUint64Array(6)
if (!api.QueryInformationJobObject(job, 1, ptr(accounting), accounting.byteLength, null)) throw new Error('Job accounting failed')
if (new DataView(accounting.buffer).getUint32(40, true) !== 0) throw new Error('Unexpected active member')
if (!api.CloseHandle(job)) throw new Error('Job handle close failed')
console.log('Native Win32 job ABI available; zero active members; handles valid.')
