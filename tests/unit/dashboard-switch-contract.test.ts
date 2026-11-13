import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * An on/off setting in the dashboard is the shared switch
 * (stacksjs/stacks#3301).
 *
 * A model's form drew a yes or no as a switch while thirty settings in the
 * hand-built pages and dialogs each wrote a checkbox of their own, with their
 * own markup and classes. They are `Dashboard/UI/Toggle.stx` now. What is
 * still a native checkbox is not an on/off setting, and is listed here with
 * what it is instead: a new one has to be one of these, or be a switch.
 */
const DASHBOARD = join(import.meta.dir, '../../storage/framework/defaults/resources/components/Dashboard')

const NATIVE_CHECKBOXES: Record<string, { count: number, because: string }> = {
  'UI/Toggle.stx': { count: 1, because: 'the switch itself' },
  'UI/Checkbox.stx': { count: 1, because: 'the shared checkbox' },
  'UI/Table.stx': { count: 3, because: 'picking rows' },
  'Models/ModelRecordsDashboard.stx': { count: 2, because: 'picking rows' },
  'Content/PostEditorDialog.stx': { count: 2, because: 'a post\'s categories and tags: several of many' },
  'Auth/AccessTokenCreateDialog.stx': { count: 1, because: 'a token\'s scopes: several of many' },
  'Management/AssignmentDrawer.stx': { count: 1, because: 'what is assigned: several of many' },
  'Settings/MailSettingsDashboard.stx': { count: 5, because: 'clear a stored secret on this save: an instruction, not a state that is kept' },
  'Operations/RecoveryRestoreDialog.stx': { count: 1, because: 'acknowledging downtime before an in-place restore' },
  'Auth/Login.stx': { count: 1, because: 'remember me, on the sign-in form' },
  'Auth/Register.stx': { count: 1, because: 'agreeing to the terms' },
}

const components = (readdirSync(DASHBOARD, { recursive: true }) as string[]).filter(file => file.endsWith('.stx')).sort()
const source = (file: string) => readFileSync(join(DASHBOARD, file), 'utf8')
const count = (text: string, pattern: RegExp) => (text.match(pattern) || []).length

describe('dashboard switch contract', () => {
  it('a native checkbox is one of the listed kinds, and nothing else', () => {
    const found: Record<string, number> = {}
    for (const file of components) {
      const checkboxes = count(source(file), /type="checkbox"/g)
      if (checkboxes > 0)
        found[file] = checkboxes
    }
    // The walk read the dashboard: a guard that found nothing would pass.
    expect(components.length).toBeGreaterThan(300)
    expect(found).toEqual(Object.fromEntries(Object.entries(NATIVE_CHECKBOXES).map(([file, entry]) => [file, entry.count]).sort(([a], [b]) => String(a).localeCompare(String(b)))))
    for (const entry of Object.values(NATIVE_CHECKBOXES))
      expect(entry.because.length).toBeGreaterThan(10)
  })

  it('the settings that were checkboxes are switches, each saying what it said', () => {
    const switches: Array<[string, string[]]> = [
      ['Email/InboxSettingsDashboard.stx', ['v-model:checked="sendAndArchive"', 'v-model:checked="desktopNotifications"', 'v-model:checked="notificationPreview"', 'v-model:checked="loadRemoteImages"', 'v-model:checked="showExternalContent"']],
      ['Content/PostEditorDialog.stx', ['v-model:checked="featured" name="featured" label="Featured post"']],
      ['Content/BlogPostEditorDialog.stx', ['v-model:checked="draft" name="draft" label="Draft, keep off the public blog"', 'v-model:checked="featured" name="featured" label="Feature at the top of the listing"']],
      ['Content/PageEditorDialog.stx', ['v-model:checked="published" name="published" label="Published"']],
      ['Commerce/CommerceGiftCardDialog.stx', ['v-model:checked="isActive" label="Enabled"', 'v-model:checked="isDigital" label="Digital delivery"', 'v-model:checked="isReloadable" label="Reloadable"']],
      ['Commerce/CommerceTaxDialog.stx', ['v-model:checked="isDefault" label="Default tax rate"', 'v-model:checked="exemptible" label="Can be exempted"']],
      ['Commerce/CommerceReviewEditDialog.stx', ['v-model:checked="approved" label="Approved"', 'v-model:checked="featured" label="Featured"']],
      ['Commerce/CommerceProductDialog.stx', ['v-model:checked="isAvailable" label="Available for commerce"']],
      ['Commerce/CommerceCouponDialog.stx', ['v-model:checked="isActive" label="Enabled for redemption"']],
      ['Commerce/CommerceCategoryDialog.stx', ['v-model:checked="isActive" label="Active in the storefront"']],
      ['Commerce/CommerceManufacturerDialog.stx', ['v-model:checked="featured" label="Featured manufacturer"']],
      ['Commerce/CommerceUnitDialog.stx', ['v-model:checked="isDefault" label="Default for this type"']],
      ['Commerce/Delivery/DigitalDeliveryDialog.stx', ['v-model:checked="requiresLogin" label="Require login"', 'v-model:checked="automaticDelivery" label="Automatic delivery"']],
      ['Operations/RecoveryPolicyDialog.stx', ['v-model:checked="enabled" label="Enable scheduled runs"']],
      ['Operations/RecoveryDestinationDialog.stx', ['v-model:checked="forcePathStyle" label="Force path-style URLs"', 'v-model:checked="allowPrivate" label="Allow private endpoint"']],
      ['Operations/RecoveryRestoreDialog.stx', ['v-model:checked="drill" label="Run as a recovery drill and clean the isolated target after health validation"']],
      ['Marketing/MarketingListDialog.stx', ['v-model:checked="isPublic" label="Public signup"', 'v-model:checked="doubleOptIn" label="Double opt-in"']],
      // Bound to its draft as the page's other inputs are, with no setter between.
      ['Settings/SettingsDashboard.stx', ['v-model:checked="drafts[field.key]"']],
      ['Settings/AppearanceSettingsDashboard.stx', [':checked="isVisible(section.id)"', '@update:checked="toggleSection(section.id, $event)"']],
    ]
    let total = 0
    for (const [file, expected] of switches) {
      const text = source(file)
      for (const binding of expected) {
        expect(text, `${file}: ${binding}`).toContain(binding)
        total++
      }
      expect(count(text, /<Toggle\b/g), file).toBeGreaterThan(0)
    }
    expect(total).toBe(32)
  })

  it('a switch in a spaced stack sits in a box of its own', () => {
    // `space-y-*` puts its margin on a component's scope wrapper, which makes
    // no box, so a switch that is a direct child of one loses its spacing.
    for (const file of components) {
      const lines = source(file).split('\n')
      lines.forEach((line, index) => {
        if (!/^\s*<Toggle\b/.test(line))
          return
        const indent = line.search(/\S/)
        // The nearest line above that is less indented opens the parent.
        const parent = lines.slice(0, index).reverse().find(above => above.trim() !== '' && above.search(/\S/) < indent) ?? ''
        expect(/\bspace-[xy]-/.test(parent), `${file}:${index + 1} is a direct child of ${parent.trim().slice(0, 80)}`).toBe(false)
      })
    }
  })
})
