import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const directory = resolve('storage/framework/defaults/app/Actions/Dashboard/Marketing')

function readAction(name: string): string {
  return readFileSync(resolve(directory, name), 'utf8')
}

const readActions = [
  'CampaignIndexAction.ts',
  'ListIndexAction.ts',
  'SocialPostIndexAction.ts',
]

const modelWriteActions = [
  'CampaignDestroyAction.ts',
  'CampaignStoreAction.ts',
  'CampaignUpdateAction.ts',
  'ListDestroyAction.ts',
  'ListStoreAction.ts',
  'ListUpdateAction.ts',
  'SocialPostDestroyAction.ts',
  'SocialPostStoreAction.ts',
  'SocialPostUpdateAction.ts',
]

const deliveryActions = [
  'CampaignCancelAction.ts',
  'CampaignScheduleAction.ts',
  'CampaignSendAction.ts',
]

describe('dashboard marketing error contract', () => {
  test('keeps every persisted marketing read behind a safe boundary', () => {
    for (const action of readActions) {
      const source = readAction(action)

      expect(source).toContain("import { dashboardOperationalError } from '../dashboard-response'")
      expect(source).toContain('catch (error)')
      expect(source).toContain('return dashboardOperationalError(error,')
      expect(source).not.toContain('error instanceof Error ? error.message')
    }
  })

  test('maps model validation and uniqueness without exposing operational errors', () => {
    const helper = readAction('marketing-response.ts')

    expect(helper).toContain('error instanceof ModelValidationError')
    expect(helper).toContain("message: 'Validation failed.'")
    expect(helper).toContain('isUniqueViolation(error)')
    expect(helper).toContain('return dashboardOperationalError(error, message, action, 500)')

    for (const action of modelWriteActions) {
      const source = readAction(action)
      expect(source).toContain('catch (error)')
      expect(source).toContain('return marketingModelError(')
    }
  })

  test('validates list and social payloads before model persistence', () => {
    const listStore = readAction('ListStoreAction.ts')
    const listUpdate = readAction('ListUpdateAction.ts')
    const socialStore = readAction('SocialPostStoreAction.ts')
    const socialUpdate = readAction('SocialPostUpdateAction.ts')

    expect(listStore).toContain('validateMarketingListWriteData(data)')
    expect(listUpdate).toContain('validateMarketingListWriteData(data)')
    expect(socialStore).toContain('validateSocialPostWriteData(data)')
    expect(socialUpdate).toContain('validateSocialPostWriteData(data)')
  })

  test('validates normalized model-shaped writes instead of raw dashboard fields', () => {
    const customWrites = [
      'CampaignStoreAction.ts',
      'CampaignUpdateAction.ts',
      'ListStoreAction.ts',
      'ListUpdateAction.ts',
      'SocialPostStoreAction.ts',
      'SocialPostUpdateAction.ts',
    ]

    for (const action of customWrites)
      expect(readAction(action)).not.toContain('request.validate()')
  })

  test('validates every mutation route id before model or provider access', () => {
    const idActions = [
      'CampaignCancelAction.ts',
      'CampaignDestroyAction.ts',
      'CampaignScheduleAction.ts',
      'CampaignSendAction.ts',
      'CampaignUpdateAction.ts',
      'ListDestroyAction.ts',
      'ListUpdateAction.ts',
      'SocialPostDestroyAction.ts',
      'SocialPostUpdateAction.ts',
    ]

    for (const action of idActions) {
      const source = readAction(action)
      expect(source).toContain('const id = marketingRecordId(request)')
      expect(source).toMatch(/A valid .+ id is required\.' \}, 400\)/)
    }
  })

  test('separates delivery prerequisite failures from queue failures', () => {
    const sources = deliveryActions.map(readAction).join('\n')
    const context = readAction('campaign-delivery.ts')

    expect(sources.match(/dashboardOperationalError\(/g)?.length).toBe(6)
    expect(sources).toContain('Campaign delivery prerequisites could not be loaded.')
    expect(sources).toContain('Campaign could not be queued.')
    expect(sources).toContain('Campaign could not be scheduled.')
    expect(sources).toContain('Campaign could not be cancelled.')
    expect(context).toContain('export async function loadCampaignDeliveryContext')
  })

  test('reports concurrent delivery state changes as conflicts', () => {
    for (const action of deliveryActions) {
      const source = readAction(action)
      expect(source).toContain('error instanceof CampaignStateConflictError')
      expect(source).toContain("Campaign delivery state changed. Refresh and try again.' }, 409")
    }
  })
})
