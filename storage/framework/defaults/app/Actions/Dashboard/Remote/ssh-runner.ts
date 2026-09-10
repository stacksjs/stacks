import type { RemoteAuditSink, RemoteCommand, RemoteHost, RemoteRunner } from './remote-commands'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { log } from '@stacksjs/logging'
import { sshArgv } from './remote-commands'

/**
 * The SSH transport and audit sink behind `runRemoteCommand`
 * (stacksjs/stacks#960).
 *
 * Split from `remote-commands.ts` so the resolution, authorization and audit
 * ordering can be tested without a network or a database - the same split
 * `file-manager.ts` makes with its `Manager` parameter.
 */

/**
 * A runner for one host, with that host's pinned keys written to a file only
 * this process can read.
 *
 * The known-hosts file is created per run and removed afterwards rather than
 * kept in `~/.ssh`: the app server may reach several hosts with different
 * operators, and a shared file is one where a stale entry for a decommissioned
 * box silently authorizes whoever picked up its address.
 */
export function createSshRunner(host: RemoteHost, command: RemoteCommand): RemoteRunner {
  return async (_argv, options) => {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-remote-'))
    const knownHostsPath = join(dir, 'known_hosts')

    try {
      writeFileSync(knownHostsPath, host.knownHosts.endsWith('\n') ? host.knownHosts : `${host.knownHosts}\n`)
      // ssh refuses a known-hosts file others can write.
      chmodSync(knownHostsPath, 0o600)

      const proc = Bun.spawn(sshArgv(host, command, knownHostsPath), {
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      })

      // A run that has not finished is killed rather than left. Without this a
      // hung ssh holds a process and a request until the server restarts.
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        proc.kill()
      }, options.timeoutMs)

      try {
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
          proc.exited,
        ])

        return { exitCode, stdout, stderr, timedOut }
      }
      finally {
        clearTimeout(timer)
      }
    }
    finally {
      // Always, including on the failure path: a pinned-key file left in the
      // temp directory on every run is both a leak and a growing surface.
      rmSync(dir, { force: true, recursive: true })
    }
  }
}

/**
 * The audit sink that writes to the application log.
 *
 * The log rather than a table, deliberately. A remote-command record is
 * append-only evidence about who did what, and the dashboard's own database is
 * the thing an operator with dashboard access could edit. Shipping to whatever
 * the app's logging is already configured to ship to keeps it outside the blast
 * radius of the surface it audits.
 *
 * An application that wants these queryable can pass its own sink; the
 * interface is two functions.
 */
export const loggingAuditSink: RemoteAuditSink = {
  async started(entry) {
    // Not `log.debug`: this is the record, and a level nobody ships in
    // production is the same as not recording it.
    await log.info(`[remote] ${entry.user} started ${entry.commandKey} on ${entry.hostKey} at ${entry.at}`)
  },

  async finished(entry) {
    const outcome = entry.timedOut ? 'timed out' : `exited ${entry.exitCode}`
    await log.info(`[remote] ${entry.user} finished ${entry.commandKey} on ${entry.hostKey}: ${outcome} in ${entry.durationMs}ms`)
  },
}
