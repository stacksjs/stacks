import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('dashboard captured mail contract', () => {
  test('exposes guarded list and detail APIs through one typed client', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const client = source('storage/framework/defaults/functions/captured-mail.ts')

    expect(routes).toContain("guard(route.get('/email/captured', 'Actions/Dashboard/Email/CapturedMailIndexAction'))")
    expect(routes).toContain("guard(route.get('/email/captured/{id}', 'Actions/Dashboard/Email/CapturedMailShowAction'))")
    expect(client).toContain("dashboardApi<CapturedMailIndex>('/api/dashboard/email/captured')")
    expect(client).toContain('encodeURIComponent(id)')
    expect(client).not.toContain('fetch(')
  })

  test('uses a thin view and componentized STX page', () => {
    const view = source('storage/framework/defaults/views/dashboard/inbox/captured.stx')
    const dashboard = source('storage/framework/defaults/resources/components/Dashboard/Email/CapturedMailDashboard.stx')
    const list = source('storage/framework/defaults/resources/components/Dashboard/Email/CapturedMailList.stx')
    const detail = source('storage/framework/defaults/resources/components/Dashboard/Email/CapturedMailDetail.stx')

    expect(view).toContain('<CapturedMailDashboard />')
    expect(view).not.toContain('<script client>')
    expect(dashboard).toContain('<CapturedMailList')
    expect(dashboard).toContain('<CapturedMailDetail')
    expect(dashboard).toContain('<Button variant="secondary"')
    expect(dashboard).not.toMatch(/\b(?:document|window)\./)
    expect(list).toContain("useReactiveProp<CapturedMailSummary[]>('messages', [])")
    expect(list).toContain("emit('select', message)")
    expect(detail).toContain('<EmailBodyPreview')
    expect(detail).not.toContain('@html=')
  })

  test('keeps captured mail distinct from the inbound inbox routes', () => {
    const navigation = source('storage/framework/defaults/resources/components/Dashboard/Email/EmailNavigation.stx')
    const sidebar = source('storage/framework/defaults/resources/functions/dashboard/sidebar.ts')
    const pageRoutes = source('storage/framework/defaults/routes/dashboard.ts')

    expect(navigation).toContain('to="/inbox/captured"')
    expect(sidebar).toContain("{ to: '/inbox/captured', icon: 'mail-send-02', text: 'Captured Mail' }")
    expect(pageRoutes).not.toContain("prefix: '/inbox'")
    expect(existsSync(resolve('storage/framework/defaults/app/Actions/Dashboard/Inbox/InboxIndexAction.ts'))).toBe(false)
    expect(existsSync(resolve('storage/framework/defaults/app/Actions/Dashboard/Inbox/InboxShowAction.ts'))).toBe(false)
  })
})
