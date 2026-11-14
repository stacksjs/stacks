import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runSupportImport } from '../src/support-import'

const config = { supporthq: { url: 'https://hq.support', key: 'server-secret', project: 'project' } }
test('Intercom CLI sends only selected private bundle and reports actual server preview and resumable counts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'support-import-'))
  try {
    const file = join(directory, 'source.json'), output: string[] = []
    await writeFile(file, '{"privateTranscript":"do not print"}')
    let calls = 0
    const deps = { print: (line: string) => output.push(line), fetch: async (input: string, init?: RequestInit) => {
      calls++
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer server-secret')
      expect(init?.redirect).toBe('error')
      if (calls === 1) {
        expect(input.endsWith('/imports/intercom')).toBe(true)
        const form = init?.body as FormData
        expect(form.get('dryRun')).toBe('true')
        expect(await (form.get('file') as File).text()).toContain('privateTranscript')
        return Response.json({ dryRun: true, totalRecords: 2, compatibleRecords: 1, skippedRecords: 0, reviewRecords: 1, reasons: [{ code: 'incomplete_source_history', count: 1, message: 'Do not echo source material' }] })
      }
      expect(input.endsWith('/imports/1/resume')).toBe(true)
      return Response.json({ run: { id: '1', status: 'ready', totalRecords: 2, processed: 1, imported: 1, skipped: 0, failed: 0 } })
    } }
    expect(await runSupportImport(config, { file, dryRun: true }, deps)).toBe(true)
    expect(await runSupportImport(config, { resume: '1' }, deps)).toBe(true)
    expect(output.join('\n')).not.toContain('server-secret')
    expect(output.join('\n')).not.toContain('privateTranscript')
    expect(output.join('\n')).not.toContain('Do not echo')
    expect(await runSupportImport(config, { resume: '../foreign' }, deps)).toBe(false)
    expect(calls).toBe(2)
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})
