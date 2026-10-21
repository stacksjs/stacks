import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ProjectScriptOptions {
  cwd: string
  scripts: string[]
  env?: Record<string, string | undefined>
  signal?: AbortSignal
  timeoutMs?: number
  /** Optional synchronous live output observer. Receipts still retain only hashes. */
  onOutput?: (chunk: Uint8Array, stream: 'stdout' | 'stderr') => void
}

export interface ProjectScriptReceipt {
  bunVersion: string
  checks: Array<{ script: string, exitCode: 0, outputSha256: string }>
}

interface PackageManifest { scripts?: Record<string, string>, engines?: { bun?: string } }

function fail(message: string): never {
  throw new Error(message)
}

/** Inline so a standalone compiled Buddy needs no adjacent helper files. */
function windowsCheckCommand(powershell: string, bun: string, script: string): string[] {
  const source = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public static class StacksOwnedCheck {
  [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
    public long ProcessTime, JobTime;
    public uint Flags;
    public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint Priority, Scheduling;
  }
  [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
    public BasicLimits Basic;
    public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
    public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
  }
  [StructLayout(LayoutKind.Sequential)] struct Accounting {
    public long UserTime, KernelTime, PeriodUserTime, PeriodKernelTime;
    public uint PageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct Startup {
    public uint Size;
    public IntPtr Reserved, Desktop, Title;
    public uint X, Y, XSize, YSize, XChars, YChars, Fill, Flags;
    public ushort Show, ReservedSize;
    public IntPtr ReservedBytes, Input, Output, Error;
  }
  [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {
    public IntPtr Process, Thread;
    public uint ProcessId, ThreadId;
  }
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern IntPtr CreateJobObjectW(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits limits, uint size);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool QueryInformationJobObject(IntPtr job, int kind, out Accounting info, uint size, IntPtr returned);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool DuplicateHandle(IntPtr sourceProcess, IntPtr source, IntPtr targetProcess,
    out IntPtr target, uint access, bool inherit, uint options);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int kind);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern IntPtr CreateFileW(string name, uint access, uint share, IntPtr security,
    uint disposition, uint flags, IntPtr template);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool PeekNamedPipe(IntPtr pipe, IntPtr buffer, uint size, IntPtr read,
    out uint available, IntPtr remaining);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CreateProcessW(string application, StringBuilder command, IntPtr processSecurity,
    IntPtr threadSecurity, bool inherit, uint flags, IntPtr environment, string directory,
    ref Startup startup, out ProcessInfo process);
  [DllImport("kernel32.dll", SetLastError = true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll", SetLastError = true)] static extern uint WaitForSingleObject(IntPtr handle, uint timeout);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool TerminateProcess(IntPtr process, uint code);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool CloseHandle(IntPtr handle);
  static void Require(bool success) { if (!success) throw new Win32Exception(Marshal.GetLastWin32Error()); }
  static IntPtr InheritableStandardHandle(int kind) {
    IntPtr source = GetStdHandle(kind);
    if (source == IntPtr.Zero || source == new IntPtr(-1)) return IntPtr.Zero;
    IntPtr inherited;
    Require(DuplicateHandle(GetCurrentProcess(), source, GetCurrentProcess(), out inherited, 0, true, 2));
    return inherited;
  }
  static IntPtr ConsumerInput() {
    IntPtr source = CreateFileW("NUL", 0x80000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
    Require(source != new IntPtr(-1));
    try {
      IntPtr inherited;
      Require(DuplicateHandle(GetCurrentProcess(), source, GetCurrentProcess(), out inherited, 0, true, 2));
      return inherited;
    } finally { CloseHandle(source); }
  }
  static bool StopRequested() {
    uint available;
    if (PeekNamedPipe(GetStdHandle(-10), IntPtr.Zero, 0, IntPtr.Zero, out available, IntPtr.Zero))
      return available != 0;
    int error = Marshal.GetLastWin32Error();
    if (error == 109 || error == 232) return true; // Closed control pipe.
    throw new Win32Exception(error);
  }
  static IntPtr Job() {
    IntPtr job = CreateJobObjectW(IntPtr.Zero, null);
    Require(job != IntPtr.Zero);
    ExtendedLimits limits = new ExtendedLimits();
    limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    try { Require(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits)))); }
    catch { CloseHandle(job); throw; }
    return job;
  }
  public static int Run(string bun, string script) {
    // A queued stop must prevent startup even when Add-Type took most of the
    // check's budget. The control pipe is never inherited as consumer stdin.
    if (StopRequested()) return 1;
    // The outer job owns this host before it creates anything. If cancellation
    // races suspended-child assignment below, host death still kills that child.
    // Retain this non-inheritable handle until process exit; closing it earlier
    // would terminate this host before it can return the command's exit code.
    IntPtr lifetime = Job();
    Require(AssignProcessToJobObject(lifetime, GetCurrentProcess()));
    IntPtr commandJob = Job();
    ProcessInfo child = new ProcessInfo();
    try {
      Startup startup = new Startup();
      startup.Size = (uint)Marshal.SizeOf(typeof(Startup));
      startup.Flags = 0x100; // STARTF_USESTDHANDLES
      // Bun can supply non-inheritable standard handles to PowerShell. A
      // native CreateProcess child needs explicitly inheritable duplicates.
      // Never execute user code before it belongs to the inner cleanup job.
      try {
        startup.Input = ConsumerInput();
        startup.Output = InheritableStandardHandle(-11);
        startup.Error = InheritableStandardHandle(-12);
        Require(CreateProcessW(bun, new StringBuilder("\\\"" + bun + "\\\" run " + script),
          IntPtr.Zero, IntPtr.Zero, true, 0x08000004, IntPtr.Zero, null, ref startup, out child));
      } finally {
        foreach (IntPtr handle in new[] { startup.Input, startup.Output, startup.Error })
          if (handle != IntPtr.Zero) CloseHandle(handle);
      }
      Require(AssignProcessToJobObject(commandJob, child.Process));
      bool cancelled = StopRequested();
      if (!cancelled) Require(ResumeThread(child.Thread) != 0xffffffff);
      while (!cancelled) {
        uint state = WaitForSingleObject(child.Process, 10);
        if (state == 0) break;
        Require(state == 258); // WAIT_TIMEOUT, otherwise retain the native error.
        cancelled = StopRequested();
      }
      uint code = 1;
      if (!cancelled) Require(GetExitCodeProcess(child.Process, out code));
      return unchecked((int)code);
    } finally {
      try {
        // Also dispose a suspended child if assigning its inner job failed.
        if (child.Process != IntPtr.Zero) {
          uint state = WaitForSingleObject(child.Process, 0);
          Require(state == 0 || state == 258);
          if (state == 258) Require(TerminateProcess(child.Process, 1));
        }
        // Membership survives an exited intermediate process, unlike a PID
        // tree. Query it on every exit path before closing the owning handle.
        // https://learn.microsoft.com/windows/win32/procthread/job-objects
        Require(TerminateJobObject(commandJob, 1));
        var cleanup = System.Diagnostics.Stopwatch.StartNew();
        while (true) {
          Accounting info;
          Require(QueryInformationJobObject(commandJob, 1, out info, (uint)Marshal.SizeOf(typeof(Accounting)), IntPtr.Zero));
          if (info.ActiveProcesses == 0 && (child.Process == IntPtr.Zero || WaitForSingleObject(child.Process, 0) == 0)) break;
          if (cleanup.ElapsedMilliseconds >= 1000) throw new TimeoutException("Owned Windows processes did not finish cleanup");
          Thread.Sleep(10);
        }
      } finally {
        if (child.Thread != IntPtr.Zero) CloseHandle(child.Thread);
        if (child.Process != IntPtr.Zero) CloseHandle(child.Process);
        Require(CloseHandle(commandJob));
      }
    }
  }
}
'@
exit [StacksOwnedCheck]::Run('${bun.replaceAll("'", "''")}', '${script}')
`
  return [powershell, '-NoLogo', '-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')]
}

/** Execute declared project checks with the installed Bun and owned cleanup. */
export async function runProjectScripts(options: ProjectScriptOptions): Promise<ProjectScriptReceipt> {
  const timeoutMs = options.timeoutMs ?? 300_000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0
    || !options.scripts.length || options.scripts.some(name => !/^[a-z0-9][\w:.-]*$/i.test(name))
    || new Set(options.scripts).size !== options.scripts.length)
    fail('Project checks need unique script names and a positive execution budget')
  const receipt: ProjectScriptReceipt = { bunVersion: '', checks: [] }
  const manifestPath = join(options.cwd, 'package.json')
  const originalManifest = readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(originalManifest) as PackageManifest
  // In a compiled Buddy, process.execPath is Buddy itself. Use the consumer's
  // installed Bun toolchain rather than recursively launching this executable.
  const bun = Bun.which('bun', { cwd: options.cwd })
  if (!bun) fail('Consumer Bun executable is unavailable')
  const probe = Bun.spawnSync([bun, '--version'], { cwd: options.cwd, stdout: 'pipe', stderr: 'pipe', timeout: 10_000 })
  const bunVersion = probe.stdout.toString().trim()
  if (probe.exitCode !== 0 || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(bunVersion)
    || !Bun.semver.satisfies(bunVersion, manifest.engines?.bun ?? '>=1.3.0'))
    fail('Consumer Bun executable does not satisfy the declared toolchain')
  receipt.bunVersion = bunVersion
  for (const script of options.scripts) {
    if (!Object.hasOwn(manifest.scripts ?? {}, script) || typeof manifest.scripts?.[script] !== 'string' || !manifest.scripts[script].trim())
      fail(`Consumer script ${script} is not declared`)
    options.signal?.throwIfAborted()
    const windowsTaskkill = process.platform === 'win32' ? Bun.which('taskkill.exe') : undefined
    const powershell = process.platform === 'win32' ? Bun.which('powershell.exe') ?? Bun.which('pwsh.exe') : undefined
    if (process.platform === 'win32' && (!windowsTaskkill || !powershell))
      fail('Windows process ownership requires taskkill.exe and PowerShell with .NET Add-Type')
    const command = powershell ? windowsCheckCommand(powershell, bun, script) : [bun, 'run', script]
    // Keep an owned Bun host alive after the command exits. Its IPC reports
    // command completion without losing the live tree anchor taskkill needs.
    // POSIX additionally owns the host's process group. Deliberately detached
    // processes remain outside this cleanup contract, which is not a sandbox.
    let reportExit: (code: number) => void = () => {}
    let reportFailure: (error: Error) => void = () => {}
    const reported = new Promise<number>((resolve, reject) => {
      reportExit = resolve
      reportFailure = reject
    })
    let interrupted = false
    let windowsHelperPid: number | undefined
    const host = powershell ? `
setInterval(() => {}, 60_000)
let command
let stopRequested = false
let start
const permitted = new Promise(resolve => { start = resolve })
process.on('message', async (message) => {
  if (message?.stop) {
    stopRequested = true
    start()
    if (command) {
      try {
        command.stdin.write(new Uint8Array([1]))
        await command.stdin.flush()
      } catch (error) { process.send({ error: String(error) }) }
    }
  } else if (message?.start) start()
})
process.send({ ready: true })
await permitted
if (stopRequested) process.send({ exitCode: 1 })
else {
  try {
    command = Bun.spawn(${JSON.stringify(command)}, { stdin: 'pipe', stdout: 'inherit', stderr: 'inherit' })
    process.send({ helperPid: command.pid })
    process.send({ exitCode: await command.exited })
  } catch (error) { process.send({ error: String(error) }) }
}
` : `
setInterval(() => {}, 60_000)
try {
  const command = Bun.spawn(${JSON.stringify(command)}, { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' })
  process.send({ exitCode: await command.exited })
} catch (error) {
  process.send({ error: String(error) })
}
`
    const child = Bun.spawn([bun, '--eval', host], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      detached: process.platform !== 'win32',
      ipc(message) {
        if (powershell && message?.ready === true) {
          try { child.send(interrupted ? { stop: true } : { start: true }) }
          catch (error) { reportFailure(new Error(`Consumer script ${script} control channel failed: ${String(error)}`)) }
        }
        else if (powershell && Number.isSafeInteger(message?.helperPid) && message.helperPid > 0) windowsHelperPid = message.helperPid
        else if (Number.isInteger(message?.exitCode)) reportExit(message.exitCode)
        else reportFailure(new Error(`Consumer script ${script} host failed: ${message?.error ?? 'invalid completion report'}`))
      },
    })
    const pipes = [child.stdout, child.stderr].map((stream, index) => ({ reader: stream.getReader(), done: false, source: index === 0 ? 'stdout' as const : 'stderr' as const }))
    let teardown: Promise<void> | undefined
    let announceStop: () => void = () => {}
    const stopped = new Promise<void>(resolve => { announceStop = resolve })
    const waitWithin = async <T>(promise: Promise<T>, milliseconds: number): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        return await Promise.race([promise, new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Process or output cleanup did not finish within its grace period')), milliseconds)
        })])
      }
      finally {
        if (timer) clearTimeout(timer)
      }
    }
    let draining: Promise<void>
    const dispose = (preserveOutput: boolean): Promise<void> => {
      if (teardown) return teardown
      teardown = (async () => {
        const errors: string[] = []
        if (windowsTaskkill) {
          if (!preserveOutput) {
            // Keep the native Job Object owner alive until it has terminated
            // the check and confirmed zero active members, including children
            // whose intermediate parent has already exited.
            try {
              child.send({ stop: true })
              await waitWithin(reported, 1000)
            }
            catch { errors.push('Native Windows cleanup completion was not confirmed') }
          }
          // Query and terminate the tree before its leader disappears. Killing
          // only the leader first loses taskkill's parent/descendant relation.
          try {
            const result = Bun.spawnSync([windowsTaskkill, '/PID', String(child.pid), '/T', '/F'], {
              stdout: 'ignore', stderr: 'ignore', timeout: 2000,
            })
            if (result.exitCode !== 0) errors.push(`taskkill failed with exit code ${result.exitCode}`)
          }
          catch { errors.push('Windows process-tree cleanup could not execute taskkill') }
          if (windowsHelperPid) {
            const until = performance.now() + 1000
            let alive = true
            while (alive) {
              try { process.kill(windowsHelperPid, 0) }
              catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false
                else break
              }
              if (!alive || performance.now() >= until) break
              await new Promise<void>(resolve => setTimeout(resolve, 10))
            }
            if (alive) errors.push('Native Windows helper disposal was not confirmed')
          }
          if (errors.length) {
            // Still dispose the direct child and readers while retaining the
            // tree-cleanup error; this must never produce a success receipt.
            try { child.kill('SIGKILL') }
            catch { errors.push('Direct child cleanup also failed') }
          }
        }
        else {
          const signalGroup = (signal: 'SIGTERM' | 'SIGKILL'): void => {
            try { process.kill(-child.pid, signal) }
            catch (error) {
              // The group may already have exited. Permission and other
              // failures are cleanup errors rather than successful disposal.
              if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
                const cause = error as NodeJS.ErrnoException
                errors.push(`Process-group ${signal} failed (code=${cause.code}, errno=${cause.errno}, message=${cause.message})`)
              }
            }
          }
          signalGroup('SIGTERM')
          await new Promise<void>(resolve => setTimeout(resolve, 500))
          signalGroup('SIGKILL')
          // Signal delivery alone does not prove disposal. Wait for the owned
          // group to disappear before a completed check can receive a receipt.
          const until = performance.now() + 1000
          let pendingError = ''
          while (true) {
            try { process.kill(-child.pid, 0) }
            catch (error) {
              const cause = error as NodeJS.ErrnoException
              if (cause.code === 'ESRCH') break
              pendingError = `signal=0, code=${cause.code}, errno=${cause.errno}, message=${cause.message}`
              // macOS reports EPERM for a killed group while its final process
              // is awaiting reaping. This still means disposal is unconfirmed:
              // yield for reaping, require ESRCH, and fail if the grace expires.
              if (cause.code !== 'EPERM') {
                errors.push(`Process-group disposal could not be confirmed (${pendingError})`)
                break
              }
            }
            if (performance.now() >= until) {
              errors.push(`Owned process group remained after cleanup${pendingError ? ` (${pendingError})` : ''}`)
              break
            }
            await new Promise<void>(resolve => setTimeout(resolve, 10))
          }
        }
        // On ordinary completion, retain all output before issuing a hash.
        // A descendant outside our group may hold the pipe indefinitely, so
        // even the drain has a bounded cleanup grace period.
        if (preserveOutput) {
          try { await waitWithin(draining, 1000) }
          catch { errors.push('Output draining exceeded its cleanup grace period') }
        }
        // On interruption or a failed drain, release held readers explicitly.
        const close = Promise.all([
          ...pipes.filter(pipe => !pipe.done).map(async (pipe) => {
            try { await pipe.reader.cancel() }
            catch { errors.push('Output reader cancellation failed') }
          }),
          child.exited,
        ])
        try { await waitWithin(close, 1000) }
        catch { errors.push('Process or output cleanup exceeded its grace period') }
        if (errors.length) fail(`Consumer script ${script} cleanup failed: ${errors.join('; ')}`)
      })()
      // The interruption race awaits this exact promise below. Attach its
      // rejection handler now so a quick cleanup failure is never unhandled.
      void teardown.catch(() => {})
      return teardown
    }
    const stop = (): void => {
      if (interrupted) return
      interrupted = true
      void dispose(false)
      announceStop()
    }
    void child.exited.then(code => {
      if (!teardown) reportFailure(new Error(`Consumer script ${script} host exited before reporting completion (exit code ${code})`))
    })
    const deadline = setTimeout(stop, timeoutMs)
    options.signal?.addEventListener('abort', stop, { once: true })
    if (options.signal?.aborted) stop()
    const output = createHash('sha256')
    async function drain(pipe: typeof pipes[number]): Promise<void> {
      try {
        while (true) {
          const next = await pipe.reader.read()
          if (next.done) break
          output.update(next.value)
          options.onOutput?.(next.value.slice(), pipe.source)
        }
      }
      finally {
        pipe.done = true
        pipe.reader.releaseLock()
      }
    }
    let exitCode: number
    try {
      draining = Promise.all(pipes.map(drain)).then(() => {})
      // Install the drain's handler immediately while command completion is
      // pending so reader failures cannot become unhandled rejections.
      void draining.catch(reportFailure)
      const completion = reported.then(exitCode => ({ kind: 'completed' as const, exitCode }))
      const result = await Promise.race([completion, stopped.then(() => ({ kind: 'interrupted' as const }))])
      if (result.kind === 'interrupted' || interrupted) {
        await teardown
        fail(`Consumer script ${script} was interrupted or exceeded its execution budget`)
      }
      exitCode = result.exitCode
      await dispose(true)
    }
    catch (error) {
      const wasInterrupted = interrupted
      stop()
      try { await teardown }
      catch (cleanupError) {
        // A deadline remains a failed deadline even when Windows also reports
        // a process-tree cleanup race. Retain both causes for the operator.
        if (wasInterrupted)
          fail(`Consumer script ${script} was interrupted or exceeded its execution budget; ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`)
        throw cleanupError
      }
      throw error
    }
    finally {
      clearTimeout(deadline)
      options.signal?.removeEventListener('abort', stop)
    }
    if (interrupted || options.signal?.aborted)
      fail(`Consumer script ${script} was interrupted or exceeded its execution budget`)
    if (exitCode !== 0) fail(`Consumer script ${script} failed with exit code ${exitCode}`)
    if (readFileSync(manifestPath, 'utf8') !== originalManifest)
      fail(`Consumer script ${script} changed the project manifest`)
    receipt.checks.push({ script, exitCode: 0, outputSha256: output.digest('hex') })
  }
  return receipt
}
