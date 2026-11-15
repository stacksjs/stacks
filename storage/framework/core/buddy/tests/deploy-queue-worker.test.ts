import { describe, expect, it } from 'bun:test'
import { missingQueueWorkerProblem } from '../src/deploy-queue-worker'

describe('a deploy with no queue worker', () => {
  const app = { root: '.', start: 'bun serve.js', port: 3000 }

  it('says so when an app runs on a server and nothing reads the queue', () => {
    const problem = missingQueueWorkerProblem({ main: app, www: { redirect: 'https://example.com' } }, undefined)
    expect(problem).toContain('No site declares a queue worker')
    expect(problem).toContain('QUEUE_DRIVER=database')
    expect(problem).toContain('buddy queue:table')
  })

  it('names redis where that is the driver, and no table to create', () => {
    const problem = missingQueueWorkerProblem({ main: app }, 'redis')
    expect(problem).toContain('connection: \'redis\'')
    expect(problem).not.toContain('queue:table')
  })

  it('is quiet once a site declares a worker, as queues or as a daemon', () => {
    expect(missingQueueWorkerProblem({ main: { ...app, queues: [{ connection: 'database', queue: 'emails,default' }] } }, undefined)).toBeUndefined()
    expect(missingQueueWorkerProblem({ main: app, api: { ...app, daemons: [{ command: 'bun cli.js queue:work' }] } }, undefined)).toBeUndefined()
  })

  it('is quiet for a project with nothing running on a server', () => {
    expect(missingQueueWorkerProblem({ site: { root: 'dist', deploy: 'server', domain: 'example.com' } }, undefined)).toBeUndefined()
    expect(missingQueueWorkerProblem(undefined, undefined)).toBeUndefined()
  })
})
