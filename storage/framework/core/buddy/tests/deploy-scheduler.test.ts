/**
 * The unit that runs an app's scheduled work.
 *
 * `app/Scheduler.ts` is the Laravel-shaped place to declare recurring work, and
 * a deploy shipped it to a box where nothing ever ran it. Every schedule an app
 * declared was inert in production — silently, because a task that never fires
 * looks exactly like a task with nothing to do.
 *
 * These read the generated unit rather than the deploy, because the mistakes
 * worth guarding are all properties of what gets written to
 * /etc/systemd/system, and each one is quiet:
 *
 *   - a scheduler per site runs every job twice
 *   - a scheduler pinned to a release keeps running old code after a deploy
 *   - a scheduler named for the framework rather than the tenant collides on a
 *     shared box, which is how a slug collision once took another project down
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(import.meta.dir, '../src/commands/deploy.ts'), 'utf8')

/** The `installScheduler` body, which is what writes the unit. */
const installer = (() => {
  const start = source.indexOf('async function installScheduler')
  const end = source.indexOf('async function waitForRemoteReady')

  return source.slice(start, end)
})()

describe('the scheduler unit a deploy installs', () => {
  it('is installed at all', () => {
    // The whole point: a deploy used to ship Scheduler.ts and run nothing.
    expect(source).toContain('await installScheduler(ip, slug)')
  })

  it('runs the scheduler through the release own buddy', () => {
    expect(installer).toContain('buddy schedule:run')
  })

  it('is named for the tenant, not the framework', () => {
    /*
     * A shared box hosts several projects. A unit called `stacks-scheduler`
     * would be one project's cron clobbering another's — the same class of
     * mistake as the slug collision that rewrote another tenant's gateway
     * fragment and took its site down.
     */
    expect(installer).toContain('`${slug}-scheduler`')
    expect(installer).not.toMatch(/['"`]stacks-scheduler/)
  })

  it('points at current rather than a pinned release', () => {
    /*
     * Site units are templated per release (`@%i`) so old and new overlap
     * during cutover. A scheduler pinned the same way survives the deploy that
     * replaced it and goes on running the previous release's code.
     */
    expect(installer).toContain('/current`')
    expect(installer).not.toContain('@%i')
    expect(installer).not.toContain('releases/')
  })

  it('restarts rather than starts, so a deploy moves it to the new code', () => {
    // `start` is a no-op against an already-running unit, which would strand
    // the scheduler on the release it booted with.
    expect(installer).toContain('systemctl restart')
    expect(installer).not.toMatch(/systemctl start \$\{unit\}/)
  })

  it('survives a reboot', () => {
    expect(installer).toContain('systemctl enable')
    expect(installer).toContain('WantedBy=multi-user.target')
    expect(installer).toContain('Restart=always')
  })

  it('installs nothing for an app that schedules nothing', () => {
    // An empty Scheduler.ts should not leave a service running on the box.
    expect(installer).toContain('app/Scheduler.ts')
    expect(installer).toContain("includes('yes')")
  })

  it('does not fail the deploy when it cannot install', () => {
    /*
     * A release that is already serving traffic should not be rolled back
     * because its cron did not land. The failure is logged and the deploy
     * stands.
     */
    expect(installer).toContain('catch')
    expect(installer).toContain('log.warn')
    expect(installer).not.toContain('process.exit')
  })
})
