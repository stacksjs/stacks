import { expect, test } from 'bun:test'
import { copyFile, cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { projectPath } from '@stacksjs/path'
import { processDirectives } from '@stacksjs/stx/process'
import { click, launch, navigate } from '@stacksjs/testing/browser'
import { buildStxComponentLibrary } from '../src/build/component-library'
import { buildLibraryPackages } from '../src/library/build'

function run(command: string[], cwd: string): string {
  const result = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr)
  expect(result.exitCode, output).toBe(0)
  return output
}

// Ordinary SSR, installed declarations and installed browser output are separate
// public seams: each catches failures that the other two cannot observe.
const sampleCases = [
  ['ContextMenu', 'id="menu"', ['id="menu"'], 'id="other-menu"', ['id="other-menu"']],
  ['ContextMenuItem', 'label="Open"', ['<button', 'Open'], 'label="More" icon="!" :hasSubmenu="true"', ['has-submenu', 'More', '!']],
  ['DesktopIcon', 'id="icon" label="File"', ['📄', 'data-icon-type="window"', 'left: 20px; top: 20px;'], 'id="other-icon" label="Site" icon="!" type="link" left="30px" top="40px"', ['data-icon-type="link"', 'left: 30px; top: 40px;', 'Site']],
  ['FeatureButton', 'label="Feature"', ['Feature', 'class="feature-btn "'], 'label="Selected" :active="true"', ['class="feature-btn active"', 'Selected']],
  ['InputGroup', 'id="email" label="Email"', ['<label>Email:</label>', 'type="text"', 'class="login-input"'], 'id="password" label="Password" type="password" class="custom-input"', ['<label>Password:</label>', 'type="password"', 'class="custom-input"']],
  ['LoginForm', 'id="login"', ['👤', '<h2>Login</h2>', 'Enter your credentials', 'class="login-submit-btn"'], 'id="other-login" title="Sign in" prompt="Welcome" icon="!" submitHandler="submit()"', ['<h2>Sign in</h2>', 'Welcome', 'class="login-submit-btn"']],
  ['LoginScreen', '', ['id="login-screen"', 'STACKS', 'To begin, click your user name'], 'id="other-screen" logoText="ACME" subtitle="Welcome"', ['id="other-screen"', 'ACME', 'Welcome']],
  ['NotificationPopup', '', ['id="notification-popup"', 'Notifications', 'id="notification-signup"'], 'id="other-popup" title="Updates" :showSignup="false"', ['id="other-popup"', 'Updates']],
  ['PackageItem', 'emoji="!" title="Tools" description="Useful tools"', ['!', 'Tools', 'Useful tools'], 'emoji="?" title="More" description="Other tools"', ['?', 'More', 'Other tools']],
  ['StartMenu', '', ['id="start-menu"', 'Developer', '👤'], 'id="other-start" userName="Chris" userImage="!"', ['id="other-start"', 'Chris', '!']],
  ['StartMenuItem', 'label="File"', ['📄', 'File'], 'label="Selected" icon="!" :highlighted="true"', ['start-menu-item highlighted', 'Selected', '!']],
  ['Taskbar', '', ['class="start-button"'], ':showStartMenu="false"', ['class="taskbar"']],
  ['Window', 'id="main" title="Main"', ['id="window-main"', '📄', 'left: 100px; top: 80px; width: 600px; height: 500px;'], 'id="other" title="Other" icon="!" left="10px" top="20px" width="300px" height="200px"', ['id="window-other"', 'Other', 'left: 10px; top: 20px; width: 300px; height: 200px;']],
] as const

for (const [name, defaults, expectedDefaults, overrides, expectedOverrides] of sampleCases) {
  test(`${name} preserves public defaults and overrides in ordinary STX SSR`, async () => {
    for (const [attributes, expected] of [[defaults, expectedDefaults], [overrides, expectedOverrides]] as const) {
      const html = await processDirectives(`<${name} ${attributes} />`, {}, projectPath('resources/views/sample-component-consumer.stx'), {
        componentsDir: projectPath('resources/components'), root: projectPath(), cache: false,
      }, new Set())
      for (const value of expected) expect(html).toContain(value)
      if (name === 'NotificationPopup' && attributes === overrides) expect(html).not.toContain('id="notification-signup"')
      if (name === 'Taskbar' && attributes === overrides) expect(html).not.toContain('class="start-button"')
    }
  })
}

