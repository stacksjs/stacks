import assert from 'node:assert/strict'
import { Action } from '@stacksjs/actions'
import { createStacksRouter } from '../../../router/src/stacks-router'
import { validateWriteBody } from '../../../orm/src/auto-crud'
import { defineModel } from '../../../orm/src/define-model'
import { schema } from '../../src/schema'
import { validateField } from '../../src/validator'
import { getErrors } from '../../src/reporter'

let visits = 0
const rule = schema.string().custom(() => { visits++; return false }, 'Original failure')
const router = createStacksRouter({ autoDiscoverRoutes: false })
router.post('/count', new Action({ skipCsrf: true, validations: { name: { rule, message: { custom: 'Configured failure' } } }, handle: () => ({ ok: true }) }) as never)
router.post('/profile', new Action({ skipCsrf: true, validations: { profile: { rule: schema.object({ email: schema.string().required().email() }) } }, handle: () => ({ ok: true }) }) as never)
const profile = schema.object({ email: schema.string().required().email() })
router.post('/clean-profile', new Action({ skipCsrf: true, validations: { profile: { rule: profile }, items: { rule: schema.array().each(profile) } }, handle: request => ({ validated: request.getValidated(), safe: request.safe().all() }) }) as never)
const special = Object.fromEntries([['__proto__', { rule: schema.string().required().min(3) }]])
router.post('/special', new Action({ skipCsrf: true, validations: special, handle: request => request.getValidated() }) as never)
router.get('/report/:id', async (request) => {
  try { await validateField('Author', { name: 'valid name', email: `${request.params.id}-invalid` }) }
  catch { /* The reporter exposes this request's latest failure. */ }
  if (request.params.id === 'A') await Bun.sleep(60)
  return { errors: getErrors() }
})
const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: request => router.bunRouter.handleRequest(request) })
const base = `http://127.0.0.1:${server.port}`
try {
  const response = await fetch(`${base}/count`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"Alice"}' })
  assert.equal(response.status, 422)
  const body = await response.json()
  assert.deepEqual(body.errors.name, ['Configured failure'])
  assert.equal(visits, 1)
  visits = 0
  const write = validateWriteBody({name:'Alice'}, {attributes:{name:{validation:{rule,message:{custom:'Configured failure'}}}}}, 'creating')
  assert.equal(write.valid,false)
  assert.deepEqual('errors' in write ? write.errors : null, {name:['Configured failure']})
  assert.equal(visits,1)
  const nested = await fetch(`${base}/profile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"profile":{"email":"invalid"}}' })
  assert.equal(nested.status, 422)
  const clean = await fetch(`${base}/clean-profile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: { email: 'a@example.test', isAdmin: true }, items: [{ email: 'b@example.test', isAdmin: true }] }) })
  assert.equal(clean.status, 200)
  const expected = { profile: { email: 'a@example.test' }, items: [{ email: 'b@example.test' }] }
  assert.deepEqual(await clean.json(), { validated: expected, safe: expected })
  const nestedModel = { attributes: { profile: { validation: { rule: profile, message: 'Profile invalid' } } } }
  const invalidWrite = validateWriteBody({ profile: { email: 'invalid' } }, nestedModel, 'creating')
  assert.equal(invalidWrite.valid, false)
  assert.deepEqual('errors' in invalidWrite ? { ...invalidWrite.errors } : null, { profile: ['Profile invalid'] })
  const Probe = defineModel({ name: 'BoundaryProfile', table: 'boundary_profiles', attributes: nestedModel.attributes } as never)
  await assert.rejects(() => Probe.create({ profile: { email: 'invalid' } } as never), { name: 'ModelValidationError', status: 422 })
  for (const value of ['x', 'valid']) {
    const specialResponse = await fetch(`${base}/special`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries([['__proto__', value]])) })
    assert.equal(specialResponse.status, value === 'x' ? 422 : 200)
    const specialBody = await specialResponse.json()
    assert(Object.hasOwn(value === 'x' ? specialBody.errors : specialBody, '__proto__'))
  }
  const specialWrite = validateWriteBody(Object.fromEntries([['__proto__', 'x']]), { attributes: Object.fromEntries([['__proto__', { validation: special.__proto__ }]]) }, 'creating')
  assert.equal(specialWrite.valid, false)
  assert('errors' in specialWrite && Object.hasOwn(specialWrite.errors, '__proto__'))
  const a = fetch(`${base}/report/A`)
  await Bun.sleep(15)
  await fetch(`${base}/report/B`)
  const reported = await (await a).json()
  assert(reported.errors.some((error: { value: string }) => error.value === 'A-invalid'))
  assert(!reported.errors.some((error: { value: string }) => error.value === 'B-invalid'))
  console.log('framework validation boundaries OK')
}
finally { server.stop(true) }
