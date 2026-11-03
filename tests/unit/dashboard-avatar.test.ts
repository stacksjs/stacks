import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { compileNativeBundle } from '@stacksjs/stx/native'
import { processDirectives } from '@stacksjs/stx/process'
import { defaultConfig } from '@stacksjs/stx/config'
import { mountNativeScreen, waitFor } from '@stacksjs/stx/native/testing'
import { click, findChrome, launch, navigate, settle } from '@stacksjs/testing/browser'

const componentDirectory = resolve(import.meta.dir, '../../storage/framework/defaults/resources/components/Dashboard/UI')
const profileFixture = `<script client>
const photo = state('https://fixture.invalid/ada.png')
const label = state('Ada profile')
const person = state('Ada Lovelace')
const letters = state('AL')
function nextAccount() {
  photo.set('https://fixture.invalid/grace.png')
  label.set('Grace profile')
  person.set('Grace Hopper')
  letters.set('GH')
}
function withoutPhoto() {
  photo.set('')
  person.set('Katherine Johnson')
  letters.set('')
}
</script>
<div>
  <Avatar :src="photo" :alt="label" :name="person" :initials="letters" />
  <button id="next" testID="next" @click="nextAccount()">Next account</button>
  <button id="clear" testID="clear" @click="withoutPhoto()">Without a photo</button>
  <button id="initials" testID="initials" @click="letters.set('CJ')">Explicit initials</button>
</div>`

for (const minify of [false, true]) {
  describe(`the framework dashboard Avatar (minify=${minify})`, () => {
    test.each(['ios', 'android'] as const)('follows profile identity on %s', async (platform) => {
      const root = await mkdtemp(join(tmpdir(), 'stacks-dashboard-avatar-'))
      let phone: ReturnType<typeof mountNativeScreen> | undefined
      try {
        await Promise.all(['partials', 'layouts'].map(directory => mkdir(join(root, directory))))
        await writeFile(join(root, 'stx.config.ts'), `export default { root: '.', componentsDir: ${JSON.stringify(componentDirectory)} }`)
        await writeFile(join(root, 'Screen.stx'), profileFixture)
        const compiled = await compileNativeBundle({ root, screens: { Screen: 'Screen.stx' }, minify })
        phone = mountNativeScreen(compiled.code, 'Screen', { platform })
        const image = () => phone!.all().find(node => node.type === 'Image')
        await phone.settle()
        expect(image()?.props).toMatchObject({ source: 'https://fixture.invalid/ada.png' })
        expect(image()?.props.accessibilityLabel).toBe('Ada profile')
        phone.press(phone.byTestID('next')!)
        await waitFor(() => image()?.props.source === 'https://fixture.invalid/grace.png', 'the next account photo')
        expect(image()?.props.accessibilityLabel).toBe('Grace profile')
        phone.press(phone.byTestID('clear')!)
        await waitFor(() => !image() && phone!.texts().includes('KJ'), 'the current account initials')
        expect(phone.texts()).not.toContain('AL')
        expect(phone.texts()).not.toContain('GH')
        phone.press(phone.byTestID('initials')!)
        await waitFor(() => phone!.texts().includes('CJ'), 'explicit live initials')
        expect(phone.texts()).not.toContain('KJ')
      }
      finally {
        phone?.unmount()
        await rm(root, { recursive: true, force: true })
      }
    }, 60_000)
  })
}


test('keeps the server-rendered photo and initials available before hydration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-dashboard-avatar-ssr-'))
  try {
    const html = await processDirectives('<Avatar src="/ada.png" alt="Ada profile" name="Ada Lovelace" /><Avatar name="Katherine Johnson" />', {}, join(root, 'Page.stx'), { ...defaultConfig, root, componentsDir: componentDirectory, cache: false }, new Set())
    expect(/<img[^>]*src="\/ada\.png"/.test(html)).toBe(true)
    expect(/<img[^>]*alt="Ada profile"/.test(html)).toBe(true)
    expect(/<span[^>]*>KJ<\/span>/.test(html)).toBe(true)
  }
  finally { await rm(root, { recursive: true, force: true }) }
})


test.skipIf(!findChrome())('updates the same Avatar in a real browser', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-dashboard-avatar-browser-'))
  let server: ReturnType<typeof Bun.serve> | undefined
  let browser: Awaited<ReturnType<typeof launch>> | undefined
  try {
    const source = `<!doctype html><html><head><title>Avatar fixture</title></head><body>${profileFixture.replaceAll('https://fixture.invalid', '')}</body></html>`
    const html = await processDirectives(source, {}, join(root, 'Page.stx'), { ...defaultConfig, root, componentsDir: componentDirectory, cache: false }, new Set())
    const image = Bun.file(resolve(import.meta.dir, '../../public/assets/images/coming-soon-dawn.svg'))
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
      return new URL(request.url).pathname === '/' ? new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }) : new Response(image, { headers: { 'content-type': 'image/svg+xml' } })
    } })
    browser = await launch()
    const { cdp } = browser
    await navigate(cdp, `http://127.0.0.1:${server.port}/`)
    const photo = () => cdp.evaluate<{ source: string, alt: string } | null>("(() => { const image = document.querySelector('img'); return image ? { source: image.getAttribute('src'), alt: image.alt } : null })()")
    expect(await photo()).toEqual({ source: '/ada.png', alt: 'Ada profile' })
    await click(cdp, '#next')
    await settle(cdp)
    expect(await photo()).toEqual({ source: '/grace.png', alt: 'Grace profile' })
    await click(cdp, '#clear')
    await settle(cdp)
    expect(await photo()).toBeNull()
    expect(await cdp.evaluate("document.body.innerText.includes('KJ')")).toBe(true)
    await click(cdp, '#initials')
    await settle(cdp)
    expect(await cdp.evaluate("document.body.innerText.includes('CJ') && !document.body.innerText.includes('KJ')")).toBe(true)
    expect(cdp.errors).toEqual([])
  }
  finally {
    await browser?.close()
    server?.stop(true)
    await rm(root, { recursive: true, force: true })
  }
}, 60_000)