test('the public InputGroup preserves supplied props and defaults in ordinary STX SSR', async () => {
  const html = await processDirectives(
    '<InputGroup id="email" label="Email" /><InputGroup id="password" label="Password" type="password" placeholder="Your password" class="custom-input" />',
    {},
    projectPath('resources/views/sample-component-consumer.stx'),
    { componentsDir: projectPath('resources/components'), root: projectPath(), cache: false },
    new Set(),
  )
  const labels = [...html.matchAll(/<label>[^<]*<\/label>/g)].map(match => match[0])
  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map(match => match[0])
  expect(labels).toEqual(['<label>Email:</label>', '<label>Password:</label>'])
  expect(inputs).toHaveLength(2)
  expect(inputs[0]).toContain('type="text"')
  expect(inputs[0]).toContain('class="login-input"')
  expect(inputs[0]).toContain('placeholder=""')
  expect(inputs[1]).toContain('type="password"')
  expect(inputs[1]).toContain('class="custom-input"')
  expect(inputs[1]).toContain('placeholder="Your password"')
})

test('the public sample preserves slots in ordinary STX SSR', async () => {
  const html = await processDirectives('<LoginForm id="login"><span>Form content</span></LoginForm><Window id="main" title="Main"><span>Window content</span></Window>', {}, projectPath('resources/views/sample-component-consumer.stx'), {
    componentsDir: projectPath('resources/components'), root: projectPath(), cache: false,
  }, new Set())
  expect(html).toMatch(/<span\b[^>]*>Form content<\/span>/)
  expect(html).toMatch(/<span\b[^>]*>Window content<\/span>/)
})

