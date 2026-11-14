import { expect, test } from 'bun:test'
import { planScreenshotModels, screenshotFixturePath } from '../src/screenshot-models'

test('plans parent-first fixture creation without running factories or exposing defaults', () => {
  let factoriesRun = 0
  const plan = planScreenshotModels({
    Project: { name: 'Project', primaryKey: 'uuid', belongsTo: ['User'], traits: { useSeeder: { count: 3 }, useApi: { uri: 'projects', routes: ['index', 'show'], middleware: ['auth'] } }, attributes: {
      title: { required: true, factory: () => { factoriesRun++; return 'Demo project' } },
      email: { personal: true, required: true },
      secret: { hidden: true, default: 'never publish this' },
    } },
    User: { name: 'User', attributes: { name: { default: 'Synthetic user' } } },
  })
  expect(plan.creationOrder).toEqual(['User', 'Project'])
  expect(plan.models.find(model => model.name === 'Project')).toMatchObject({ factoryFields: ['title'], requiredWithoutFactory: ['email'], sensitiveFields: ['email', 'secret'], seederCount: 3, suggestedStates: ['empty', 'populated', 'detail', 'permission-denied'] })
  expect(factoriesRun).toBe(0)
  expect(JSON.stringify(plan)).not.toContain('never publish this')
  expect(screenshotFixturePath('/projects/[id]', undefined, { Project: { uuid: 'sample/id' } }, plan)).toBe('/projects/sample%2Fid')
  expect(screenshotFixturePath('/projects/:slug', 'Project', { Project: { slug: 'hello world' } }, plan)).toBe('/projects/hello%20world')
  expect(() => screenshotFixturePath('/projects/[email]', 'Project', { Project: { email: 'private@example.test' } }, plan)).toThrow('sensitive')
  expect(() => screenshotFixturePath('/projects/[id]', 'Project', {}, plan)).toThrow('No screenshot fixture')
})

test('keeps cycles and missing parent models explicit instead of inventing foreign keys', () => {
  const plan = planScreenshotModels({ A: { belongsTo: ['B'] }, B: { belongsTo: ['A'] }, C: { belongsTo: ['External'] }, D: { belongsTo: ['A'] } })
  expect(plan.creationOrder).toEqual(['C'])
  expect(plan.cycles).toEqual(['A', 'B'])
  expect(plan.blocked).toEqual(['D'])
  expect(plan.externalParents).toEqual(['External'])
})
