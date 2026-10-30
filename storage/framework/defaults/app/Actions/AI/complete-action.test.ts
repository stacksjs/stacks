import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('CompleteAction wiring', () => {
  test('is a POST action the default /ai route group mounts', () => {
    const routes = readFileSync(join(import.meta.dir, '../../../routes/dashboard.ts'), 'utf8')
    expect(routes).toContain('route.post(\'/complete\', \'Actions/AI/CompleteAction\')')
    // Inside the guarded `/ai` group, so it is mounted at /ai/complete behind auth.
    const group = routes.slice(routes.indexOf('route.group({ prefix: \'/ai\''))
    expect(group.indexOf('/complete')).toBeGreaterThan(0)
    expect(group.indexOf('/complete')).toBeLessThan(group.indexOf('})'))
  })

  test('loads and declares POST', async () => {
    const action = (await import('./CompleteAction')).default as { name?: string, method?: string }
    expect(action.method).toBe('POST')
    expect(action.name).toBe('AiCompleteAction')
  })
})
