import { expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

for (const directory of ['resources/functions', 'storage/framework/defaults/resources/functions']) {
  test(`${directory} imports on the server without template globals`, () => {
    const counter = resolve(directory, 'counter.ts'), dark = resolve(directory, 'dark.ts')
    const script = `
      if (typeof globalThis.state !== 'undefined' || typeof globalThis.useDark !== 'undefined')
        throw new Error('The fixture must not supply template globals')
      const counter = await import(${JSON.stringify(counter)})
      const initial = counter.count()
      counter.increment()
      if (counter.count() !== initial + 1) throw new Error('Counter did not increment')
      const dark = await import(${JSON.stringify(dark)})
      const before = dark.isDark()
      dark.toggleDark()
      if (dark.isDark() !== !before) throw new Error('Dark mode did not toggle')
      if (typeof dark.preferredDark() !== 'boolean') throw new Error('Missing system preference')
    `
    const result = Bun.spawnSync([process.execPath, '--no-env-file', '-e', script], {
      cwd: tmpdir(), stdout: 'pipe', stderr: 'pipe',
    })
    expect(result.stderr.toString()).toBe('')
    expect(result.exitCode).toBe(0)
  })
}

for (const directory of ['resources/functions', 'storage/framework/defaults/resources/functions']) {
  test(`${directory} updates browser template effects through imported functions`, async () => {
    const { Window } = await import('very-happy-dom')
    const { generateSignalsRuntimeDev } = await import('@stacksjs/stx/signals')
    const { bundleClientScript } = await import('@stacksjs/stx/client-script-bundler')
    const { stripStxRuntimeImports } = await import('@stacksjs/stx/signal-processing')
    const { buildRuntimeGlobalsDestructure } = await import('@stacksjs/stx/runtime-globals')
    const win = new Window({ url: 'http://localhost/' })
    const globals = ['window', 'document', 'Node', 'CustomEvent', 'MutationObserver', 'navigator', 'location', 'requestAnimationFrame'] as const
    const previous = globals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
    try {
      for (const name of globals)
        Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? win : win[name] })
      new Function(generateSignalsRuntimeDev())()
      const counter = resolve(directory, 'counter.ts'), dark = resolve(directory, 'dark.ts')
      const entry = `import { count, increment } from ${JSON.stringify(counter)};\nimport { isDark, toggleDark } from ${JSON.stringify(dark)};\nexport { count, increment, isDark, toggleDark }`
      const bundle = await bundleClientScript(entry, resolve(directory, 'scaffold-test.stx'), {
        projectRoot: process.cwd(), externalizeUserModules: false,
      })
      const scope = new Function(`${buildRuntimeGlobalsDestructure('const', [], bundle)}\n${stripStxRuntimeImports(bundle)}\nreturn { count, increment, isDark, toggleDark }`)()
      const output = win.document.createElement('output')
      win.document.body.append(output)
      const runtime = (win as unknown as { stx: { effect: (fn: () => void) => () => void } }).stx
      const stop = runtime.effect(() => { output.textContent = `${scope.count()}:${scope.isDark()}` })
      try {
        expect(output.textContent).toBe('0:false')
        scope.increment()
        expect(output.textContent).toBe('1:false')
        scope.toggleDark()
        expect(output.textContent).toBe('1:true')
      }
      finally { stop() }
    }
    finally {
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else Reflect.deleteProperty(globalThis, name)
      }
      await win.happyDOM.abort()
    }
  })
}