test('the public STX sample builds, packs, installs and exposes valid DOM types', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-component-sample-'))
  try {
    const built = await buildStxComponentLibrary()
    expect(built?.components.length).toBeGreaterThan(0)
    if (!built) throw new Error('The STX sample did not build')
    const group = built.components.find(component => component.name === 'InputGroup')
    const icon = built.components.find(component => component.name === 'DesktopIcon')
    expect(group).toBeDefined()
    expect(icon).toBeDefined()
    for (const [name] of sampleCases) expect(built.components.some(component => component.name === name), name).toBe(true)

    const manifestPath = projectPath('storage/framework/libs/components/stx/package.json')
    const manifest = await Bun.file(manifestPath).json() as { name: string }
    // Exercise the release's real normalization without rewriting the source
    // manifest. The component modules remain the native builder's output.
    const candidate = join(root, 'candidate')
    const candidateManifest = join(candidate, 'package.json')
    await mkdir(candidate)
    await copyFile(manifestPath, candidateManifest)
    await copyFile(projectPath('storage/framework/libs/components/stx/README.md'), join(candidate, 'README.md'))
    await cp(projectPath('storage/framework/libs/components/stx/dist'), join(candidate, 'dist'), { recursive: true })
    run(['node', projectPath('storage/framework/scripts/normalize-workspace-deps-for-publish'), candidateManifest, projectPath('storage/framework')], projectPath())
    const archive = join(root, 'sample.tgz')
    run([process.execPath, projectPath('storage/framework/scripts/validate-publish-exports.ts'), candidateManifest, archive], projectPath())
    const members = run(['tar', '-tzf', archive], root).split('\n')
    expect(members).toContain('package/dist/index.js')
    expect(members).toContain('package/dist/index.d.ts')
    expect(members).toContain(`package/dist/${group!.tag}.js`)

    await Bun.write(join(root, 'package.json'), JSON.stringify({
      name: 'stacks-sample-consumer', private: true, type: 'module',
      dependencies: { [manifest.name]: `file:${archive.replaceAll('\\', '/')}` },
    }))
    run([process.execPath, 'install'], root)
    await Bun.write(join(root, 'import.ts'), `import { InputGroup, DesktopIcon, StartMenuItem } from ${JSON.stringify(manifest.name)}
if (![InputGroup, DesktopIcon, StartMenuItem].every(value => typeof value === 'function')) throw new Error('Missing public sample components')
`)
    run([process.execPath, 'run', 'import.ts'], root)

    await Bun.write(join(root, 'consumer.ts'), `import type { InputGroup, DesktopIcon, DesktopIconProps } from ${JSON.stringify(manifest.name)}
import type * as Sample from ${JSON.stringify(manifest.name)}
${sampleCases.map(([name]) => {
  const tag = built.components.find(component => component.name === name)!.tag
  return `const native${name}: Sample.${name} = document.createElement(${JSON.stringify(tag)})\nnative${name}.classList.add('sample')\nnative${name}.style.setProperty('color', 'blue')\nnative${name}.onclick = event => event.preventDefault()`
}).join('\n')}
nativeLoginForm.addEventListener('submit', event => {
  const detail: { id: string, submitHandler: string } = event.detail
  console.log(detail)
})
nativeWindow.addEventListener('minimize', event => {
  const id: string = event.detail.id
  console.log(id)
})
nativeLoginScreen.addEventListener('close', event => {
  const id: string = event.detail.id
  console.log(id)
})
const field: InputGroup = document.createElement(${JSON.stringify(group!.tag)})
field.label = field.label.toUpperCase()
field.classList.add('sample-field')
const icon: DesktopIcon = document.createElement(${JSON.stringify(icon!.tag)})
const style: CSSStyleDeclaration = icon.style
style.setProperty('color', 'blue')
icon.onclick = event => event.preventDefault()
export const attributes: DesktopIconProps = { id: 'sample-icon', label: 'Library', style: 'color: blue' }
`)
    const config = join(root, 'tsconfig.json')
    await Bun.write(config, JSON.stringify({ compilerOptions: {
      target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ESNext', 'DOM'],
      types: [], strict: true, skipLibCheck: false, noEmit: true,
    }, files: ['consumer.ts'] }))
    run([process.execPath, '--bun', 'tsc', '-p', config, '--pretty', 'false'], projectPath())

    if (process.env.STACKS_BROWSER_TESTS === '1') {
      const dist = join(root, 'node_modules', manifest.name, 'dist')
      const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
        const path = new URL(request.url).pathname
        if (path === '/') return new Response(`<!doctype html><link rel="icon" href="data:,"><${group!.tag} id="email" label="Email"></${group!.tag}><script type="module" src="/dist/index.js"></script>`, { headers: { 'Content-Type': 'text/html' } })
        if (path.startsWith('/dist/') && !path.includes('..')) return new Response(Bun.file(join(dist, path.slice(6))))
        return new Response('Missing', { status: 404 })
      } })
      let browser: Awaited<ReturnType<typeof launch>> | undefined
      try {
        browser = await launch()
        const { cdp } = browser
        await navigate(cdp, `http://127.0.0.1:${server.port}/`)
        expect(await cdp.evaluate(`(() => {
          const tags = ${JSON.stringify(sampleCases.map(([name]) => built.components.find(component => component.name === name)!.tag))}
          return tags.map(tag => {
            const element = document.createElement(tag)
            element.classList.add('native-check')
            element.style.setProperty('color', 'blue')
            element.onclick = event => event.preventDefault()
            const Component = customElements.get(tag)
            return typeof Component === 'function' && element instanceof Component && element instanceof HTMLElement && element.classList instanceof DOMTokenList && element.style instanceof CSSStyleDeclaration && typeof element.onclick === 'function'
          })
        })()`)).toEqual(sampleCases.map(() => true))
        expect(await cdp.evaluate(`document.querySelector(${JSON.stringify(group!.tag)}).querySelector('label').textContent`)).toBe('Email:')
        expect(await cdp.evaluate(`document.querySelector(${JSON.stringify(group!.tag)}).querySelector('input').outerHTML`)).toContain('class="login-input"')
        expect(await cdp.evaluate(`(async () => {
          const field = document.querySelector(${JSON.stringify(group!.tag)})
          field.label = 'Updated'
          field.type = 'password'
          field.placeholder = 'Your password'
          field.classList.add('custom-input')
          await field.updateComplete
          const input = field.querySelector('input')
          return { label: field.querySelector('label').textContent, type: input.type, placeholder: input.placeholder, className: input.className, nativeClassList: field.classList instanceof DOMTokenList }
        })()`)).toEqual({ label: 'Updated:', type: 'password', placeholder: 'Your password', className: 'custom-input', nativeClassList: true })
        const untrustedId = `quoted'\"<img src=x onerror=globalThis.sampleExecuted=true>`
        const inertHandler = 'globalThis.sampleExecuted = true'
        const eventComponents = ['LoginForm', 'Window', 'LoginScreen'].map(name => ({ name, tag: built.components.find(component => component.name === name)!.tag }))
        await cdp.evaluate(`(() => {
          globalThis.sampleEvents = []
          globalThis.sampleExecuted = false
          for (const { name, tag } of ${JSON.stringify(eventComponents)}) {
            const element = document.createElement(tag)
            element.id = ${JSON.stringify(untrustedId)}
            element.title = 'Event sample'
            element.submitHandler = ${JSON.stringify(inertHandler)}
            element.dataset.sample = name
            for (const event of ['submit', 'back', 'close', 'minimize', 'maximize']) element.addEventListener(event, value => {
              globalThis.sampleEvents.push({ component: name, event, detail: value.detail })
            })
            document.body.append(element)
          }
        })()`)
        expect(cdp.errors).toEqual([])
        // The sample styles hide these panels; show the fixture containers so
        // native pointer clicks exercise their public controls.
        await cdp.evaluate(`(() => {
          for (const panel of document.querySelectorAll('[data-sample] .hidden')) panel.classList.remove('hidden')
        })()`)
        for (const [name, selector] of [
          ['LoginForm', '.login-submit-btn'], ['LoginForm', '.login-back-button'], ['LoginForm', '.login-close-btn'],
          ['Window', '.minimize'], ['Window', '.maximize'], ['Window', '.close'], ['LoginScreen', '.login-close-btn'],
        ]) await click(cdp, `[data-sample="${name}"] ${selector}`)
        expect(await cdp.evaluate('globalThis.sampleEvents')).toEqual([
          { component: 'LoginForm', event: 'submit', detail: { id: untrustedId, submitHandler: inertHandler } },
          { component: 'LoginForm', event: 'back', detail: { id: untrustedId } },
          { component: 'LoginForm', event: 'close', detail: { id: untrustedId } },
          { component: 'Window', event: 'minimize', detail: { id: untrustedId } },
          { component: 'Window', event: 'maximize', detail: { id: untrustedId } },
          { component: 'Window', event: 'close', detail: { id: untrustedId } },
          { component: 'LoginScreen', event: 'close', detail: { id: untrustedId } },
        ])
        expect(await cdp.evaluate('globalThis.sampleExecuted')).toBe(false)
        expect(await cdp.evaluate(`['handleLogin', 'hideLoginForms', 'closeLoginScreens', 'minimizeWindow', 'toggleMaximizeWindow', 'closeWindow'].every(name => !(name in globalThis))`)).toBe(true)
        expect(cdp.errors).toEqual([])
      }
      finally { try { await browser?.close() } finally { server.stop(true) } }
    }
  }
  finally { await rm(root, { recursive: true, force: true }) }
}, 30_000)

