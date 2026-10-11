import { describe, expect, test } from 'bun:test'
import {
  accountNotificationTemplates,
  commerceNotificationTemplates,
  createNotificationTemplates,
  defineNotificationTemplates,
  interpolateNotificationText,
  notificationTemplateVariables,
  renderNotificationTemplate,
  resolveNotificationLocale,
  subscriptionNotificationTemplates,
} from '../src/templates'

const booked = defineNotificationTemplates({
  class_booked: {
    copy: {
      en: { subject: 'You’re booked at {{gym}}', body: 'See you at {{class_name}} on {{date}}.' },
      de: { subject: 'Gebucht bei {{gym}}', body: 'Bis {{date}} bei {{class_name}}.' },
    },
    action: { path: '/classes/{{class_id}}', label: { en: 'Open the class', de: 'Stunde öffnen' } },
  },
  no_button: { copy: { en: { subject: 'Hi', body: 'No button here.' } } },
})

describe('notification templates', () => {
  test('replaces variables, and a missing one with nothing', () => {
    expect(interpolateNotificationText('{{a}} and {{ b }} and {{c}}', { a: 1, b: 'two', c: null })).toBe('1 and two and ')
    expect(notificationTemplateVariables('{{a}} {{b}} {{a}}')).toEqual(['a', 'b'])
  })

  test('falls back from a regional locale to its language, then to the fallback', () => {
    expect(resolveNotificationLocale(['en', 'de'], 'de-AT')).toBe('de')
    expect(resolveNotificationLocale(['en', 'de'], 'fr')).toBe('en')
    expect(resolveNotificationLocale(['de'], 'fr')).toBe('de')
    expect(resolveNotificationLocale(['en', 'de'], 'fr', 'de')).toBe('de')
  })

  test('renders copy and a button joined to the base URL', () => {
    const rendered = renderNotificationTemplate(booked.class_booked, { gym: 'HQ', class_name: 'Strength', date: '2026-07-20', class_id: 9 }, { locale: 'de', baseUrl: 'https://app.test/' })
    expect(rendered).toEqual({ subject: 'Gebucht bei HQ', body: 'Bis 2026-07-20 bei Strength.', action: { label: 'Stunde öffnen', url: 'https://app.test/classes/9' } })
  })

  test('leaves the button out when its link would be incomplete, or when there is none', () => {
    expect(renderNotificationTemplate(booked.class_booked, { gym: 'HQ' }).action).toBeUndefined()
    expect(renderNotificationTemplate(booked.no_button, {}).action).toBeUndefined()
  })

  test('uses a path that renders to an absolute URL as it is', () => {
    const created = accountNotificationTemplates().account_created
    const rendered = renderNotificationTemplate(created, { app: 'Gym', inviter: 'Front desk', days: 7, set_password_url: 'https://app.test/reset-password?token=abc' }, { baseUrl: 'https://ignored.test' })
    expect(rendered.action).toEqual({ label: 'Set your password', url: 'https://app.test/reset-password?token=abc' })
  })

  test('a catalog validates names and reads its base URL when it renders', () => {
    let base = 'https://one.test'
    const catalog = createNotificationTemplates(booked, { baseUrl: () => base })
    expect(catalog.names).toEqual(['class_booked', 'no_button'])
    expect(catalog.has('class_booked')).toBe(true)
    expect(catalog.has('nope')).toBe(false)
    base = 'https://two.test'
    expect(catalog.render('class_booked', { class_id: 1 }).action?.url).toBe('https://two.test/classes/1')
    expect(() => catalog.render('nope' as 'class_booked')).toThrow('Unknown notification template "nope"')
  })
})

describe('built-in catalogs', () => {
  const catalogs = { ...accountNotificationTemplates(), ...commerceNotificationTemplates(), ...subscriptionNotificationTemplates() }

  test('every built-in message has English and German copy that use the same variables', () => {
    for (const [name, definition] of Object.entries(catalogs)) {
      expect(Object.keys(definition.copy).sort(), name).toEqual(['de', 'en'])
      const en = notificationTemplateVariables(`${definition.copy.en!.subject} ${definition.copy.en!.body}`).sort()
      const de = notificationTemplateVariables(`${definition.copy.de!.subject} ${definition.copy.de!.body}`).sort()
      expect(de, name).toEqual(en)
      if (definition.action)
        expect(Object.keys(definition.action.label).sort(), name).toEqual(['de', 'en'])
    }
  })

  test('account messages tell the owner what changed and where to turn', () => {
    const { password_changed, email_changed, account_deleted } = accountNotificationTemplates({ resetPassword: '/password/forgot' })
    const vars = { app: 'Gym', support_email: 'help@gym.test', old_email: 'a@x.test', new_email: 'b@x.test', date: '2026-10-11' }
    expect(renderNotificationTemplate(password_changed, vars, { baseUrl: 'https://gym.test' })).toEqual({
      subject: 'Your Gym password was changed',
      body: 'The password for your Gym account was changed.\n\nIf you did this, there’s nothing else to do. If you didn’t, reset your password right away and let us know at help@gym.test.',
      action: { label: 'Reset your password', url: 'https://gym.test/password/forgot' },
    })
    expect(renderNotificationTemplate(email_changed, vars).body).toContain('from a@x.test to b@x.test')
    expect(renderNotificationTemplate(account_deleted, vars, { locale: 'de' }).body).toContain('am 2026-10-11 gelöscht')
  })

  test('commerce and subscription messages carry their amounts and plan', () => {
    const { order_receipt, order_refunded, new_sale } = commerceNotificationTemplates({ orders: '/purchases', sales: '/coach/sales' })
    const receipt = renderNotificationTemplate(order_receipt, { seller: 'HQ', lines: '2 × Day pass: €20.00', total: '€20.00', order_number: 'POS-1', date: '2026-10-11' }, { baseUrl: 'https://hq.test' })
    expect(receipt.body).toBe('Thanks for your purchase from HQ.\n\n2 × Day pass: €20.00\nTotal: €20.00\n\nOrder POS-1, paid 2026-10-11.')
    expect(receipt.action?.url).toBe('https://hq.test/purchases')
    expect(renderNotificationTemplate(order_refunded, { seller: 'HQ', amount: '€5.00', order_number: 'POS-1' }).subject).toBe('Refund from HQ: €5.00')
    expect(renderNotificationTemplate(new_sale, { item: 'Base plan' }, { baseUrl: 'https://hq.test' }).action?.url).toBe('https://hq.test/coach/sales')
    const { subscription_trial_ending } = subscriptionNotificationTemplates()
    expect(renderNotificationTemplate(subscription_trial_ending, { app: 'HQ', plan: 'Coach', date: '2026-10-25' }, { locale: 'de' }).subject).toBe('Deine HQ-Testphase endet am 2026-10-25')
  })
})
