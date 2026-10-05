/**
 * Runs a real `buddy domains:*` command, with the two calls that would touch
 * DNS swapped for recorders. Prints what they received and exits. For
 * domains-commands.test.ts.
 */
import process from 'node:process'

const record = (call: string, payload: unknown): never => {
  console.log(JSON.stringify({ call, payload }))
  process.exit(0)
}

const actions = await import('@stacksjs/actions')
const dns = await import('@stacksjs/dns')
Bun.plugin({
  setup(build) {
    build.module('@stacksjs/actions', () => ({
      exports: { ...actions, runAction: async (action: string, options: Record<string, unknown>) => record('runAction', { action, options }) },
      loader: 'object',
    }))
    build.module('@stacksjs/dns', () => ({
      exports: { ...dns, addDomain: async (options: Record<string, unknown>) => record('addDomain', { options }) },
      loader: 'object',
    }))
  },
})

const { cli } = await import('@stacksjs/cli')
const { domains } = await import('../../src/commands/domains')

const buddy = cli('buddy')
domains(buddy)
await buddy.parse(['node', 'buddy', ...process.argv.slice(2)])
