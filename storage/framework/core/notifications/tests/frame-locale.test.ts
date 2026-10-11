import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const { NOTIFICATION_FRAME_STRINGS, notificationEmailHtml, notificationEmailMessage, notificationEmailText, notificationFrameStrings, notificationLanguageTag, notificationSmsBody } = await import('../src/index')

/*
 * tests/fixtures/email-frame holds what the frame rendered before it could be
 * localized. Without a locale, and with `locale: 'en'`, it must still render
 * exactly that, byte for byte. Only what differs by machine is masked: the
 * year, stx's per-process build id, and the configured app name and colour.
 * If an stx upgrade changes the markup itself, regenerate the fixtures from a
 * render with no locale, and check the diff is stx's alone.
 */
const fixtures = join(import.meta.dir, 'fixtures', 'email-frame')
const year = String(new Date().getFullYear())
function mask(html: string): string {
  const app = html.match(/<h1 style="[^"]*">([^<]*)<\/h1>/)?.[1] ?? ''
  const color = html.match(/<td style="background-color:([^;"]+);padding:30px 40px;/)?.[1] ?? ''
  let masked = html.replaceAll(year, '{{YEAR}}').replace(/<meta name="stx-build" content="[^"]*">/, '<meta name="stx-build" content="{{BUILD}}">')
  if (app)
    masked = masked.replaceAll(app, '{{APP}}')
  if (color)
    masked = masked.replaceAll(color, '{{COLOR}}')
  return masked
}
const fixture = (name: string) => readFileSync(join(fixtures, name), 'utf8')

const unsubscribe = { url: 'https://app.test/unsubscribe?token=abc', preferencesUrl: 'https://app.test/settings' }
const cases = {
  'transactional': { subject: 'Coach commented', body: 'Nice <3 & well done\n\nSee https://example.com/w/1', action: { label: 'Open the workout', url: 'https://example.com/w/1' } },
  'default-action': { subject: 'Receipt', body: 'Paid.', action: { label: '', url: 'https://example.com/r/1' } },
  'marketing': { subject: 'Summer hours', body: 'Open at 6.', unsubscribe },
}

describe('the English frame is unchanged', () => {
  for (const [name, payload] of Object.entries(cases)) {
    test(`${name}: no locale renders the pre-locale HTML and text byte for byte`, async () => {
      expect(mask(await notificationEmailHtml(payload))).toBe(fixture(`${name}.html`))
      expect(notificationEmailText(payload)).toBe(fixture(`${name}.txt`))
    })

    test(`${name}: locale "en" (and an unknown language) render the same`, async () => {
      expect(mask(await notificationEmailHtml({ ...payload, locale: 'en' }))).toBe(fixture(`${name}.html`))
      expect(mask(await notificationEmailHtml({ ...payload, locale: 'fr' }))).toBe(fixture(`${name}.html`).replace('<html lang="en">', '<html lang="fr">'))
      expect(notificationEmailText({ ...payload, locale: 'en-GB' })).toBe(fixture(`${name}.txt`))
    })
  }
})

