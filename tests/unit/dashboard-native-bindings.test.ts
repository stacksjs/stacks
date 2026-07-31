import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dashboardComponents = resolve(
  'storage/framework/defaults/resources/components/Dashboard',
)

function componentSource(path: string): string {
  return readFileSync(resolve(dashboardComponents, path), 'utf8')
}

describe('dashboard native STX bindings', () => {
  test('shared pagination models its local selection and emits the selected value', () => {
    const source = componentSource('Pagination.stx')

    expect(source).toContain('x-model.number="selectedItemsPerPage"')
    expect(source).toContain('emitItemsPerPage($event)')
    expect(source).not.toContain(':value="itemsPerPage()"')
  })

  test('analytics page header models its local selection across the component boundary', () => {
    const source = componentSource('Analytics/AnalyticsPageHeader.stx')

    expect(source).toContain('x-model="selectedRange"')
    expect(source).toContain('emitRange($event)')
    expect(source).not.toContain(':value="range()"')
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
    expect(detail).not.toContain('function updateReply(')

    const list = componentSource('Email/InboxMessageList.stx')
    expect(list).toContain('x-model="search"')
    expect(list).toContain("emit('search', $event.target.value)")
    expect(list).not.toContain('function updateSearch(')
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

    for (const path of [
      'UI/ChartCard.stx',
      'UI/Avatar.stx',
      'Avatar.stx',
      'Email/EmailDetail.stx',
      'Email/EmailList.stx',
      'NavbarModern.stx',
      'UI/WindowControls.stx',
      'WindowControls.stx',
    ]) {
      const source = componentSource(path)
      expect(source).toContain('i-hugeicons-')
      expect(source).not.toContain('<svg')
    }

    for (const path of ['UI/WindowControls.stx', 'WindowControls.stx']) {
      const source = componentSource(path)
      expect(source).toContain('<script client>')
      expect(source).toContain("import { useWindowControls }")
      expect(source).toContain("emit('close')")
      expect(source).toContain("emit('minimize')")
      expect(source).toContain("emit('maximize')")
      expect(source).not.toContain('<script server>')
    }

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

    const navbar = componentSource('NavbarModern.stx')
    expect(navbar).toContain('notificationCount = 0')
    expect(navbar).toContain('href="/notifications/dashboard"')
    expect(navbar).toContain('href="/settings/billing"')
    expect(navbar).toContain('dataAction="logout"')
    expect(navbar).not.toContain('href="/notifications"')
    expect(navbar).not.toContain('href="/profile"')
    expect(navbar).not.toContain('href="/billing"')
    expect(navbar).not.toContain('Chris Breuer')
    expect(navbar).not.toContain('chris@stacksjs.org')

    const legacyNavbar = componentSource('Navbar.stx')
    expect(legacyNavbar).toContain('<script server>')
    expect(legacyNavbar).toContain('href="/notifications/dashboard"')
    expect(legacyNavbar).toContain('href="/library/components"')
    expect(legacyNavbar).toContain('href="/settings/billing"')
    expect(legacyNavbar).toContain('dataAction="logout"')
    expect(legacyNavbar).not.toContain('href="#"')
    expect(legacyNavbar).not.toContain('avatars.githubusercontent.com')

    expect(componentSource('Queue/QueueTable.stx')).not.toContain('href="#"')
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

    const navigation = componentSource('Elements/Dropdown.stx')
    expect(navigation).toContain("const elements = useReactiveProp('elements'")
    expect(navigation).toContain(':if="isOpen()"')
    expect(navigation).toContain("emit('update:open', next)")
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
    const page = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/environment/index.stx'),
      'utf8',
    )
    const routes = readFileSync(
      resolve('storage/framework/defaults/routes/dashboard-api.ts'),
      'utf8',
    )
    const editor = componentSource('CodeEditor.stx')

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
    const ci = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/ci/index.stx'),
      'utf8',
    )

    expect(ci.match(/<svg\b/g)).toHaveLength(1)
    expect(ci).toContain(':d="sparklinePath()"')
    expect(ci).toContain('i-hugeicons-loading-03')
    expect(ci).toContain('i-hugeicons-checkmark-circle-02')
    expect(ci).toContain('i-hugeicons-cancel-circle')
    expect(ci).toContain('i-hugeicons-cancel-01')
  })

  test('kanban uses native reactive drag, dialogs, and form models', () => {
    const board = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/kanban/[id].stx'),
      'utf8',
    )
    const index = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/kanban/index.stx'),
      'utf8',
    )
    const store = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/stores/kanban.ts'),
      'utf8',
    )

    expect(board).toContain('@dragstart.stop="beginCardDrag')
    expect(board).toContain('@drop.prevent="dropOnColumn(col.id)"')
    expect(board).toContain('await kanban.reorderColumns(currentBoard.id, order)')
    expect(board).toContain('<ConfirmDialog')
    expect(board).toContain('x-model="draftCardTitle"')
    expect(board).toContain('x-model="commentDraft"')
    expect(board).toContain('<StxLink to="/kanban"')
    expect(board).not.toMatch(/\b(?:document|window)\./)
    expect(board).not.toContain('querySelector(')
    expect(board).not.toContain('https://esm.sh')
    expect(board).not.toContain('<svg')
    expect(board).not.toContain('onUnmount(')

    expect(index).toContain('<Modal')
    expect(index).toContain('@submit.prevent="submitCreate"')
    expect(index).toContain('x-model="draftName"')
    expect(index).toContain('x-model="draftDescription"')
    expect(index).toContain(':to="`/kanban/${board.id}`"')
    expect(index).not.toMatch(/\b(?:document|window)\./)
    expect(index).not.toContain('<svg')

    expect(store).toContain("import { dashboardApi } from '../../../functions/dashboard-api'")
    expect(store).toContain("dashboardApi<{ board?: BoardSummary")
    expect(store).toContain("{ method: 'DELETE' }")
    expect(store).not.toContain('fetch(')
  })

  test('RBAC management uses guarded native contracts', () => {
    const page = readFileSync(
      resolve('storage/framework/defaults/views/dashboard/management/permissions/index.stx'),
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
