import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { typecheckStxFiles } from '@stacksjs/stx/typecheck'

test('the starter head checks optional page metadata through its actual inherited context', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-head-types-'))
  const partialsDir = join(root, 'partials')
  const layoutsDir = join(root, 'layouts')
  const head = join(partialsDir, 'head.stx')
  const layout = join(layoutsDir, 'default.stx')
  const good = join(root, 'good.stx')
  const missing = join(root, 'missing.stx')
  const bad = join(root, 'bad.stx')
  const typo = join(partialsDir, 'typo.stx')
  const client = join(partialsDir, 'client.stx')
  const source = await readFile(join(import.meta.dir, '../../../defaults/scaffold/resources/partials/head.stx'), 'utf8')

  try {
    await Bun.write(head, source)
    await Bun.write(layout, "@include('head')\n@yield('content')")
    await Bun.write(good, `<script server>
const pageTitle = 'Example'
const pageDescription = 'About this page'
const canonicalPath = '/example'
</script>
@extends('default')`)
    await Bun.write(missing, "@extends('default')")
    await Bun.write(bad, `<script server>
const pageTitle = 42
</script>
@extends('default')`)
    await Bun.write(typo, source.replace('typeof pageTitle', 'typeof pageTtile'))
    await Bun.write(client, `${source}\n<script client>console.log(pageTitle)</script>`)

    const result = await typecheckStxFiles([head, layout, good, missing, bad, typo, client], { partialsDir, layoutsDir })
    expect(result.failure).toBeUndefined()
    const errors = result.diagnostics.filter(diagnostic => diagnostic.category === 'error')
    expect(errors.filter(diagnostic => [head, layout, good, missing].includes(diagnostic.file))).toEqual([])
    expect(errors.some(diagnostic => diagnostic.file === bad && diagnostic.message.includes('pageTitle'))).toBe(true)
    expect(errors.some(diagnostic => diagnostic.file === typo && diagnostic.message.includes('pageTtile'))).toBe(true)
    expect(errors.some(diagnostic => diagnostic.file === client && diagnostic.blockKind === 'client' && diagnostic.message.includes('pageTitle'))).toBe(true)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 120_000)
