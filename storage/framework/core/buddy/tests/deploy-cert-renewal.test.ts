import { expect, test } from 'bun:test'
import { rpxCertificateRenewalScript } from '../src/commands/deploy-cert-renewal'

function runRenewal(unitStatus: number, journalStatus: number) {
  const fixture = `
systemctl() {
  [ "$1" = start ] && [ "$2" = rpx-cert-renew-status-fixture.service ] || return 99
  if [ ${unitStatus} -ne 0 ]; then printf '%s\\n' 'Renewal service failed' >&2; fi
  return ${unitStatus}
}
journalctl() {
  [ "$1" = -u ] && [ "$2" = rpx-cert-renew-status-fixture.service ] || return 98
  if [ ${journalStatus} -eq 0 ]; then printf '%s\\n' '[ts-cloud] Fixture certificate coverage result'; fi
  return ${journalStatus}
}
${rpxCertificateRenewalScript('status fixture')}
`
  return Bun.spawnSync(['/bin/bash', '-s'], { stdin: Buffer.from(fixture) })
}

test('reports a successful renewal unit with optional journal context', () => {
  const result = runRenewal(0, 0)
  expect(result.exitCode).toBe(0)
  expect(result.stdout.toString()).toContain('Fixture certificate coverage result')
  expect(result.stderr.toString()).toBe('')
  expect(runRenewal(0, 1).exitCode).toBe(0)
})

test('preserves a failed or missing unit and routes its journal context to stderr', () => {
  const failed = runRenewal(1, 0)
  expect(failed.exitCode).toBe(1)
  expect(failed.stderr.toString()).toContain('Renewal service failed')
  expect(failed.stderr.toString()).toContain('Fixture certificate coverage result')
  expect(failed.stdout.toString()).toBe('')
  expect(runRenewal(5, 1).exitCode).toBe(5)
})