describe('a German frame', () => {
  test('transactional: the footer and copyright are German, and so is <html lang>', async () => {
    const html = await notificationEmailHtml({ ...cases.transactional, locale: 'de' })
    expect(html).toContain('<html lang="de">')
    expect(html).toMatch(/Diese Nachricht wurde automatisch von .+? verschickt\. Bitte antworte nicht auf diese E-Mail\./)
    expect(html).toContain(`&copy; ${year} `)
    expect(html).toContain('. Alle Rechte vorbehalten.')
    expect(html).not.toContain('Please do not reply')
    expect(html).not.toContain('All rights reserved')
    expect(html).not.toMatch(/\{app\}|\{year\}|\{\{/)
    // The message itself is the caller's, and stays as given.
    expect(html).toContain('Open the workout')
  })

  test('marketing: the notice and both links are German', async () => {
    const html = await notificationEmailHtml({ ...cases.marketing, locale: 'de-AT' })
    expect(html).toContain('<html lang="de-AT">')
    expect(html).toContain('Du erhältst diese E-Mail, weil diese E-Mails in deinen Einstellungen aktiviert sind.')
    expect(html).toContain('>Abmelden</a>')
    expect(html).toContain('>E-Mail-Einstellungen</a>')
    expect(html).not.toContain('>Unsubscribe</a>')
    expect(html).not.toContain('You are receiving this')
  })

  test('a button without a label says Öffnen, in the HTML and the text part', async () => {
    expect(await notificationEmailHtml({ ...cases['default-action'], locale: 'de' })).toContain('Öffnen')
    expect(notificationEmailText({ ...cases['default-action'], locale: 'de' })).toBe('Paid.\n\nÖffnen: https://example.com/r/1')
  })

  test('the text part spells the unsubscribe link out in German', () => {
    expect(notificationEmailText({ body: 'Ab 6 Uhr offen.', unsubscribe, locale: 'de' })).toBe('Ab 6 Uhr offen.\n\nDu erhältst diese E-Mail, weil diese E-Mails in deinen Einstellungen aktiviert sind.\nAbmelden: https://app.test/unsubscribe?token=abc')
  })

  test('the payload\'s own notice still wins over the frame\'s', async () => {
    const html = await notificationEmailHtml({ ...cases.marketing, unsubscribe: { ...unsubscribe, notice: 'Du bekommst Neuigkeiten von uns.' }, locale: 'de' })
    expect(html).toContain('Du bekommst Neuigkeiten von uns.')
    expect(html).toContain('>Abmelden</a>')
  })

  test('notificationEmailMessage carries the locale to both parts', async () => {
    const message = await notificationEmailMessage('a@app.test', { subject: 'Hallo', body: 'Text', unsubscribe, locale: 'de' })
    expect(message.text).toContain('Abmelden: https://app.test/unsubscribe?token=abc')
    expect(message.html).toContain('>Abmelden</a>')
    expect(message.headers?.['List-Unsubscribe']).toBe('<https://app.test/unsubscribe?token=abc>')
  })
})

describe('another language, from the app', () => {
  const fr = {
    automatedNotice: 'Message automatique de {app}. Merci de ne pas répondre.',
    copyright: '{year} {app}. Tous droits réservés.',
    unsubscribeNotice: 'Vous recevez ce message car ces e-mails sont activés dans vos paramètres.',
    unsubscribe: 'Se désabonner',
    preferences: 'Préférences e-mail',
    action: 'Ouvrir',
    smsOptOut: 'Répondez STOP pour vous désabonner.',
  }

  test('a whole set of strings renders the frame in that language', async () => {
    const transactional = await notificationEmailHtml({ ...cases['default-action'], locale: 'fr', strings: fr })
    expect(transactional).toContain('<html lang="fr">')
    expect(transactional).toMatch(/Message automatique de .+?\. Merci de ne pas répondre\./)
    expect(transactional).toContain('Tous droits réservés.')
    expect(transactional).toContain('Ouvrir')
    const marketing = await notificationEmailHtml({ ...cases.marketing, locale: 'fr', strings: fr })
    expect(marketing).toContain('>Se désabonner</a>')
    expect(marketing).toContain('>Préférences e-mail</a>')
    expect(notificationSmsBody({ body: 'Soldes', locale: 'fr', strings: fr }, 'marketing')).toBe('Soldes\n\nRépondez STOP pour vous désabonner.')
  })

  test('a partial set overrides only what it names; empty values are ignored', () => {
    expect(notificationFrameStrings('de', { unsubscribe: 'Austragen', preferences: '  ' })).toEqual({ ...NOTIFICATION_FRAME_STRINGS.de, unsubscribe: 'Austragen' })
    expect(notificationFrameStrings('fr', { action: 'Ouvrir' })).toEqual({ ...NOTIFICATION_FRAME_STRINGS.en, action: 'Ouvrir' })
  })
})

describe('frame strings', () => {
  test('fall back like the template registry: de-AT → de → en', () => {
    expect(notificationFrameStrings('de-AT')).toEqual(NOTIFICATION_FRAME_STRINGS.de)
    expect(notificationFrameStrings('de_CH')).toEqual(NOTIFICATION_FRAME_STRINGS.de)
    expect(notificationFrameStrings('es')).toEqual(NOTIFICATION_FRAME_STRINGS.en)
    expect(notificationFrameStrings(null)).toEqual(NOTIFICATION_FRAME_STRINGS.en)
  })

  test('every built-in language has every string, and keeps STOP in the SMS line', () => {
    for (const strings of Object.values(NOTIFICATION_FRAME_STRINGS)) {
      expect(Object.keys(strings).sort()).toEqual(Object.keys(NOTIFICATION_FRAME_STRINGS.en).sort())
      expect(strings.smsOptOut).toContain('STOP')
      expect(strings.automatedNotice).toContain('{app}')
    }
  })

  test('the built-ins cannot be changed by a caller', () => {
    expect(Object.isFrozen(NOTIFICATION_FRAME_STRINGS.de)).toBe(true)
    const copy = notificationFrameStrings('de')
    copy.unsubscribe = 'x'
    expect(NOTIFICATION_FRAME_STRINGS.de.unsubscribe).toBe('Abmelden')
  })

  test('<html lang> is the reader\'s tag, or en when there is none', () => {
    expect(notificationLanguageTag('de-AT')).toBe('de-AT')
    expect(notificationLanguageTag('pt_BR')).toBe('pt-BR')
    expect(notificationLanguageTag('')).toBe('en')
    expect(notificationLanguageTag('"><script>')).toBe('en')
  })
})

describe('the SMS opt-out line', () => {
  test('is German for a German reader, and unchanged without a locale', () => {
    expect(notificationSmsBody({ body: 'Pool closed Friday.' }, 'marketing')).toBe('Pool closed Friday.\n\nReply STOP to opt out.')
    expect(notificationSmsBody({ body: 'Pool closed Friday.', locale: 'en' }, 'marketing')).toBe('Pool closed Friday.\n\nReply STOP to opt out.')
    expect(notificationSmsBody({ body: 'Pool am Freitag zu.', locale: 'de' }, 'marketing')).toBe('Pool am Freitag zu.\n\nAntworte STOP zum Abbestellen.')
  })

  test('an explicit line or false still wins, and transactional texts get none', () => {
    expect(notificationSmsBody({ body: 'Sale', locale: 'de', smsOptOut: 'STOP = Ende' }, 'marketing')).toBe('Sale\n\nSTOP = Ende')
    expect(notificationSmsBody({ body: 'Sale', locale: 'de', smsOptOut: false }, 'marketing')).toBe('Sale')
    expect(notificationSmsBody({ body: 'Dein Code ist 123', locale: 'de' }, 'transactional')).toBe('Dein Code ist 123')
  })
})
