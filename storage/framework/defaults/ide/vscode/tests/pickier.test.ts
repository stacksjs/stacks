/**
 * Pickier support (src/pickier.ts), driven through a fake `vscode` API and a
 * fake worker process: no editor, no Bun, no pickier.
 */
import type { PickierProcess } from '../src/pickier'
import type { PickierRequest, PickierResult } from '../src/pickier-protocol'
import { describe, expect, it } from 'bun:test'
import { chooseBun, createPickierSupport, disableNextLineComment, isLintedFile, isPickierConfigPath } from '../src/pickier'
import { CodeActionKind, document, fakeVscode, flush } from './fake-vscode'

const ROOT = '/work/app'

interface Worker {
  answer?: (request: PickierRequest) => PickierResult
  ready?: false
  fixText?: boolean
  exitOnStart?: boolean
}

function setup(options: { worker?: Worker, files?: string[], settings?: Record<string, unknown>, documents?: ReturnType<typeof document>[] } = {}) {
  const files = new Set(options.files ?? [`${ROOT}/buddy`])
  const fake = fakeVscode({ folders: [ROOT], settings: options.settings, documents: options.documents })
  const spawned: Array<{ bun: string, script: string, cwd: string, requests: PickierRequest[] }> = []

  const host = {
    exists: (path: string) => files.has(path),
    spawnBun(bun: string, script: string, cwd: string): PickierProcess {
      const record = { bun, script, cwd, requests: [] as PickierRequest[] }
      spawned.push(record)
      const lineListeners: Array<(line: string) => void> = []
      const exitListeners: Array<() => void> = []
      const emit = (message: unknown) => queueMicrotask(() => lineListeners.forEach(listener => listener(JSON.stringify(message))))
      const worker = options.worker ?? {}

      queueMicrotask(() => {
        if (worker.exitOnStart)
          return exitListeners.forEach(listener => listener())
        if (worker.ready === false)
          return emit({ ready: false, error: 'Cannot find package \'pickier\'', missing: true })
        emit({ ready: true, version: '0.1.66', fixText: worker.fixText ?? true })
      })

      return {
        write(line) {
          const request = JSON.parse(line) as PickierRequest
          record.requests.push(request)
          const result = worker.answer?.(request) ?? (request.op === 'lint' ? { op: 'lint', issues: [] } : { op: request.op, text: null })
          emit({ id: request.id, ok: true, result })
        },
        onLine: listener => lineListeners.push(listener),
        onExit: listener => exitListeners.push(listener),
        kill: () => {},
      }
    },
  }

  const support = createPickierSupport(fake.api as any, host, { workerPath: '/ext/dist/pickier-worker.js', lintDelayMs: 1 })
  support.activate(fake.context)
  return { ...fake, spawned, support }
}

describe('helpers', () => {
  it('runs pickier on the configured Bun, else the project\'s pinned Bun, else bun on the PATH', () => {
    expect(chooseBun(' /opt/bun ', ROOT, () => true)).toBe('/opt/bun')
    expect(chooseBun('', ROOT, path => path === `${ROOT}/pantry/.bin/bun`)).toBe(`${ROOT}/pantry/.bin/bun`)
    expect(chooseBun('', ROOT, () => false)).toBe('bun')
  })

  it('lints exactly the files `buddy lint` does', () => {
    expect(isLintedFile(ROOT, `${ROOT}/app/Actions/Hello.ts`)).toBeTrue()
    expect(isLintedFile(ROOT, `${ROOT}/README.md`)).toBeTrue()
    expect(isLintedFile(ROOT, `${ROOT}/node_modules/x/index.ts`)).toBeFalse()
    expect(isLintedFile(ROOT, `${ROOT}/dist/index.js`)).toBeFalse()
    expect(isLintedFile(ROOT, `${ROOT}/resources/views/index.stx`)).toBeFalse()
    expect(isLintedFile(ROOT, '/elsewhere/a.ts')).toBeFalse()
  })

  it('recognises the files pickier reads its config from', () => {
    expect(isPickierConfigPath(`${ROOT}/config/code-style.ts`)).toBeTrue()
    expect(isPickierConfigPath(`${ROOT}/pickier.config.ts`)).toBeTrue()
    expect(isPickierConfigPath(`${ROOT}/.config/pickier.ts`)).toBeTrue()
    expect(isPickierConfigPath(`${ROOT}/config/app.ts`)).toBeFalse()
  })

  it('disables a rule for the next line at that line\'s indentation', () => {
    expect(disableNextLineComment('    let x = 1', 'prefer-const', '//')).toBe('    // pickier-disable-next-line prefer-const\n')
  })
})

