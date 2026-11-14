import { expect, test } from 'bun:test'
import { effect, state } from '@stacksjs/stx'
import { createI18n } from '../src/client'
import { useI18n } from '../src/stx'

const messages = { en: { title: 'Verified', items: 'none | one | {count} items' }, de: { title: 'Bestätigt', items: 'keine | eins | {count} Einträge' } }

test('the client entry bundles for a browser without filesystem or application config', async () => {
  const build = await Bun.build({ entrypoints: [new URL('../src/client.ts', import.meta.url).pathname], target: 'browser', write: false })
  expect(build.success).toBe(true)
  expect(build.logs).toEqual([])
})

test('native STX translations update in place while unrelated form and verification state survives', async () => {
  const i18n = useI18n({ locale: 'en', messages })
  const verified = state(true)
  const draft = state('an unsent message')
  const labels: string[] = []
  const stop = effect(() => { labels.push(`${i18n.t('title')}/${i18n.tc('items', 2)}/${i18n.n(1234.5)}`) })
  try {
    i18n.setLocale('de')
    await Bun.sleep(0)
    expect(labels.at(-1)).toBe('Bestätigt/2 Einträge/1.234,5')
    expect(verified()).toBe(true)
    expect(draft()).toBe('an unsent message')
    i18n.addTranslations('de', { title: 'Weiterhin bestätigt' })
    await Bun.sleep(0)
    expect(labels.at(-1)).toStartWith('Weiterhin bestätigt/')
    i18n.locale = 'en'
    await Bun.sleep(0)
    expect(labels.at(-1)).toStartWith('Verified/')
    const count = labels.length
    i18n.setLocale('en')
    await Bun.sleep(0)
    expect(labels).toHaveLength(count)
  }
  finally { stop() }
})

test('instance subscriptions are removable and never change another request instance', () => {
  const first = createI18n({ locale: 'en', messages })
  const second = createI18n({ locale: 'en', messages })
  const changes: string[] = []
  const stop = first.subscribe(() => changes.push(first.locale))
  first.setLocale('de')
  stop()
  first.setLocale('en')
  expect(changes).toEqual(['de'])
  expect(second.locale).toBe('en')
  expect(second.t('title')).toBe('Verified')
})

test('plural lookup follows the same language fallback and missing-key handler as text', () => {
  const i18n = createI18n({ locale: 'de-DE', fallbackLocale: 'en', messages, warnMissing: false, missingHandler: (_locale, key) => `missing:${key}` })
  expect(i18n.tc('items', 2)).toBe('2 Einträge')
  expect(i18n.tc('absent', 2)).toBe('missing:absent')
})