test('a packed web-components package preserves Shadow DOM slots and typed control events under CSP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-slot-events-'))
  const source = projectPath('resources/components/slot-event-fixture')
  const output = projectPath('storage/framework/libs/packages/slot-event-fixture')
  try {
    await mkdir(source, { recursive: true })
    await Bun.write(join(source, 'SlotControl.stx'), `<script component>{"shadowDOM":true}</script>
<script>
import { defineEmits, defineProps } from 'stx'
interface SlotControlProps {
  id: string
  command: string
}
const { id, command } = defineProps<SlotControlProps>()
const emit = defineEmits<{
  activate: [detail: { id: string, command: string }]
  connected: [detail: { id: string }]
  disconnected: [detail: { id: string }]
}>()
function activate() { emit('activate', { id, command }) }
function onConnect() { emit('connected', { id }) }
function onDisconnect() { emit('disconnected', { id }) }
</script>
<template><button @click="activate">Activate</button><slot name="heading" /><slot /></template>`)
    const [report] = await buildLibraryPackages({ config: { packages: [{ name: '@fixture/slot-event-fixture', kind: 'web-components', prefix: 'fixture', version: '1.0.0', include: ['slot-event-fixture/*.stx'] }] } })
    const archive = join(root, 'slots.tgz')
    run([process.execPath, 'pm', 'pack', '--ignore-scripts', '--filename', archive], report!.dir)
    await Bun.write(join(root, 'package.json'), JSON.stringify({ name: 'installed-slot-events', private: true, type: 'module', dependencies: { '@fixture/slot-event-fixture': `file:${archive}` } }))
    run([process.execPath, 'install', '--ignore-scripts'], root)
    await Bun.write(join(root, 'consumer.ts'), `import type { SlotControl } from '@fixture/slot-event-fixture'
const element: SlotControl = document.createElement('fixture-slot-control')
element.classList.add('native')
element.addEventListener('activate', event => {
  const detail: { id: string, command: string } = event.detail
  console.log(detail)
})
`)
    await Bun.write(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ESNext', 'DOM'], types: [], strict: true, skipLibCheck: false, noEmit: true }, files: ['consumer.ts'] }))
    run([process.execPath, '--bun', 'tsc', '-p', join(root, 'tsconfig.json'), '--pretty', 'false'], projectPath())
    if (process.env.STACKS_BROWSER_TESTS !== '1') return
    const id = `quoted'"<img src=x onerror=globalThis.executed=true>`
    const command = 'globalThis.executed = true'
    const installed = join(root, 'node_modules/@fixture/slot-event-fixture/dist')
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
      const path = new URL(request.url).pathname
      const headers = { 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'none'" }
      if (path === '/favicon.ico') return new Response(null, { status: 204, headers })
      if (path === '/') return new Response('<!doctype html><script type="module" src="/consumer.js"></script>', { headers: { ...headers, 'Content-Type': 'text/html' } })
      if (path === '/consumer.js') return new Response(`globalThis.executed = false; globalThis.controlEvents = []; globalThis.violations = [];
document.addEventListener('securitypolicyviolation', event => globalThis.violations.push(event.violatedDirective));
await import('/dist/bundle.js');
const element = document.createElement('fixture-slot-control'); element.id = ${JSON.stringify(id)}; element.command = ${JSON.stringify(command)};
for (const name of ['activate', 'connected', 'disconnected']) element.addEventListener(name, event => globalThis.controlEvents.push({ name, detail: event.detail, composed: event.composed }));
const heading = document.createElement('span'); heading.slot = 'heading'; heading.textContent = 'Named child';
const content = document.createElement('span'); content.textContent = 'Default child'; element.append(heading, content); document.body.append(element);
globalThis.control = element;`, { headers: { ...headers, 'Content-Type': 'text/javascript' } })
      if (path.startsWith('/dist/') && !path.includes('..')) return new Response(Bun.file(join(installed, path.slice(6))), { headers })
      return new Response('Missing', { status: 404, headers })
    } })
    let browser: Awaited<ReturnType<typeof launch>> | undefined
    try {
      browser = await launch()
      const { cdp } = browser
      await navigate(cdp, `http://127.0.0.1:${server.port}/`)
      expect(cdp.errors).toEqual([])
      expect(await cdp.evaluate(`[...control.shadowRoot.querySelectorAll('slot')].map(slot => slot.assignedElements().map(child => child.textContent))`)).toEqual([['Named child'], ['Default child']])
      const point = await cdp.evaluate<{ x: number, y: number }>(`(() => { const rect = control.shadowRoot.querySelector('button').getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } })()`)
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
      await cdp.evaluate('control.remove(); document.body.append(control)')
      expect(await cdp.evaluate('globalThis.controlEvents')).toEqual([
        { name: 'connected', detail: { id }, composed: true },
        { name: 'activate', detail: { id, command }, composed: true },
        { name: 'disconnected', detail: { id }, composed: true },
        { name: 'connected', detail: { id }, composed: true },
      ])
      expect(await cdp.evaluate('globalThis.executed')).toBe(false)
      expect(await cdp.evaluate('globalThis.violations')).toEqual([])
      expect(cdp.errors).toEqual([])
    }
    finally { try { await browser?.close() } finally { server.stop(true) } }
  }
  finally { await Promise.all([root, source, output].map(path => rm(path, { recursive: true, force: true }))) }
}, 30_000)
