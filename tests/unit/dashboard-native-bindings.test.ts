import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dashboardComponents = resolve(
  'storage/framework/defaults/resources/components/Dashboard',
)
const dashboardResourceViews = resolve(
  'storage/framework/defaults/resources/views/dashboard',
)
const dashboardViews = resolve(
  'storage/framework/defaults/views/dashboard',
)
const dashboardComponentBarrel = resolve(
  'storage/framework/defaults/resources/components/Dashboard/index.ts',
)

function componentSource(path: string): string {
  return readFileSync(resolve(dashboardComponents, path), 'utf8')
}

describe('dashboard native STX bindings', () => {
  test('keeps one implementation for every dashboard component name', () => {
    const paths = readdirSync(dashboardComponents, { recursive: true })
      .map(path => String(path))
      .filter(path => path.endsWith('.stx'))
    const names = paths.map(path => path.split('/').at(-1) || path)
    const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))]

    expect(duplicates).toEqual([])
    expect(existsSync(resolve(dashboardComponents, 'UI/Avatar.stx'))).toBe(true)
    expect(existsSync(resolve(dashboardComponents, 'UI/Card.stx'))).toBe(true)
    expect(existsSync(resolve(dashboardComponents, 'UI/Pagination.stx'))).toBe(true)
    expect(existsSync(resolve(dashboardComponents, 'UI/Table.stx'))).toBe(true)
    expect(existsSync(resolve(dashboardComponents, 'Chart.stx'))).toBe(false)
    expect(existsSync(resolve(dashboardComponents, 'NotificationErrorModal.stx'))).toBe(false)
    expect(existsSync(resolve(dashboardResourceViews, 'custom-page.stx'))).toBe(false)

    for (const legacyBillingComponent of [
      'ActivePlan.stx',
      'CardBrands.stx',
      'CardForm.stx',
      'OneTimePayment.stx',
      'PaymentForm.stx',
      'PaymentMethod.stx',
      'PaymentMethodList.stx',
      'Plans.stx',
    ]) {
      expect(existsSync(resolve(dashboardComponents, 'Billing', legacyBillingComponent))).toBe(false)
    }

    for (const legacyEmailComponent of [
      'EmailCompose.stx',
      'EmailDetail.stx',
      'EmailList.stx',
      'EmailSearch.stx',
    ]) {
      expect(existsSync(resolve(dashboardComponents, 'Email', legacyEmailComponent))).toBe(false)
    }

    for (const legacyMonitoringComponent of [
      'ErrorDetailModal.stx',
      'ErrorsTable.stx',
    ]) {
      expect(existsSync(resolve(dashboardComponents, 'Monitoring', legacyMonitoringComponent))).toBe(false)
    }

    expect(existsSync(resolve(dashboardComponents, 'Queue/QueueTable.stx'))).toBe(false)
    expect(existsSync(resolve(dashboardComponents, 'Widget.stx'))).toBe(false)
    expect(existsSync(resolve(dashboardComponents, 'UI/DataTable.stx'))).toBe(false)
    expect(existsSync(resolve(dashboardComponents, 'UI/RouterLink.stx'))).toBe(false)
    expect(existsSync(resolve(dashboardComponents, 'NotificationStatusBadge.stx'))).toBe(false)
    expect(existsSync(resolve(dashboardComponents, 'NavbarModern.stx'))).toBe(false)

    const barrel = readFileSync(dashboardComponentBarrel, 'utf8')
    expect(barrel).toContain("export { default as Card } from './UI/Card.stx'")
    expect(barrel).toContain("export { default as Table } from './UI/Table.stx'")
    expect(barrel).toContain("export { default as ChartCard } from './UI/ChartCard.stx'")
    expect(barrel).not.toContain('default as Widget')
    expect(barrel).not.toContain('default as DataTable')
    expect(barrel).not.toMatch(/from '\.\/(?:Card|Table|Chart)\.stx'/)
  })

  test('routes primary action links through the shared Button component', () => {
    const paths = readdirSync(dashboardComponents, { recursive: true })
      .map(path => String(path))
      .filter(path => path.endsWith('.stx'))

    for (const path of paths) {
      const source = componentSource(path)
      expect(source).not.toMatch(/<(?:a|StxLink)\b[^>]*(?:bg-blue-600|from-blue-500)/)
    }
  })

  test('shared pagination models its local selection and emits the selected value', () => {
    const source = componentSource('UI/Pagination.stx')

    expect(source).toContain('x-model.number="selectedItemsPerPage"')
    expect(source).toContain('emitItemsPerPage($event)')
    expect(source).not.toContain(':value="itemsPerPage()"')
  })

  test('analytics page header models its local selection across the component boundary', () => {
    const source = componentSource('Analytics/AnalyticsPageHeader.stx')

    expect(source).toContain('x-model="selectedRange"')
    expect(source).toContain('emitRange($event)')
    expect(source).not.toContain(':value="range()"')

    const webView = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/analytics/web/index.stx'),
      'utf8',
    )
    const web = componentSource('Analytics/WebAnalyticsDashboard.stx')
    expect(webView).toContain('<WebAnalyticsDashboard />')
    expect(webView).not.toContain('<script')
    expect(web).toContain('fetchWebAnalytics(analyticsRange())')
    expect(web).toContain('useChart(')
  })

  test('stats cards react to every dynamic presentation prop', () => {
    const source = componentSource('UI/StatsCard.stx')

    for (const binding of [
      'liveTitle',
      'liveValue',
      'liveSubtitle',
      'liveTrendLabel',
      'liveIcon',
      'liveIconBg',
      'liveLoading',
      'liveTrend',
    ])
      expect(source).toContain(`const ${binding} = useReactiveProp`)

    expect(source).toContain('{{ liveValue() }}')
    expect(source).toContain(':if="liveLoading()"')
    expect(source).toContain('iconBackgroundClass()')
    expect(source).not.toContain('<script server>')
  })

  test('event analytics form uses native models and submit prevention', () => {
    const source = componentSource('Analytics/EventAnalytics.stx')

    for (const model of [
      'eventName',
      'eventCategory',
      'eventPath',
      'eventValue',
      'eventCurrency',
    ])
      expect(source).toContain(`x-model="${model}"`)

    expect(source).toContain('@submit.prevent="submitEvent"')
    expect(source).not.toContain('function updateField(')
    expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
  })

  test('content dashboards use native filters and form models', () => {
    for (const component of [
      'Content/AuthorsDashboard.stx',
      'Content/CommentsDashboard.stx',
      'Content/ContentTaxonomyDashboard.stx',
      'Content/PagesDashboard.stx',
      'Content/BlogDashboard.stx',
      'Content/SeoDashboard.stx',
    ]) {
      const source = componentSource(component)
      expect(source).toContain('x-model=')
      expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
      expect(source).not.toMatch(/:checked="[^"]+\(\)"[^>]+@change=/)
      expect(source).not.toMatch(/function update[A-Z]\w*\(event: Event\)/)
    }

    const taxonomy = componentSource('Content/ContentTaxonomyDashboard.stx')
    expect(taxonomy).toContain(".normalize('NFKD')")
    expect(taxonomy).toContain('@input="markSlugTouched"')
    expect(taxonomy).toContain('@blur="normalizeSlug"')
    expect(taxonomy).toContain('class="min-w-0 max-w-full space-y-6"')
    expect(taxonomy).toContain('class="overflow-x-auto max-w-full w-full"')

    const blogView = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/content/blog/index.stx'),
      'utf8',
    )
    const blog = componentSource('Content/BlogDashboard.stx')
    expect(blogView).toContain('<BlogDashboard />')
    expect(blogView).not.toContain('<script')
    expect(blog).toContain('mx-auto min-w-0 max-w-7xl w-full')
    expect(blog).toContain('class="overflow-x-auto max-w-full w-full"')

    const seoView = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/content/seo/index.stx'),
      'utf8',
    )
    expect(seoView).toContain('<SeoDashboard />')
    expect(seoView).not.toContain('<script')
  })

  test('content overview is a thin component backed by persisted metrics', () => {
    const view = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/content/dashboard.stx'),
      'utf8',
    )
    const component = componentSource('Content/ContentDashboard.stx')
    const routes = readFileSync(
      resolve('storage/framework/defaults/routes/dashboard-api.ts'),
      'utf8',
    )

    expect(view).toContain('<ContentDashboard />')
    expect(view).not.toContain('<script client>')
    expect(component).toContain("dashboardApi<ContentOverview>(`/api/dashboard/content/overview?days=${selectedRange()}`)")
    expect(component).toContain('x-model="selectedRange"')
    expect(component).toContain('@change="changeRange"')
    expect(component).toContain("import { useChart }")
    expect(component).not.toContain('Math.random')
    expect(component).not.toContain('2023-')
    expect(component).not.toContain('increase')
    expect(component).not.toContain('decrease')
    expect(routes).toContain("guard(route.get('/content/overview'")
  })

  test('inbox components use native local models across event boundaries', () => {
    const composer = componentSource('Email/InboxComposer.stx')
    for (const model of ['to', 'subject', 'body'])
      expect(composer).toContain(`x-model="${model}"`)
    expect(composer).toContain('@submit.prevent="submit"')
    expect(composer).not.toContain('function update(')

    const detail = componentSource('Email/InboxMessageDetail.stx')
    expect(detail).toContain('x-model="replyText"')
    expect(detail).toContain("emit('update:reply', $event.target.value)")
    expect(detail).toContain('<EmailBodyPreview')
    expect(detail).not.toContain('@html=')
    expect(detail).not.toContain('function updateReply(')

    const preview = componentSource('Email/EmailBodyPreview.stx')
    expect(preview).toContain(':srcdoc="previewHtml()"')
    expect(preview).toContain('sandbox=""')
    expect(preview).toContain('Content-Security-Policy')
    expect(preview).toContain("default-src 'none'")
    expect(preview).toContain('referrerpolicy="no-referrer"')

    const list = componentSource('Email/InboxMessageList.stx')
    expect(list).toContain('x-model="search"')
    expect(list).toContain("emit('search', $event.target.value)")
    expect(list).not.toContain('function updateSearch(')

    const settings = componentSource('Email/InboxSettingsDashboard.stx')
    const settingsView = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/inbox/settings.stx'),
      'utf8',
    )
    expect(settings).toContain('x-model="displayDensity"')
    expect(settings).toContain('x-model="vacationMessage"')
    expect(settingsView).toContain('<InboxSettingsDashboard />')
    expect(settingsView).not.toContain('<script')
  })

  test('shared form controls own their values and stable identities natively', () => {
    const input = componentSource('UI/Input.stx')
    expect(input).toContain('x-model="liveValue"')
    expect(input).toContain("emit('update:value', nextValue)")
    expect(input).toContain(':aria-label="liveAriaLabel() || liveLabel() || null"')
    expect(input).toContain(':autocomplete="liveAutocomplete() || null"')
    expect(input).toContain(':type="liveType()"')
    expect(input).toContain(':disabled="liveDisabled()"')
    expect(input).toContain(':readonly="liveReadonly()"')
    expect(input).toContain(':required="liveRequired()"')
    expect(input).toContain(':text="liveError()"')
    expect(input).toContain("useId('input')")
    expect(input.indexOf("emit('update:value', nextValue)")).toBeLessThan(input.indexOf("emit('input', nextValue)"))
    expect(input).not.toContain('liveValue.set(nextValue)')
    expect(input).not.toContain('Math.random')

    const select = componentSource('UI/Select.stx')
    expect(select).toContain('x-model="liveValue"')
    expect(select).toContain("emit('update:value', nextValue)")
    expect(select).toContain(':aria-label="liveAriaLabel() || liveLabel() || null"')
    expect(select).toContain(':for="option in liveOptions()"')
    expect(select).toContain(':disabled="liveDisabled()"')
    expect(select).toContain(':required="liveRequired()"')
    expect(select).toContain(':text="liveError()"')
    expect(select).toContain("useId('select')")
    expect(select).not.toContain('liveValue.set(nextValue)')
    expect(select).not.toContain('Math.random')

    const checkbox = componentSource('UI/Checkbox.stx')
    expect(checkbox).toContain('x-model="liveChecked"')
    expect(checkbox).toContain(':indeterminate="liveIndeterminate()"')
    expect(checkbox).toContain("emit('update:checked', target.checked)")
    expect(checkbox).toContain("emit('update:indeterminate', target.indeterminate)")
    expect(checkbox).toContain("useId('checkbox')")
    expect(checkbox).toContain('i-hugeicons-tick-02')
    expect(checkbox).not.toContain('<svg')
    expect(checkbox).not.toContain('Math.random')

    const toggle = componentSource('UI/Toggle.stx')
    expect(toggle).toContain('x-model="liveChecked"')
    expect(toggle).toContain('role="switch"')
    expect(toggle).toContain("emit('update:checked', checked)")
    expect(toggle).toContain("useId('toggle')")
    expect(toggle).not.toContain('Math.random')

    const textarea = componentSource('UI/Textarea.stx')
    expect(textarea).toContain('x-model="liveValue"')
    expect(textarea).toContain("emit('update:value', value)")
    expect(textarea).toContain("useId('textarea')")
    expect(textarea).toContain("const liveClass = useReactiveProp('class', '')")
    expect(textarea).toContain('liveClass(),')
    expect(textarea).toContain(':text="limitedCountLabel()"')
    expect(textarea).not.toContain('liveValue.set(value)')
    expect(textarea).not.toContain('Math.random')
  })

  test('authentication forms use native component and control models', () => {
    for (const component of [
      'Auth/Login.stx',
      'Auth/Register.stx',
      'Auth/ForgotPassword.stx',
    ]) {
      const source = componentSource(component)
      expect(source).toContain('v-model:value=')
      expect(source).toContain('@submit.prevent=')
      expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
      expect(source).not.toMatch(/:checked="[^"]+\(\)"[^>]+@change=/)
      expect(source).not.toMatch(/function set[A-Z]\w*\(event: Event\)/)
    }

    const login = componentSource('Auth/Login.stx')
    expect(login).toContain('x-model="rememberMe"')

    const register = componentSource('Auth/Register.stx')
    expect(register).toContain('x-model="agreeToTerms"')

    const forgotPassword = componentSource('Auth/ForgotPassword.stx')
    expect(forgotPassword).toContain("emit('retry')")
    expect(forgotPassword).toContain('i-hugeicons-cube')
    expect(forgotPassword).not.toContain('<svg')
    expect(forgotPassword).not.toContain('<script server>')

    const forgotPasswordDashboard = componentSource('Auth/ForgotPasswordDashboard.stx')
    expect(forgotPasswordDashboard).toContain("dashboardApi('/password/forgot', {")
    expect(forgotPasswordDashboard).toContain("method: 'POST'")
    expect(forgotPasswordDashboard).toContain('auth: false')
    expect(forgotPasswordDashboard).not.toContain("fetch('/forgot-password'")

    const authRoutes = [
      ['login.stx', '<LoginDashboard />'],
      ['register.stx', '<RegisterDashboard />'],
      ['forgot-password.stx', '<ForgotPasswordDashboard />'],
    ]
    for (const [route, mount] of authRoutes) {
      const source = readFileSync(resolve(dashboardViews, route), 'utf8')
      expect(source).toContain(mount)
      expect(source).not.toContain('<script')
    }

    const accessTokens = componentSource('Auth/AccessTokens.stx')
    expect(accessTokens).toContain('@submit.prevent="createAccessToken"')
    expect(accessTokens).not.toContain('event.preventDefault()')
  })

  test('dashboard stores share the authenticated API client', () => {
    for (const store of ['auth.ts', 'ci.ts']) {
      const source = readFileSync(
        resolve(dashboardViews, 'stores', store),
        'utf8',
      )

      expect(source).toContain("import { dashboardApi } from '../../../functions/dashboard-api'")
      expect(source).not.toContain('fetch(')
    }
  })

  test('Buddy prompt uses a native textarea model and submit prevention', () => {
    const source = componentSource('Buddy/BuddyAssistant.stx')

    expect(source).toContain('x-model="prompt"')
    expect(source).toContain('@submit.prevent="sendMessage"')
    expect(source).not.toContain('function updatePrompt(')
    expect(source).not.toContain(':value="prompt()"')
  })

  test('shared buttons and modals use native icons and dialog semantics', () => {
    const button = componentSource('UI/Button.stx')
    expect(button).toContain('from-blue-500 to-blue-600')
    expect(button).toContain("useReactiveProp('href', '')")
    expect(button).toContain(':aria-busy=')
    expect(button).toContain(':aria-disabled=')
    expect(button).toContain(':tabindex=')
    expect(button).toContain('i-hugeicons-loading-03')
    expect(button).not.toContain('<svg')

    const card = componentSource('UI/Card.stx')
    expect(card).toContain('<slot name="actions" />')
    expect(card).not.toContain('action.onClick')
    expect(card).not.toMatch(/@click="\{\{/)

    const tabs = componentSource('UI/Tabs.stx')
    expect(tabs).toContain("emit('update:activeTab', tab.id)")
    expect(tabs).toContain("emit('change', tab.id, tab)")
    expect(tabs).toContain(':aria-selected="String(activeTab() === tab.id)"')
    expect(tabs).toContain('@click="selectTab(tab)"')
    expect(tabs).not.toContain('data-tab-id')

    const filterBar = componentSource('UI/FilterBar.stx')
    expect(filterBar).toContain('x-model="searchValue"')
    expect(filterBar).toContain('x-model.number="itemsPerPage"')
    expect(filterBar).toContain("emit('update:searchValue', value)")
    expect(filterBar).toContain("emit('update:itemsPerPage', value)")
    expect(filterBar).toContain(':aria-label="searchPlaceholder()"')
    expect(filterBar).not.toContain('data-filter-search')
    expect(filterBar).not.toContain('data-items-per-page')

    const deliverySearch = componentSource('Commerce/Delivery/SearchFilter.stx')
    expect(deliverySearch).toContain(':placeholder="placeholder()"')
    expect(deliverySearch).toContain(':aria-label="placeholder()"')

    const quickLinks = componentSource('UI/QuickLinks.stx')
    expect(quickLinks).toContain('const validLinks = derived(() => links().filter')
    expect(quickLinks).toContain(':href="link.href"')
    expect(quickLinks).toContain('<StxLink')
    expect(quickLinks).toContain('isExternal(link.href)')
    expect(quickLinks).not.toContain("link.href || '#'")

    const table = componentSource('UI/Table.stx')
    expect(table).toContain("emit('sort', { key: column.key, direction })")
    expect(table).toContain("emit('update:selectedKeys', next)")
    expect(table).toContain("emit('selection-change', next)")
    expect(table).toContain(':indeterminate="someSelected()"')
    expect(table).toContain('<slot name="actions" :row="row" />')
    expect(table).not.toContain('data-select-all')
    expect(table).not.toContain('data-row-select')

    for (const path of [
      'UI/ChartCard.stx',
      'UI/Avatar.stx',
      'UI/WindowControls.stx',
    ]) {
      const source = componentSource(path)
      expect(source).toContain('i-hugeicons-')
      expect(source).not.toContain('<svg')
    }

    const windowControls = componentSource('UI/WindowControls.stx')
    expect(windowControls).toContain('<script client>')
    expect(windowControls).toContain("import { useWindowControls }")
    expect(windowControls).toContain("emit('close')")
    expect(windowControls).toContain("emit('minimize')")
    expect(windowControls).toContain("emit('maximize')")
    expect(windowControls).not.toContain('<script server>')
    expect(existsSync(resolve(dashboardComponents, 'WindowControls.stx'))).toBe(false)

    const deliveryComponents = resolve(dashboardComponents, 'Commerce/Delivery')
    for (const file of readdirSync(deliveryComponents).filter(file => file.endsWith('.stx'))) {
      const source = readFileSync(resolve(deliveryComponents, file), 'utf8')
      expect(source).not.toContain('bg-blue-600 hover:bg-blue-500')
      expect(source).not.toContain('bg-red-600 hover:bg-red-500')
    }

    for (const file of [
      'Content/AuthorsDashboard.stx',
      'Content/CommentsDashboard.stx',
      'Content/ContentTaxonomyDashboard.stx',
      'Content/FileManagerDashboard.stx',
      'Content/PagesDashboard.stx',
      'Content/PostsDashboard.stx',
    ]) {
      const source = componentSource(file)
      expect(source).not.toMatch(/<button[^>]+bg-(?:blue|red)-600/)
      expect(source).toContain('<Button')
    }

    const marketingComponents = resolve(dashboardComponents, 'Marketing')
    for (const file of readdirSync(marketingComponents).filter(file => file.endsWith('.stx'))) {
      const source = readFileSync(resolve(marketingComponents, file), 'utf8')
      expect(source).not.toContain('bg-blue-600 hover:bg-blue-500')
      expect(source).not.toContain('bg-red-600 hover:bg-red-500')
    }

    const navbar = componentSource('Navbar.stx')
    expect(navbar).toContain('<script server>')
    expect(navbar).toContain('<script client>')
    expect(navbar).toContain('const dropdownOpen = state(requestedDropdown())')
    expect(navbar).toContain('useClickOutside(userMenu')
    expect(navbar).toContain('await auth.logout()')
    expect(navbar).toContain('@click="signOut()"')
    expect(navbar).toContain('to="/models"')
    expect(navbar).toContain('href="/notifications/dashboard"')
    expect(navbar).toContain('href="/library/components"')
    expect(navbar).toContain('href="/settings/billing"')
    expect(navbar).not.toContain('data-action=')
    expect(navbar).not.toContain('dataAction=')
    expect(navbar).not.toContain('action="#"')
    expect(navbar).not.toContain('href="#"')
    expect(navbar).not.toContain('avatars.githubusercontent.com')

    const dashboardLayout = componentSource('DashboardLayout.stx')
    expect(dashboardLayout).toContain('<MobileSidebar>')
    expect(dashboardLayout).toContain('<Navbar currentPath="{{ currentPath }}" />')
    expect(dashboardLayout).not.toContain('data-action=')

    expect(componentSource('Transaction/index.stx')).not.toContain('href="#"')

    const modal = componentSource('UI/Modal.stx')
    expect(modal).toContain('role="dialog"')
    expect(modal).toContain('aria-modal="true"')
    expect(modal).toContain(`:aria-label="liveTitle() || 'Dialog'"`)

    const baseModal = componentSource('Modals/BaseModal.stx')
    expect(baseModal).toContain("const generatedId = useId('modal')")
    expect(baseModal).toContain("emit('update:show', false)")
    expect(baseModal).toContain("emit('close', reason)")
    expect(baseModal).toContain('role="dialog"')
    expect(baseModal).not.toContain('Math.random')
    expect(baseModal).not.toContain('<svg')

    const alert = componentSource('Modals/Popups/Alert.stx')
    expect(alert).toContain("const titleId = useId('alert-title')")
    expect(alert).toContain('role="alertdialog"')
    expect(alert).toContain("emit('update:show', false)")
    expect(alert).toContain("emit(event)")
    expect(alert).not.toContain('<svg')

    const toast = componentSource('Modals/Popups/Toast.stx')
    expect(toast).toContain("const generatedId = useId('toast')")
    expect(toast).toContain("emit('update:show', false)")
    expect(toast).toContain("emit('close')")
    expect(toast).toContain('role="alert"')
    expect(toast).toContain('pointer-events-none')
    expect(toast).not.toContain('Math.random')
    expect(toast).not.toContain('<svg')

    const toastWrapper = componentSource('Modals/ToastWrapper.stx')
    expect(toastWrapper).toContain("const liveWidth = useReactiveProp('width', 30)")
    expect(toastWrapper).toContain("emit('close')")
    expect(toastWrapper).toContain('aria-live="polite"')
    expect(toastWrapper).not.toContain('role="dialog"')
    expect(toastWrapper).not.toContain('<svg')
  })

  test('shared dropdowns and confirmations use reactive component contracts', () => {
    const dropdown = componentSource('UI/Dropdown.stx')
    expect(dropdown).toContain("const requestedOpen = useReactiveProp('open', false)")
    expect(dropdown).toContain('useClickOutside(root, () => setOpen(false))')
    expect(dropdown).toContain("emit('update:open', next)")
    expect(dropdown).toContain('<slot name="trigger" />')
    expect(dropdown).not.toMatch(/\b(?:document|window)\./)
    expect(dropdown).not.toContain('addEventListener(')

    const navigation = componentSource('Elements/DropdownNavigation.stx')
    expect(navigation).toContain("const elements = useReactiveProp('elements'")
    expect(navigation).toContain(':if="isOpen()"')
    expect(navigation).toContain("emit('update:open', next)")
    expect(navigation).toContain('<StxLink :to="element.to"')
    expect(navigation).toContain('@click="setOpen(false)"')
    expect(navigation).not.toContain('querySelector(')

    const confirmation = componentSource('UI/ConfirmDialog.stx')
    expect(confirmation).toContain("const open = useReactiveProp('isOpen', false)")
    expect(confirmation).toContain('role="alertdialog"')
    expect(confirmation).toContain("emit('confirm')")
    expect(confirmation).toContain("emit('close')")
    expect(confirmation).not.toContain('.remove()')
    expect(confirmation).not.toContain('<svg')

  })

  test('operational dashboards use native filter models', () => {
    for (const component of [
      'Deployments/DeploymentList.stx',
      'Jobs/JobHistory.stx',
      'Monitoring/ErrorDashboard.stx',
      'Queries/QueryDashboard.stx',
      'Realtime/RealtimeDashboard.stx',
      'Releases/ReleaseDashboard.stx',
    ]) {
      const source = componentSource(component)
      expect(source).toMatch(/(?:x-model|v-model:value)=/)
      expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
      expect(source).not.toMatch(/function update[A-Z]\w*\(event: Event\)/)
    }

    const deployments = componentSource('Deployments/DeploymentList.stx')
    expect(deployments).toContain('v-model:value="environment"')
    expect(deployments).toContain('v-model:value="domain"')

    const jobs = componentSource('Jobs/JobHistory.stx')
    expect(jobs).toContain('setTimeout(reloadFilters, 250)')
    expect(jobs).toContain('onDestroy(')

    const queries = componentSource('Queries/QueryDashboard.stx')
    expect(queries).toContain('const itemsPerPage = state(50)')
    expect(queries).toContain(':for="query in visibleQueries()"')
    expect(queries).toContain('<Pagination')
  })

  test('environment editor uses a guarded API and a two-way STX component', () => {
    const view = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/environment/index.stx'),
      'utf8',
    )
    const page = componentSource('Environment/EnvironmentDashboard.stx')
    const routes = readFileSync(
      resolve('storage/framework/defaults/routes/dashboard-api.ts'),
      'utf8',
    )
    const editor = componentSource('CodeEditor.stx')

    expect(view).toContain('<EnvironmentDashboard />')
    expect(view).not.toContain('<script')
    expect(page).toContain("dashboardApi<EnvironmentResponse>('/api/dashboard/environment')")
    expect(page).toContain('v-model:value="envValues"')
    expect(page).toContain("useEventListener('keydown', handlePageKeydown)")
    expect(page).toContain('<Modal')
    expect(page).not.toMatch(/\b(?:document|window)\./)
    expect(page).not.toContain('fetch(')
    expect(page).not.toContain('setTimeout(')

    expect(editor).toContain("const liveValue = useReactiveProp('value', '')")
    expect(editor).toContain('x-model="liveValue"')
    expect(editor).toContain("emit('update:value', value)")
    expect(editor).toContain("emit('save')")
    expect(editor).not.toMatch(/\b(?:document|window)\./)

    expect(routes).toContain("guard(route.get('/environment'")
    expect(routes).toContain("guard(route.put('/environment'")
  })

  test('settings editor uses reactive keyed drafts and native models', () => {
    const view = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/settings/index.stx'),
      'utf8',
    )
    const page = componentSource('Settings/SettingsDashboard.stx')

    expect(view).toContain('<SettingsDashboard />')
    expect(view).not.toContain('<script')
    expect(page).toContain('const drafts = reactive<')
    expect(page).toContain('x-model="query"')
    expect(page).toContain('x-model="drafts[field.key]"')
    expect(page).toContain('x-model.number="drafts[field.key]"')
    expect(page).toContain("dashboardApi<ConfigUpdateResponse>('/api/config/update'")
    expect(page).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
    expect(page).not.toContain('setDraft(')
    expect(page).not.toContain('fetch(')
  })

  test('mail settings use a componentized write-only secret contract', () => {
    const view = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/settings/mail.stx'),
      'utf8',
    )
    const component = componentSource('Settings/MailSettingsDashboard.stx')
    const getAction = readFileSync(
      resolve('storage/framework/defaults/app/Actions/Dashboard/Settings/MailSettingsGetAction.ts'),
      'utf8',
    )
    const routes = readFileSync(
      resolve('storage/framework/defaults/routes/dashboard-api.ts'),
      'utf8',
    )

    expect(view).toContain('<MailSettingsDashboard />')
    expect(view).not.toContain('<script client>')
    expect(component).toContain("dashboardApi<MailSettingsResponse>('/api/dashboard/mail-settings')")
    expect(component).toContain('@submit.prevent="saveSettings"')
    expect(component).toContain('v-model:value="driver"')
    expect(component).toContain('x-model="clearSmtpPassword"')
    expect(component).not.toMatch(/\b(?:document|window)\./)
    expect(component).not.toContain('fetch(')
    expect(getAction).toContain('readMailSettings()')
    expect(getAction).not.toContain('password:')
    expect(routes).toContain("guard(route.get('/mail-settings'")
    expect(routes).toContain("guard(route.put('/mail-settings'")
  })

  test('component library uses the native source scanner and scaffold APIs', () => {
    const view = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/library/components/index.stx'),
      'utf8',
    )
    const component = componentSource('Library/ComponentsDashboard.stx')

    expect(view).toContain('<ComponentsDashboard />')
    expect(view).not.toContain('<script client>')
    expect(component).toContain("dashboardApi<ComponentsResponse>('/api/dashboard/library/components')")
    expect(component).toContain("await dashboardApi('/api/dashboard/library/components'")
    expect(component).toContain('x-model="search"')
    expect(component).toContain('x-model="selectedCategory"')
    expect(component).toContain('x-model.trim="componentName"')
    expect(component).toContain('@submit.prevent="createComponent()"')
    expect(component).not.toContain('Math.random')
    expect(component).not.toContain('fetch(')
    expect(component).not.toContain('<canvas')
  })

  test('CI keeps its data sparkline but delegates status icons to Iconify', () => {
    const ciView = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/ci/index.stx'),
      'utf8',
    )
    const ci = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/Ci/CiDashboard.stx'),
      'utf8',
    )

    expect(ciView).toContain('<CiDashboard />')
    expect(ciView).not.toContain('<script')
    expect(ci.match(/<svg\b/g)).toHaveLength(1)
    expect(ci).toContain(':d="sparklinePath()"')
    expect(ci).toContain('i-hugeicons-loading-03')
    expect(ci).toContain('i-hugeicons-checkmark-circle-02')
    expect(ci).toContain('i-hugeicons-cancel-circle')
    expect(ci).toContain('i-hugeicons-cancel-01')
  })

  test('kanban uses native reactive drag, dialogs, and form models', () => {
    const page = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/kanban/[id].stx'),
      'utf8',
    )
    const board = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/Kanban/KanbanBoardDashboard.stx'),
      'utf8',
    )
    const indexView = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/kanban/index.stx'),
      'utf8',
    )
    const index = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/Kanban/KanbanBoardsDashboard.stx'),
      'utf8',
    )
    const store = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/stores/kanban.ts'),
      'utf8',
    )
    const role = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/composables/useRole.ts'),
      'utf8',
    )

    expect(page).toContain('<KanbanBoardDashboard />')
    expect(page).not.toContain('<script')
    expect(board).toContain('@dragstart.stop="beginCardDrag')
    expect(board).toContain('@drop.prevent="dropOnColumn(col.id)"')
    expect(board).toContain('await kanban.reorderColumns(currentBoard.id, order)')
    expect(board).toContain('<ConfirmDialog')
    expect(board).toContain('x-model="draftCardTitle"')
    expect(board).toContain('x-model="commentDraft"')
    expect(board).toContain('<StxLink to="/kanban"')
    expect(board).toContain("import { kanbanStore } from '~/storage/framework/defaults/views/dashboard/stores/kanban'")
    expect(board).toContain('const kanban = kanbanStore')
    expect(board).not.toContain("useStore('kanban')")
    expect(board).not.toMatch(/\b(?:document|window)\./)
    expect(board).not.toContain('querySelector(')
    expect(board).not.toContain('https://esm.sh')
    expect(board).not.toContain('<svg')
    expect(board).not.toContain('onUnmount(')

    expect(indexView).toContain('<KanbanBoardsDashboard />')
    expect(indexView).not.toContain('<script')
    expect(index).toContain('<Modal')
    expect(index).toContain('@submit.prevent="submitCreate"')
    expect(index).toContain('x-model="draftName"')
    expect(index).toContain('x-model="draftDescription"')
    expect(index).toContain(':to="`/kanban/${board.id}`"')
    expect(index).toContain("import { kanbanStore } from '~/storage/framework/defaults/views/dashboard/stores/kanban'")
    expect(index).toContain('const kanban = kanbanStore')
    expect(index).not.toContain("useStore('kanban')")
    expect(index).not.toMatch(/\b(?:document|window)\./)
    expect(index).not.toContain('<svg')

    expect(store).toContain("import { dashboardApi } from '../../../functions/dashboard-api'")
    expect(store).toContain("dashboardApi<{ board?: BoardSummary")
    expect(store).toContain("{ method: 'DELETE' }")
    expect(store).not.toContain('fetch(')
    expect(role).toContain("import { authStore } from '../stores/auth'")
    expect(role).toContain('const auth = authStore')
    expect(role).not.toContain("useStore<RoleSnapshot>('auth')")
  })

  test('RBAC management uses guarded native contracts', () => {
    const route = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/management/permissions/index.stx'),
      'utf8',
    )
    const page = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/Management/PermissionsDashboard.stx'),
      'utf8',
    )
    const store = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/stores/rbac.ts'),
      'utf8',
    )
    const usersAction = readFileSync(
      resolve('storage/framework/defaults/app/Actions/Dashboard/Rbac/UsersListAction.ts'),
      'utf8',
    )
    const userRolesAction = readFileSync(
      resolve('storage/framework/defaults/app/Actions/Dashboard/Rbac/UserRolesSyncAction.ts'),
      'utf8',
    )

    expect(route).toContain('<PermissionsDashboard />')
    expect(route).not.toContain('<script')

    for (const model of [
      'newRoleName',
      'newRoleDescription',
      'newRoleGuard',
      'newPermName',
      'newPermDescription',
      'newPermGuard',
      'roleFilter',
      'permissionFilter',
      'userFilter',
      'selectedUserGuard',
    ])
      expect(page).toContain(`x-model="${model}"`)

    expect(page).toContain('<ConfirmDialog')
    expect(page).toContain('@click="requestRoleDelete(role)"')
    expect(page).toContain('@click="requestPermissionDelete(perm)"')
    expect(page).toContain('@click="selectUser(u)"')
    expect(page).toContain('@click="selectRole(role)"')
    expect(page).toContain('useEventListener(\'keydown\', handleKeydown)')
    expect(page).not.toMatch(/\b(?:document|window)\./)
    expect(page).not.toContain('window.confirm')
    expect(page).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)

    expect(store).toContain("import { dashboardApi } from '../../../functions/dashboard-api'")
    expect(store).toContain('function userRoleKey(userId: number, guardName: string)')
    expect(store).toContain('function rolePermissionKey(roleName: string, guardName: string)')
    expect(store).toContain('?guard=${encodeURIComponent(guardName)}')
    expect(store).not.toContain('fetch(')

    expect(usersAction).toContain("import { User } from '@stacksjs/orm'")
    expect(usersAction).toContain("User.orderBy('name', 'asc')")
    expect(usersAction).not.toContain('db.unsafe')
    expect(userRolesAction).toContain('if (!await User.find(userId))')
    expect(userRolesAction).toContain(".filter(role => role.guard_name === guardName)")
  })
})
