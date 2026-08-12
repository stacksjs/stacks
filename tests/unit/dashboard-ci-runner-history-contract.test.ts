import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('dashboard CI runner history contract', () => {
  test('uses native HTTP errors across CI read endpoints', () => {
    const actionDirectory = resolve('storage/framework/defaults/app/Actions/Dashboard/Ci')
    const actions = ['StatusAction.ts', 'RepoRunsAction.ts', 'RepoRunJobsAction.ts', 'RunnerHistoryAction.ts']
      .map(file => readFileSync(resolve(actionDirectory, file), 'utf8'))
      .join('\n')

    expect(actions).not.toMatch(/error: err instanceof|status: 40[03]/)
    expect(actions).toContain("response.json({ message: 'CI status could not be loaded.' }, 502)")
    expect(actions).toContain("response.json({ message: 'Workflow runs could not be loaded.' }, 502)")
    expect(actions).toContain("response.json({ message: 'Workflow jobs could not be loaded.' }, 502)")
    expect(actions).toContain("response.json({ message: 'Runner history could not be loaded.' }, 503)")
  })

  test('reports operational history failures with an HTTP error', () => {
    const action = readFileSync(
      resolve('storage/framework/defaults/app/Actions/Dashboard/Ci/RunnerHistoryAction.ts'),
      'utf8',
    )

    expect(action).toContain("response.json({ message: 'Runner history could not be loaded.' }, 503)")
    expect(action).not.toContain('samples: [], error:')
  })

  test('keeps per-org failure state and allows a real retry', () => {
    const store = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/stores/ci.ts'),
      'utf8',
    )
    const component = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/Ci/CiDashboard.stx'),
      'utf8',
    )

    expect(store).toContain('const runnerHistoryErrors = state<Record<string, string>>({})')
    expect(store).toContain('async function loadRunnerHistory(org: string, force = false)')
    expect(store).not.toContain('Soft-fail')
    expect(component).toContain('role="alert"')
    expect(component).toContain('Runner history unavailable')
    expect(component).toContain('<Button variant="secondary" size="xs"')
    expect(component).toContain('ci.loadRunnerHistory(tab, true)')
  })
})
