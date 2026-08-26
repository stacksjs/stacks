import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { log as logDriver } from '@stacksjs/email'
import { listCapturedMail, showCapturedMail } from './captured-mail'

const { LogEmailDriver } = logDriver
const temporaryDirectories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-captured-mail-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  LogEmailDriver.reset()
  await Promise.all(temporaryDirectories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true }),
  ))
})

describe('captured dashboard mail', () => {
  it('returns an empty list when the capture directory does not exist', async () => {
    const root = await temporaryDirectory()
    expect(await listCapturedMail(join(root, 'missing'))).toEqual({ messages: [], problems: [] })
  })

  it('lists and reads a valid disk capture', async () => {
    const directory = await temporaryDirectory()
    const filename = '2026-07-29T12-00-00-000Z-Welcome.html'
    const html = `<!--
  Captured by @stacksjs/email log driver at 2026-07-29T12:00:00.000Z
  From:    Stacks <hello@example.com>
  To:      Chris <chris@example.com>
  Cc:      teammate@example.com
  Subject: Welcome
-->
<main><h1>Welcome</h1><p>Your account is ready.</p></main>
`
    await writeFile(join(directory, filename), html)

    const { messages, problems } = await listCapturedMail(directory)
    expect(problems).toEqual([])
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      id: `disk:${filename}`,
      source: 'disk',
      from: 'Stacks <hello@example.com>',
      to: 'Chris <chris@example.com>',
      cc: 'teammate@example.com',
      subject: 'Welcome',
      preview: 'Welcome Your account is ready.',
      sentAt: '2026-07-29T12:00:00.000Z',
      hasHtml: true,
      hasText: false,
    })
    expect(messages[0]?.size).toBe(Buffer.byteLength(html))

    const message = await showCapturedMail(`disk:${filename}`, directory)
    expect(message?.html).toContain('<h1>Welcome</h1>')
    expect(message?.text).toBe('')
  })

  it('reports a malformed capture instead of fabricating metadata for it', async () => {
    const directory = await temporaryDirectory()
    await writeFile(join(directory, 'broken.html'), '<p>No capture header</p>')

    const { messages, problems } = await listCapturedMail(directory)
    expect(messages).toEqual([])
    expect(problems).toEqual([
      { capture: 'broken.html', reason: expect.stringContaining('missing its log-driver header') },
    ])
  })

  it('still lists the readable captures when one file alongside them is broken', async () => {
    // The bug this pins: `storage/logs/mail` held 29 captures, one of them
    // written before the header format settled, and the single bad file made
    // the whole endpoint 503 - the dashboard inbox showed nothing at all.
    const directory = await temporaryDirectory()
    const good = '2026-07-29T12-00-00-000Z-Welcome.html'
    await writeFile(join(directory, good), `<!--
  Captured by @stacksjs/email log driver at 2026-07-29T12:00:00.000Z
  From:    Stacks <hello@example.com>
  To:      Chris <chris@example.com>
  Subject: Welcome
-->
<main><p>Your account is ready.</p></main>
`)
    await writeFile(join(directory, 'legacy-no-header.html'), '<p>Written before the header existed</p>')
    await writeFile(join(directory, 'headers-missing-subject.html'), `<!--
  Captured by @stacksjs/email log driver at 2026-07-29T12:00:00.000Z
  From:    Stacks <hello@example.com>
  To:      Chris <chris@example.com>
-->
<main><p>No subject line.</p></main>
`)

    const { messages, problems } = await listCapturedMail(directory)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.id).toBe(`disk:${good}`)
    expect(problems.map(problem => problem.capture)).toEqual([
      'headers-missing-subject.html',
      'legacy-no-header.html',
    ])
    expect(problems[0]?.reason).toContain('missing required message headers')
    expect(problems[1]?.reason).toContain('missing its log-driver header')
  })

  it('still throws when a broken capture is the one being asked for by id', async () => {
    // Listing skips it; fetching it by id must not answer with an empty
    // result, because there the broken file IS what the caller asked about.
    const directory = await temporaryDirectory()
    await writeFile(join(directory, 'broken.html'), '<p>No capture header</p>')
    await expect(showCapturedMail('disk:broken.html', directory))
      .rejects.toThrow('missing its log-driver header')
  })

  it('rejects disk ids that could escape the capture directory', async () => {
    const directory = await temporaryDirectory()
    await mkdir(join(directory, 'nested'))
    await expect(showCapturedMail('disk:../secret.html', directory))
      .rejects.toThrow('one HTML filename')
  })
})
