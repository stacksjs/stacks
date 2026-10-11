/**
 * Entry compiled by maintenance-compiled-binary.test.ts.
 *
 * Prints whether `maintenanceGate()` refused a request, and which file the
 * site-mode read resolved to, so the test can tell "did not gate" apart from
 * "gated for the wrong reason".
 *
 * Behind `import.meta.main` because `bun test <dir>` loads every `.ts` under
 * the directory, and this one is meant to be an entrypoint rather than a
 * module with a side effect.
 */

if (import.meta.main) {
  const { existsSync } = await import('node:fs')
  const { maintenanceFilePath, maintenanceGate } = await import('../../src/maintenance')

  // A remote client. `isAllowedIp` trusts localhost outside production, so a
  // request with no forwarded address is waved through and would hide the bug.
  const request = new Request('https://example.com/orders', {
    headers: { 'x-forwarded-for': '203.0.113.9' },
  })
  const gated = await maintenanceGate(request)

  // `fileExists` is what keeps the test honest: a gate that declines because
  // there was nothing to find proves nothing.
  const reads = maintenanceFilePath()

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ reads, fileExists: existsSync(reads), status: gated ? gated.status : null }))
}
