import { describe, expect, it } from 'bun:test'
import { validateLifecycleReport } from './desktop-lifecycle-report'

const steps = ['install v1', 'launch v1', 'update to v2', 'launch v2', 'rollback to v1', 'launch rollback', 'uninstall', 'verify uninstall']
const revision = 'd'.repeat(40)

describe('desktop lifecycle report validation', () => {
  it('requires a complete source-pinned lifecycle and two versioned artifacts per format', () => {
    const report = {
      revision,
      status: 'passed',
      installLifecycleExercised: true,
      runner: { os: 'linux', arch: 'x64' },
      steps: steps.map(name => ({ name, status: 'passed' })),
      artifacts: [{ format: 'deb', sha256: 'a'.repeat(64) }, { format: 'deb', sha256: 'b'.repeat(64) }],
    }
    expect(validateLifecycleReport(report, { revision, platform: 'linux', architecture: 'x64', formats: ['deb'] })).toEqual([])
  })

  it('rejects missing rollback, wrong source, and invalid artifact evidence', () => {
    const errors = validateLifecycleReport({
      revision: 'wrong',
      status: 'passed',
      installLifecycleExercised: true,
      runner: { os: 'linux', arch: 'x64' },
      steps: steps.filter(name => name !== 'rollback to v1').map(name => ({ name, status: 'passed' })),
      artifacts: [{ format: 'deb', sha256: 'short' }],
    }, { revision, platform: 'linux', architecture: 'x64', formats: ['deb'] })
    expect(errors).toEqual(expect.arrayContaining([
      'Craft source revision mismatch: wrong',
      'lifecycle step did not pass: rollback to v1',
      'expected two deb artifacts, found 1',
      'deb artifact has an invalid digest',
    ]))
  })
})
