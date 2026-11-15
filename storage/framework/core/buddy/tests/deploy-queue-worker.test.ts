import { describe, expect, it } from 'bun:test'
import { missingQueueWorkerProblem } from '../src/deploy-queue-worker'

describe('a deploy with no queue worker', () => {
  const app = { root: '.', start: 'bun serve.js', port: 3000 }

  it('says so when an app runs on a server and nothing reads the queue', () => {
    const problem = missingQueueWorkerProblem({ main: app, www: { redirect: 'https://example.com' } }, undefined)
    expect(problem).toContain('No site declares a queue worker')
    expect(problem).toContain('to the database')
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

  it('is quiet when the worker is a site of its own', () => {
    expect(missingQueueWorkerProblem({ main: app, worker: { root: '.', start: 'bun buddy queue:work' } }, undefined)).toBeUndefined()
  })

  it('is quiet for an app that serves none of the framework\'s routes', () => {
    expect(missingQueueWorkerProblem({ main: { ...app, env: { STACKS_DEFAULT_ROUTES: 'none' } } }, undefined)).toBeUndefined()
  })

  it('names the database for a local sync driver, which production refuses', () => {
    expect(missingQueueWorkerProblem({ main: app }, 'sync')).toContain('connection: \'database\'')
  })

  it('is quiet for a project with nothing running on a server', () => {
    expect(missingQueueWorkerProblem({ site: { root: 'dist', deploy: 'server', domain: 'example.com' } }, undefined)).toBeUndefined()
    expect(missingQueueWorkerProblem(undefined, undefined)).toBeUndefined()
  })
})