describe('diagnostics', () => {
  it('reports the project pickier\'s issues on an open file, in editor coordinates', async () => {
    const file = document(`${ROOT}/app/x.ts`, 'import { a } from \'b\'\nlet x = 1\n')
    const { diagnostics, spawned } = setup({
      documents: [file],
      worker: {
        answer: () => ({ op: 'lint', issues: [{ line: 2, column: 5, ruleId: 'prefer-const', message: '\'x\' is never reassigned', severity: 'error', help: 'Use const' }] }),
      },
    })
    await flush()

    expect(spawned).toHaveLength(1)
    expect(spawned[0]).toMatchObject({ bun: 'bun', script: '/ext/dist/pickier-worker.js', cwd: ROOT })
    expect(spawned[0]!.requests[0]).toMatchObject({ op: 'lint', file: `${ROOT}/app/x.ts` })

    const [diagnostic] = diagnostics.get(`file://${ROOT}/app/x.ts`)!
    expect(diagnostic.source).toBe('pickier')
    expect(diagnostic.code).toBe('prefer-const')
    expect(diagnostic.severity).toBe(0)
    expect(diagnostic.range.start).toMatchObject({ line: 1, character: 4 })
    expect(diagnostic.range.end).toMatchObject({ line: 1, character: 5 })
    expect(diagnostic.message).toBe('\'x\' is never reassigned\nUse const')
  })

  it('leaves folders that are not Stacks projects alone', async () => {
    const { spawned } = setup({ files: [], documents: [document(`${ROOT}/x.ts`, 'let x = 1\n')] })
    await flush()
    expect(spawned).toHaveLength(0)
  })

  it('lints nothing when turned off', async () => {
    const { spawned } = setup({ settings: { 'pickier.enable': false }, documents: [document(`${ROOT}/x.ts`, 'let x = 1\n')] })
    await flush()
    expect(spawned).toHaveLength(0)
  })

  it('stops asking a project with no pickier, and says why once', async () => {
    const { spawned, events, output, diagnostics } = setup({ worker: { ready: false }, documents: [document(`${ROOT}/a.ts`, '')] })
    await flush()
    events.opened.fire(document(`${ROOT}/b.ts`, '') as any)
    await flush()

    expect(spawned).toHaveLength(1)
    expect(diagnostics.size).toBe(0)
    expect(output.filter(line => line.includes('not available'))).toHaveLength(1)
  })

  it('gives up on a worker that keeps exiting instead of respawning it on every keystroke', async () => {
    const { spawned, events } = setup({ worker: { exitOnStart: true } })
    for (let i = 0; i < 5; i++) {
      events.opened.fire(document(`${ROOT}/x${i}.ts`, '') as any)
      await flush()
    }
    expect(spawned).toHaveLength(3)
  })
})

describe('fixing and formatting', () => {
  const FIXED = 'const x = 1\n'

  it('offers source.fixAll.pickier, the code action codeActionsOnSave asks for', async () => {
    const file = document(`${ROOT}/x.ts`, 'let x = 1\n')
    const { codeActionProviders, spawned } = setup({ worker: { answer: request => request.op === 'fix' ? { op: 'fix', text: FIXED } : { op: 'lint', issues: [] } } })

    const only = CodeActionKind.SourceFixAll.append('pickier')
    const [action] = await codeActionProviders[0].provideCodeActions(file, undefined, { only, diagnostics: [] })

    expect(action.kind.value).toBe('source.fixAll.pickier')
    expect(action.edit.edits[0].text).toBe(FIXED)
    expect(spawned[0]!.requests.at(-1)!.op).toBe('fix')

    // The generic `source.fixAll` includes it too.
    const generic = await codeActionProviders[0].provideCodeActions(file, undefined, { only: CodeActionKind.SourceFixAll, diagnostics: [] })
    expect(generic).toHaveLength(1)
  })

  it('offers nothing when there is nothing to fix, or the project\'s pickier cannot fix text', async () => {
    const file = document(`${ROOT}/x.ts`, FIXED)
    const unchanged = setup({ worker: { answer: request => ({ op: request.op as 'fix', text: FIXED }) } })
    expect(await unchanged.codeActionProviders[0].provideCodeActions(file, undefined, { only: CodeActionKind.SourceFixAll, diagnostics: [] })).toEqual([])

    const old = setup({ worker: { fixText: false } })
    expect(await old.codeActionProviders[0].provideCodeActions(document(`${ROOT}/x.ts`, 'let x = 1\n'), undefined, { only: CodeActionKind.SourceFixAll, diagnostics: [] })).toEqual([])
  })

  it('offers quick fixes for its own diagnostics: fix all, and disable the rule for the line', async () => {
    const file = document(`${ROOT}/x.ts`, 'function f() {\n  let x = 1\n}\n')
    const { codeActionProviders } = setup({ worker: { answer: request => request.op === 'fix' ? { op: 'fix', text: 'function f() {\n  const x = 1\n}\n' } : { op: 'lint', issues: [] } } })
    const diagnostic = { source: 'pickier', code: 'prefer-const', range: { start: { line: 1, character: 6 } } }

    const actions = await codeActionProviders[0].provideCodeActions(file, undefined, { diagnostics: [diagnostic, { source: 'ts', code: 1 }] })

    expect(actions.map((action: any) => action.title)).toEqual(['Fix all pickier problems', 'Disable prefer-const for this line'])
    expect(actions[1].edit.edits[0]).toMatchObject({ position: { line: 1, character: 0 }, text: '  // pickier-disable-next-line prefer-const\n' })
  })

  it('formats with the project\'s pickier', async () => {
    const file = document(`${ROOT}/x.ts`, 'const a = "x"\n')
    const { formatters } = setup({ worker: { answer: request => request.op === 'format' ? { op: 'format', text: 'const a = \'x\'\n' } : { op: 'lint', issues: [] } } })

    const [edit] = await formatters[0].provideDocumentFormattingEdits(file)
    expect(edit.newText).toBe('const a = \'x\'\n')
  })

  it('applies the fixes to the active file from the command palette', async () => {
    const file = document(`${ROOT}/x.ts`, 'let x = 1\n')
    const fake = setup({ worker: { answer: request => request.op === 'fix' ? { op: 'fix', text: FIXED } : { op: 'lint', issues: [] } } })
    fake.api.window.activeTextEditor = { document: file }

    await fake.handlers.get('stacks.pickier.fixAll')!()
    expect(fake.applied[0]!.edits[0]!.text).toBe(FIXED)
  })
})
