import { describe, expect, it } from 'bun:test'
import { buildNavSections } from '../../../defaults/resources/functions/dashboard/sidebar'
import { buildSidebarConfig } from '../src/dev/dashboard-utils'

describe('dashboard model collection labels', () => {
  for (const [name, expected] of [
    ['User', 'Users'], ['Organization', 'Organizations'], ['Athlete', 'Athletes'], ['Coach', 'Coaches'],
    ['Workout', 'Workouts'], ['TrainingPlan', 'Training Plans'], ['ClassSession', 'Class Sessions'],
    ['Person', 'People'], ['Category', 'Categories'], ['News', 'News'], ['TrainingPlans', 'Training Plans'],
  ]) {
    it(`shows ${name} as ${expected} in native, web, highlighted and grouped rows`, () => {
      for (const category of ['userland', 'content', 'commerce', 'marketing', 'system'] as const) {
        for (const highlight of [false, true]) {
          const model = { id: 'custom-model', name: name!, icon: 'doc', category, dashboard: { highlight } }
          const native = buildSidebarConfig('http://localhost:3002', [model])
          expect(native.sections.flatMap(section => section.items).find(item => item.id === 'model-custom-model')?.label).toBe(expected)
          const web = buildNavSections([model])
          const items = web.flatMap(([, , items]) => items).flatMap(item => [item, ...(item.children ?? [])])
          const row = items.find(item => item.to === '/models/custom-model')
          expect(row?.text).toBe(expected)
          expect(row?.to).toBe('/models/custom-model')
        }
      }
    })
  }

  it('preserves explicit product labels and navigation identities', () => {
    const model = { id: 'training-plan', name: 'TrainingPlan', icon: 'doc', category: 'userland' as const,
      dashboard: { label: 'Coach Library', highlight: true, roles: ['coach'] } }
    const native = buildSidebarConfig('http://localhost:3002', [model]).sections.flatMap(section => section.items)
      .find(item => item.id === 'model-training-plan')!
    expect(native.label).toBe('Coach Library')
    expect(native.url).toBe('http://localhost:3002/models/training-plan')
    expect(native).toMatchObject({ roles: ['coach'] })
    const web = buildNavSections([model]).find(([id]) => id === 'data')![2].find(item => item.to === '/models/training-plan')!
    expect(web.text).toBe('Coach Library')
    expect(web.roles).toEqual(['coach'])
  })
})
