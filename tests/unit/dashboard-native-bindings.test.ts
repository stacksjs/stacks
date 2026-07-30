import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
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

  test('shared inputs and selects own their control values natively', () => {
    const input = componentSource('UI/Input.stx')
    expect(input).toContain('x-model="liveValue"')
    expect(input).toContain("emit('update:value', nextValue)")
    expect(input).toContain('aria-label="{{ ariaLabel }}"')
    expect(input).toContain(':disabled="liveDisabled()"')
    expect(input).toContain(':readonly="liveReadonly()"')
    expect(input).toContain(':required="liveRequired()"')
    expect(input).toContain('{{ liveError() }}')
    expect(input.indexOf("emit('update:value', nextValue)")).toBeLessThan(input.indexOf("emit('input', nextValue)"))
    expect(input).not.toContain('liveValue.set(nextValue)')

    const select = componentSource('UI/Select.stx')
    expect(select).toContain('x-model="liveValue"')
    expect(select).toContain("emit('update:value', nextValue)")
    expect(select).toContain('aria-label="{{ ariaLabel }}"')
    expect(select).toContain(':disabled="liveDisabled()"')
    expect(select).toContain(':required="liveRequired()"')
    expect(select).toContain('{{ liveError() }}')
    expect(select).not.toContain('liveValue.set(nextValue)')
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

  test('shared buttons and modals use native icons and dialog semantics', () => {
    const button = componentSource('UI/Button.stx')
    expect(button).toContain('i-hugeicons-loading-03')
    expect(button).not.toContain('<svg')

    const modal = componentSource('UI/Modal.stx')
    expect(modal).toContain('role="dialog"')
    expect(modal).toContain('aria-modal="true"')
    expect(modal).toContain(`:aria-label="liveTitle() || 'Dialog'"`)
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
})
