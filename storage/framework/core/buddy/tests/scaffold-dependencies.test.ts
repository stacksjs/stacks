import { describe, expect, test } from 'bun:test'
import { bunExecutable, failureReason, installScaffoldDependencies } from '../src/scaffold-dependencies'

/**
 * `buddy new` used to exit the moment `pantry install` failed, leaving the
 * template half converted with no `node_modules` (stacksjs/stacks#3209). These
 * pin what it does instead, with the installers replaced by fakes that record
 * whether they ran.
 */
function installers(options: { pantry: string | null, bun: string | null, pantryWritesModules?: boolean, bunWritesModules?: boolean }) {
  let modules = false
  const calls: string[] = []
  return {
    calls,
    runners: {
      pantry: async () => {
        calls.push('pantry')
        if (options.pantry === null && options.pantryWritesModules !== false)
          modules = true
        return options.pantry
      },
      hasNodeModules: () => modules,
      bunInstall: async () => {
        calls.push('bun')
        if (options.bun === null && options.bunWritesModules !== false)
          modules = true
        return options.bun
      },
    },
  }
}

describe('installing a new app\'s dependencies (#3209)', () => {
  test('a working Pantry installs everything, and Bun is not run', async () => {
    const { calls, runners } = installers({ pantry: null, bun: null })
    expect(await installScaffoldDependencies(runners)).toEqual({ status: 'complete' })
    expect(calls).toEqual(['pantry'])
  })

  test('an unreachable Pantry registry still finishes, with Bun installing the JavaScript packages', async () => {
    const { calls, runners } = installers({ pantry: 'Timeout', bun: null })
    expect(await installScaffoldDependencies(runners)).toEqual({ status: 'system-dependencies-missing', pantryFailure: 'Timeout' })
    expect(calls).toEqual(['pantry', 'bun'])
  })

  test('a Pantry that succeeds without node_modules is completed by Bun, not reported as missing', async () => {
    const { calls, runners } = installers({ pantry: null, bun: null, pantryWritesModules: false })
    expect(await installScaffoldDependencies(runners)).toEqual({ status: 'complete' })
    expect(calls).toEqual(['pantry', 'bun'])
  })

  test('when Bun fails too, the scaffold stops with both reasons', async () => {
    const { runners } = installers({ pantry: 'Timeout', bun: 'registry.npmjs.org unreachable' })
    expect(await installScaffoldDependencies(runners)).toEqual({ status: 'failed', pantryFailure: 'Timeout', bunFailure: 'registry.npmjs.org unreachable' })
  })

  test('a Bun install that exits zero without node_modules is a failure, not a pass', async () => {
    const { runners } = installers({ pantry: 'Timeout', bun: null, bunWritesModules: false })
    const outcome = await installScaffoldDependencies(runners)
    expect(outcome.status).toBe('failed')
  })
})

describe('the Bun that installs the packages', () => {
  test('the one on PATH wins', () => {
    expect(bunExecutable('/usr/local/bin/bun', '/opt/bun/bin/bun', false)).toBe('/usr/local/bin/bun')
    expect(bunExecutable('/usr/local/bin/bun', '/usr/local/bin/buddy', true)).toBe('/usr/local/bin/bun')
  })

  test('otherwise the running Bun, unless buddy is compiled and the running process is buddy itself', () => {
    expect(bunExecutable(null, '/opt/bun/bin/bun', false)).toBe('/opt/bun/bin/bun')
    expect(bunExecutable(null, '/usr/local/bin/buddy', true)).toBeNull()
  })
})

test('failure reasons are one line of text', () => {
  expect(failureReason(new Error('Timeout'))).toBe('Timeout')
  expect(failureReason('exit 1')).toBe('exit 1')
})
