/**
 * Which site runs the app's scheduled work.
 *
 * `app/Scheduler.ts` is the Laravel-shaped place to declare recurring work, and
 * a deploy shipped it to a box where nothing ran it: ts-cloud installs a
 * scheduler for a site that asks for one, and nothing ever asked. Every
 * schedule any app declared was inert in production — silently, because a task
 * that never fires looks exactly like a task with nothing to do.
 *
 * Both mistakes here are quiet ones. Turning it on for every site fires every
 * job twice, which surfaces as two of every email rather than as an error.
 * Turning it on for an app that schedules nothing leaves a daemon running a
 * loop with no work in it.
 */

import { describe, expect, it } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyScheduledWork, declaresScheduledWork } from '../src/commands/deploy'

/** An `app/Scheduler.ts` holding `body`, at a path no other test shares. */
function schedulerFile(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-scheduler-'))
  const file = join(dir, 'Scheduler.ts')

  writeFileSync(file, body)

  return file
}

/** The two-site shape this is really about: one codebase, `main` + `api`. */
const SITES = {
  main: {
    start: 'bun storage/framework/runtime/production/serve.js',
    preStart: ['bun install', './buddy migrate'],
  },
  api: { start: 'bun node_modules/@stacksjs/actions/dist/serve/api.js', preStart: ['bun install'] },
  docs: { root: 'docs' },
}

const REAL = schedulerFile(`
  export default function () {
    schedule.job('Inspire').hourly()
    schedule.command('./buddy menu:sync').daily().at('04:00')
  }
`)

describe('declaresScheduledWork', () => {
  it('is false for an app with no Scheduler.ts at all', () => {
    expect(declaresScheduledWork(join(tmpdir(), 'nothing-here', 'Scheduler.ts'))).toBe(false)
  })

  it('is false when every example is still commented out', () => {
    /*
     * The scaffold's file names `schedule.action` and `schedule.command` in its
     * commented examples. Counting those would put an always-on daemon on every
     * app that was generated and never edited.
     */
    const scaffold = schedulerFile(`
      export default function () {
        // schedule.action('CleanupTempFiles').everyFiveMinutes()
        /* schedule.command('echo hi').daily() */
      }
    `)

    expect(declaresScheduledWork(scaffold)).toBe(false)
  })

  it('is true once something is actually scheduled', () => {
    expect(declaresScheduledWork(REAL)).toBe(true)
  })

  it('does not read a protocol-relative URL as a comment', () => {
    // `//` inside a string is not a comment, and treating it as one would eat
    // the rest of the line — including a schedule declared after it.
    const withUrl = schedulerFile(`
      export default function () {
        schedule.command('curl https://example.com/ping').daily()
      }
    `)

    expect(declaresScheduledWork(withUrl)).toBe(true)
  })
})

describe('applyScheduledWork', () => {
  it('turns the scheduler on', () => {
    const out = applyScheduledWork(SITES, REAL)

    expect(out.main.scheduler).toBe(true)
  })

  it('turns it on for exactly one site', () => {
    /*
     * One `app/Scheduler.ts` is shared by every site of a project. A scheduler
     * per site runs the same jobs that many times over — two menu imports
     * racing each other over one SQLite file, two of every email.
     */
    const on = Object.values(applyScheduledWork(SITES, REAL)).filter(site => site.scheduler)

    expect(on).toHaveLength(1)
  })

  it('picks the site that owns the database', () => {
    // The same owner the persistent-state paths pick: scheduled work writes,
    // and it should write from the site whose migrations built the schema.
    const reordered = { api: SITES.api, main: SITES.main }

    expect(applyScheduledWork(reordered, REAL).main.scheduler).toBe(true)
    expect(applyScheduledWork(reordered, REAL).api.scheduler).toBeUndefined()
  })

  it('falls back to the first app site when nothing migrates', () => {
    const noMigrations = { api: { start: 'bun serve.js', preStart: ['bun install'] } }

    expect(applyScheduledWork(noMigrations, REAL).api.scheduler).toBe(true)
  })

  it('never puts one on a static site', () => {
    // `docs` has no `start`: it is build output behind a web server, with no
    // process to schedule anything from.
    expect(applyScheduledWork(SITES, REAL).docs.scheduler).toBeUndefined()
  })

  it('installs nothing for an app that schedules nothing', () => {
    const empty = schedulerFile('export default function () {}')

    for (const site of Object.values(applyScheduledWork(SITES, empty)))
      expect(site.scheduler).toBeUndefined()
  })

  it('leaves a site that decided for itself alone', () => {
    // Explicit in both directions: an app that runs its scheduler somewhere
    // else has said so, and one that turned it off has said that too.
    const off = applyScheduledWork({ ...SITES, main: { ...SITES.main, scheduler: false } }, REAL)

    expect(off.main.scheduler).toBe(false)
    expect(off.api.scheduler).toBeUndefined()

    const elsewhere = applyScheduledWork({ ...SITES, api: { ...SITES.api, scheduler: true } }, REAL)

    expect(elsewhere.api.scheduler).toBe(true)
    expect(elsewhere.main.scheduler).toBeUndefined()
  })

  it('does not mutate the sites it was given', () => {
    const sites = { main: { start: 'bun serve.js' } }

    applyScheduledWork(sites, REAL)

    expect(sites.main).not.toHaveProperty('scheduler')
  })
})
