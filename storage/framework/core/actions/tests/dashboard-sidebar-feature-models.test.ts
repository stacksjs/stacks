import { describe, expect, it } from 'bun:test'
import { feature } from '@stacksjs/config'
import { frameworkModelFeature } from '@stacksjs/orm'
import { join } from 'node:path'
import { discoverModels, modelsWithEnabledFeatures } from '../src/dev/dashboard-utils'

/**
 * The sidebar's model rows come from this list. With forms off (as config
 * ships it) the forms models were still listed under Data, and each linked a
 * /models/<id> page that could only answer "No ORM model named Form"
 * (stacksjs/stacks#3162). Driven off the live flags and the ORM's own gates.
 */
const enabled = (name: string) => feature(name as Parameters<typeof feature>[0])

describe('dashboard model list', () => {
  it('leaves out a framework model whose feature is off', async () => {
    expect(frameworkModelFeature('FormField')).toBe('forms')
    // Forms on would make this vacuous; config ships it off.
    expect(feature('forms')).toBe(false)
    const discovered = await discoverModels(join(import.meta.dir, 'no-such-app-models'), join(import.meta.dir, '../../../defaults/app/Models'))
    expect(discovered.map(model => model.name)).toContain('FormField')
    const listed = modelsWithEnabledFeatures(discovered, frameworkModelFeature, enabled).map(model => model.name)
    expect(listed).not.toContain('Form')
    expect(listed).not.toContain('FormField')
    expect(listed).toContain('User')
  })

  it('keeps an app model whatever the framework feature of that name', () => {
    const models = [{ name: 'Form', icon: 'doc', id: 'form', category: 'userland' as const }]
    expect(modelsWithEnabledFeatures(models, frameworkModelFeature, () => false).map(model => model.name)).toEqual(['Form'])
  })
})
