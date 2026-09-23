import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

interface Service { ports: string[] }
interface Step { name: string, env?: Record<string, string> }
const workflow = Bun.YAML.parse(readFileSync(new URL('../../../../../.github/workflows/ci.yml', import.meta.url), 'utf8')) as {
  jobs: { test: { services: Record<string, Service>, steps: Step[] } }
}

for (const [service, containerPort, variable] of [
  ['postgres', '5432', 'STACKS_TEST_POSTGRES_URL'],
  ['mysql', '3306', 'STACKS_TEST_MYSQL_URL'],
] as const) {
  test(`CI ${service} URLs use the mapped disposable service port`, () => {
    const mapping = workflow.jobs.test.services[service]!.ports.find(port => port.endsWith(`:${containerPort}`))
    expect(mapping).toBeDefined()
    const hostPort = mapping!.split(':')[0]!
    // Match fixture safety policy without granting CI a bypass that could
    // accidentally connect a developer's tests to a normal local database.
    expect(['3306', '5432']).not.toContain(hostPort)
    expect(Number(hostPort)).toBeGreaterThan(1024)
    expect(Number(hostPort)).toBeLessThanOrEqual(65535)
    const consumers = workflow.jobs.test.steps.filter(step => step.env?.[variable])
    expect(consumers.length).toBeGreaterThanOrEqual(2)
    for (const step of consumers) {
      const url = new URL(step.env![variable]!)
      expect(url.hostname, step.name).toBe('127.0.0.1')
      expect(url.port, step.name).toBe(hostPort)
    }
  })
}
