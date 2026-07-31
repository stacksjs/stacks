import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('dashboard button contract', () => {
  test('uses one canonical reusable button component', () => {
    const button = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/UI/Button.stx'),
      'utf8',
    )

    expect(existsSync(resolve('storage/framework/defaults/resources/components/Button.stx'))).toBe(false)
    expect(existsSync(resolve('storage/framework/defaults/resources/components/Buttons/BaseButton.stx'))).toBe(false)
    expect(button).toContain('bg-gradient-to-b from-blue-500 to-blue-600')
    expect(button).toContain("variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning'")
    expect(button).toContain("tag?: 'button' | 'a'")
    expect(button).toContain('class?: string')
    expect(button).toContain("class: customClass = ''")
    expect(button).toContain('customClass,')
    expect(button).toContain("const liveDownload = useReactiveProp('download', '')")
    expect(button).toContain("const liveType = useReactiveProp('type', 'button')")
    expect(button).toContain("const liveDataAction = useReactiveProp('dataAction', '')")
    expect(button).toContain("const liveDataCloseModal = useReactiveProp('dataCloseModal', '')")
    expect(button).toContain("const liveDataEmailId = useReactiveProp('dataEmailId', '')")
    expect(button).toContain("const liveDataErrorMessage = useReactiveProp('dataErrorMessage', '')")
    expect(button).toContain("const liveDataErrorType = useReactiveProp('dataErrorType', '')")
    expect(button).toContain("const liveDataMethodId = useReactiveProp('dataMethodId', '')")
    expect(button).toContain("const livePressed = useReactiveProp('pressed', false)")
    expect(button).toContain("interaction?: 'action' | 'toggle'")
    expect(button).toContain("@if(interaction === 'toggle')")
    expect(button).toContain("interaction === 'toggle'")
    expect(button).toContain('].filter(Boolean).join')
    expect(button).toContain(':aria-pressed="String(livePressed())"')

    const pressedStateFiles = [
      'storage/framework/defaults/resources/components/Dashboard/UI/Button.stx',
      'storage/framework/defaults/resources/components/Dashboard/Queries/QueryDashboard.stx',
      'storage/framework/defaults/resources/components/Dashboard/Email/InboxDashboard.stx',
      'storage/framework/defaults/resources/components/Dashboard/Email/EmailActivityDashboard.stx',
      'storage/framework/defaults/views/dashboard/settings/appearance.stx',
      'storage/framework/defaults/views/dashboard/ci/index.stx',
      'storage/framework/defaults/views/dashboard/kanban/index.stx',
      'storage/framework/defaults/views/dashboard/kanban/[id].stx',
    ]

    for (const file of pressedStateFiles) {
      const source = readFileSync(resolve(file), 'utf8')
      const pressedExpressions = [...source.matchAll(/:aria-pressed="([^"]+)"/g)].map(match => match[1])

      expect(pressedExpressions.length).toBeGreaterThan(0)
      expect(pressedExpressions.every(expression => expression.startsWith('String('))).toBe(true)
    }
  })

  test('routes primary commerce actions through the canonical component', () => {
    const files = [
      'CommerceProductsDashboard.stx',
      'CommerceProductDialog.stx',
      'CommerceProductDeleteDialog.stx',
      'CommerceProductDetailDashboard.stx',
      'CommerceCustomersDashboard.stx',
      'CommerceCustomerDialog.stx',
      'CommerceCustomerDeleteDialog.stx',
      'CommerceCustomerDetailsDialog.stx',
      'CommerceOrdersDashboard.stx',
      'CommerceOrderDialog.stx',
      'CommerceOrderDeleteDialog.stx',
      'CommerceOrderDetailsDialog.stx',
      'CommerceCouponsDashboard.stx',
      'CommerceCouponDialog.stx',
      'CommerceCouponDeleteDialog.stx',
      'CommerceCouponDetailsDialog.stx',
      'CommerceGiftCardsDashboard.stx',
      'CommerceGiftCardDialog.stx',
      'CommerceGiftCardDeleteDialog.stx',
      'CommerceGiftCardDetailsDialog.stx',
      'CommerceCategoriesTable.stx',
      'CommerceManufacturersTable.stx',
      'CommerceUnitsTable.stx',
      'CommerceTaxesTable.stx',
      'CommerceVariantsTable.stx',
      'CommerceReviewsTable.stx',
      'CommerceProductsTable.stx',
      'CommerceCustomersTable.stx',
      'CommerceOrdersTable.stx',
      'CommerceCouponsTable.stx',
      'CommerceGiftCardsTable.stx',
      'CommercePaymentsTable.stx',
      'PrintDevicesTable.stx',
      'PrintLogsTable.stx',
      'ProductWaitlistTable.stx',
      'CommerceOverviewDashboard.stx',
      'CommercePosDashboard.stx',
      'CommercePosCatalog.stx',
      'CommercePosCart.stx',
      'CommercePosCheckoutDialog.stx',
      'CommercePosReceiptDialog.stx',
      'PaymentDetailsDialog.stx',
      'PaymentRefundDialog.stx',
      'Delivery/DeliveryOverviewDashboard.stx',
      'Delivery/ShippingMethodsDashboard.stx',
      'Delivery/DriversDashboard.stx',
      'Delivery/DeliveryRoutesDashboard.stx',
      'Delivery/LicenseKeysDashboard.stx',
      'Delivery/ShippingZonesDashboard.stx',
      'Delivery/DigitalDeliveriesDashboard.stx',
      'Delivery/ShippingRatesDashboard.stx',
      'Delivery/DigitalDeliveryTable.stx',
      'Delivery/DeliveryRoutesTable.stx',
      'Delivery/LicenseKeysTable.stx',
      'Delivery/ShippingMethodsTable.stx',
      'Delivery/DriversTable.stx',
      'Delivery/ShippingZonesTable.stx',
      'Delivery/ShippingRatesTable.stx',
      'Delivery/DeliveryPagination.stx',
    ]

    for (const file of files) {
      const source = readFileSync(
        resolve('storage/framework/defaults/resources/components/Dashboard/Commerce', file),
        'utf8',
      )
      const nativeButtons = [...source.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

      expect(source).toContain('<Button')
      expect(nativeButtons.every(button => button.includes('absolute inset-0 bg-black/45'))).toBe(true)
    }
  })

  test('routes shared dashboard controls through the canonical component', () => {
    const files = [
      'UI/Pagination.stx',
      'CreateRecordModal.stx',
      'UI/Modal.stx',
      'UI/ConfirmDialog.stx',
      'UI/EmptyState.stx',
      'Auth/ForgotPassword.stx',
      'Modals/BaseModal.stx',
      'Modals/Popups/Alert.stx',
      'Modals/Popups/Toast.stx',
      'Modals/ToastWrapper.stx',
      'Marketing/SocialPostsTable.stx',
      'Marketing/CampaignsTable.stx',
      'Marketing/MarketingListsTable.stx',
      'Marketing/MarketingListsDashboard.stx',
      'Marketing/CampaignsDashboard.stx',
      'Marketing/SocialPostsDashboard.stx',
      'Content/PostsDashboard.stx',
      'Content/PagesDashboard.stx',
      'Content/AuthorsDashboard.stx',
      'Content/ContentTaxonomyDashboard.stx',
      'Content/CommentsDashboard.stx',
      'Content/ContentDashboard.stx',
      'Notifications/NotificationDeliveryTable.stx',
      'Notifications/NotificationDeliveryDialog.stx',
      'Notifications/NotificationDeliveryHistory.stx',
      'Notifications/NotificationDeliveries.stx',
      'Notifications/NotificationDeliveryOverview.stx',
      'Billing/BillingSettings.stx',
      'Auth/AccessTokens.stx',
      'Infrastructure/DnsRecordDialog.stx',
      'Infrastructure/LogDetailsDialog.stx',
      'Infrastructure/MailboxDetailsDialog.stx',
      'Infrastructure/CloudDetailsDialog.stx',
      'Infrastructure/HealthDashboard.stx',
      'Infrastructure/DnsDashboard.stx',
      'Infrastructure/CloudDashboard.stx',
      'Infrastructure/ServerlessDashboard.stx',
      'Infrastructure/InsightsDashboard.stx',
      'Infrastructure/ServerDetailsDashboard.stx',
      'Infrastructure/LogsDashboard.stx',
      'App/RequestsOverview.stx',
      'App/SourceInventory.stx',
      'Realtime/RealtimeDashboard.stx',
      'Queue/QueueDashboard.stx',
      'Jobs/JobTable.stx',
      'Jobs/JobDashboard.stx',
      'Jobs/JobHistory.stx',
      'Library/ComponentsDashboard.stx',
      'Library/DependenciesDashboard.stx',
      'Library/FunctionsDashboard.stx',
      'Library/PackagesDashboard.stx',
      'Analytics/AnalyticsPageHeader.stx',
      'Analytics/AnalyticsHub.stx',
      'Analytics/EventAnalytics.stx',
      'Buddy/BuddyAssistant.stx',
      'Models/ModelsOverview.stx',
      'Data/DataRecords.stx',
      'Releases/ReleaseDashboard.stx',
      'Teams/TeamPeopleDashboard.stx',
    ]

    for (const file of files) {
      const source = readFileSync(
        resolve('storage/framework/defaults/resources/components/Dashboard', file),
        'utf8',
      )
      const nativeButtons = [...source.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

      expect(source).toContain('<Button')
      expect(nativeButtons.every(button => button.includes('inset-0'))).toBe(true)
    }
  })

  test('routes content view actions through the canonical component', () => {
    const files = [
      'blog/index.stx',
      'seo/index.stx',
    ]

    for (const file of files) {
      const source = readFileSync(
        resolve('storage/framework/defaults/views/dashboard/content', file),
        'utf8',
      )

      expect(source).toContain('<Button')
      expect(source).not.toMatch(/<button\b/)
    }
  })

  test('keeps permission navigation semantic while sharing its actions', () => {
    const source = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/management/permissions/index.stx'),
      'utf8',
    )
    const nativeButtons = [...source.matchAll(/<button\b[^>]*>/g)].map(match => match[0])
    const semanticControls = [
      "tabClass('roles')",
      "tabClass('permissions')",
      "tabClass('users')",
      "tabClass('matrix')",
      '@click="selectRole(role)"',
      'fixed inset-0 w-full bg-black/50',
    ]

    expect((source.match(/<Button/g) || []).length).toBeGreaterThanOrEqual(11)
    expect(nativeButtons.every(button => semanticControls.some(marker => button.includes(marker)))).toBe(true)
  })

  test('keeps appearance selectors native while sharing shell actions', () => {
    const appearance = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/settings/appearance.stx'),
      'utf8',
    )
    const layout = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/layouts/default.stx'),
      'utf8',
    )
    const appearanceButtons = [...appearance.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

    expect(appearance).toContain('<Button variant="secondary" size="sm" @click="resetAll()">')
    expect(appearanceButtons.every(button => button.includes('appearance-option'))).toBe(true)
    expect(layout).toContain('<Button variant="ghost" size="xs" iconOnly ariaLabel="Dismiss notification"')
    expect(layout).not.toMatch(/<button\b/)
  })

  test('keeps CI tabs and filters semantic while sharing drawer actions', () => {
    const source = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/ci/index.stx'),
      'utf8',
    )
    const nativeButtons = [...source.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

    expect(source).toContain('<Button variant="ghost" size="sm" iconOnly ariaLabel="Close run history"')
    expect(source).toContain(':aria-selected="String(activeTab() === org)"')
    expect(nativeButtons.every(button => button.includes('tabClass(') || button.includes('filterClass('))).toBe(true)
  })

  test('keeps model sorting semantic while sharing record actions', () => {
    const source = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/models/[model].stx'),
      'utf8',
    )
    const nativeButtons = [...source.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

    expect((source.match(/<Button/g) || []).length).toBeGreaterThanOrEqual(12)
    expect(source).toContain('interaction="toggle"')
    expect(source).toContain('@click="goToPage(page() + 1)"')
    expect(source).toContain('@click="goToPage(lastPage())"')
    expect(nativeButtons.every(button => button.includes('headerClass(column)'))).toBe(true)
  })

  test('keeps Kanban selection and card navigation semantic while sharing actions', () => {
    const index = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/kanban/index.stx'),
      'utf8',
    )
    const detail = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/kanban/[id].stx'),
      'utf8',
    )
    const indexButtons = [...index.matchAll(/<button\b[^>]*>/g)].map(match => match[0])
    const detailButtons = [...detail.matchAll(/<button\b[^>]*>/g)].map(match => match[0])
    const semanticDetailControls = [
      ':aria-label="\'Open \' + card.title"',
      ':aria-pressed="String(openCard().labels.some',
      ':aria-label="\'Use \' + c + \' label color\'"',
      ':aria-pressed="String(openCard().assignees.some',
    ]

    expect((index.match(/<Button/g) || []).length).toBeGreaterThanOrEqual(4)
    expect((detail.match(/<Button/g) || []).length).toBeGreaterThanOrEqual(17)
    expect(indexButtons.every(button => button.includes('colorButtonClass(c)'))).toBe(true)
    expect(detailButtons.every(button => semanticDetailControls.some(marker => button.includes(marker)))).toBe(true)
  })

  test('keeps file navigation semantic while sharing all file actions', () => {
    const source = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/Content/FileManagerDashboard.stx'),
      'utf8',
    )
    const nativeButtons = [...source.matchAll(/<button\b[^>]*>/g)].map(match => match[0])
    const semanticNavigation = [
      'navRowClass',
      'aria-label="Grid view"',
      'aria-label="List view"',
      ':aria-current',
      'class="flex items-center max-w-md',
      'inset-0',
    ]

    expect((source.match(/<Button/g) || []).length).toBeGreaterThanOrEqual(6)
    expect(source).toContain('<Button :if="selectedItem()?.url" tag="a" :href="selectedItem()?.url"')
    expect(source).not.toMatch(/<a\b[^>]*bg-blue-/)
    expect(nativeButtons.every(button => semanticNavigation.some(marker => button.includes(marker)))).toBe(true)
  })

  test('keeps infrastructure inspector cards semantic while sharing their actions', () => {
    const dashboardFiles = [
      'ServersDashboard.stx',
      'MailboxesDashboard.stx',
    ]

    for (const file of dashboardFiles) {
      const source = readFileSync(
        resolve('storage/framework/defaults/resources/components/Dashboard/Infrastructure', file),
        'utf8',
      )
      const nativeButtons = [...source.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

      expect(source).toContain('<Button')
      expect(source).not.toMatch(/<StxLink\b[^>]*bg-blue-/)
      if (file === 'ServersDashboard.stx')
        expect(source).toContain('<Button tag="a" :href="selectedDetailsPath()"')
      expect(nativeButtons.every(button => button.includes(':for=') && button.includes('@click="inspect'))).toBe(true)
    }

    const resourceCard = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/Infrastructure/CloudResourceButton.stx'),
      'utf8',
    )
    const resourceButtons = [...resourceCard.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

    expect(resourceButtons).toHaveLength(1)
    expect(resourceButtons[0]).toContain(':aria-label=')
    expect(resourceButtons[0]).toContain('@click="inspect"')
  })

  test('keeps error sorting and row navigation semantic while sharing row actions', () => {
    const source = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/Monitoring/ErrorTable.stx'),
      'utf8',
    )
    const nativeButtons = [...source.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

    expect((source.match(/<Button/g) || []).length).toBe(4)
    expect(nativeButtons.every(button =>
      button.includes("nextSort('")
      || button.includes("emit('row-click', error)"),
    )).toBe(true)

  })

  test('keeps email navigation semantic while sharing compose and message actions', () => {
    const actionFiles = [
      'InboxComposer.stx',
      'InboxMessageDetail.stx',
      'EmailSettingsList.stx',
    ]

    for (const file of actionFiles) {
      const source = readFileSync(
        resolve('storage/framework/defaults/resources/components/Dashboard/Email', file),
        'utf8',
      )

      expect(source).toContain('<Button')
      expect(source).not.toMatch(/<button\b/)
    }

    const semanticFiles = [
      ['InboxDashboard.stx', [':aria-pressed']],
      ['EmailSidebar.stx', ["emit('update:active-folder'", "emit('category'"]],
      ['InboxMessageList.stx', ["emit('select', email)"]],
      ['EmailActivityDashboard.stx', ['changeTimeRange(']],
      ['EmailSettingsNavigation.stx', ["emit('select', section.id)"]],
    ] as const

    for (const [file, markers] of semanticFiles) {
      const source = readFileSync(
        resolve('storage/framework/defaults/resources/components/Dashboard/Email', file),
        'utf8',
      )
      const nativeButtons = [...source.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

      expect(nativeButtons.every(button => markers.some(marker => button.includes(marker)))).toBe(true)
    }

    const settingsView = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/inbox/settings.stx'),
      'utf8',
    )

    expect(settingsView).toContain('<Button')
    expect(settingsView).toContain('<Toggle v-model:checked="vacationEnabled"')
    expect(settingsView).not.toMatch(/<button\b/)
    expect(settingsView).not.toMatch(/class="[^"]*{{/)

  })

  test('keeps query ranges semantic while sharing query actions', () => {
    const source = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/Queries/QueryDashboard.stx'),
      'utf8',
    )
    const nativeButtons = [...source.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

    expect(source).toContain('<Button')
    expect(nativeButtons).toHaveLength(3)
    expect(nativeButtons.every(button => button.includes(':aria-pressed'))).toBe(true)
  })
})
