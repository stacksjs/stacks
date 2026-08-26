import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { log as logDriver } from '@stacksjs/email'
import { logsPath } from '@stacksjs/path'

const { LogEmailDriver } = logDriver

export interface CapturedMailSummary {
  id: string
  source: 'memory' | 'disk'
  from: string
  to: string
  cc: string
  bcc: string
  subject: string
  preview: string
  sentAt: string
  hasHtml: boolean
  hasText: boolean
  size: number
}

export interface CapturedMailMessage extends CapturedMailSummary {
  html: string
  text: string
}

export interface CapturedMailProblem {
  /** The capture that could not be read: a disk filename, or `mem:<index>`. */
  capture: string
  reason: string
}

export interface CapturedMailListing {
  messages: CapturedMailSummary[]
  problems: CapturedMailProblem[]
}

function capturedMailDirectory(): string {
  return process.env.LOG_MAIL_DIR || logsPath('mail')
}

function formatAddress(value: unknown): string {
  if (!value)
    return ''
  if (typeof value === 'string')
    return value
  if (Array.isArray(value))
    return value.map(formatAddress).filter(Boolean).join(', ')
  if (typeof value !== 'object')
    throw new TypeError('Captured email address data must be a string or address object.')

  const address = (value as { address?: unknown }).address
  const name = (value as { name?: unknown }).name
  if (typeof address !== 'string')
    throw new TypeError('Captured email address objects must contain an address string.')
  if (name !== undefined && typeof name !== 'string')
    throw new TypeError('Captured email address names must be strings.')
  return name ? `${name} <${address}>` : address
}

function previewFor(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)
}

function validTimestamp(value: string, source: string): string {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time))
    throw new TypeError(`${source} contains an invalid capture timestamp.`)
  return new Date(time).toISOString()
}

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function headerValue(header: string, label: string): string {
  const match = header.match(new RegExp(`^\\s*${label}:\\s*(.*)$`, 'im'))
  return match?.[1]?.trim() || ''
}

async function diskMessage(name: string, directory: string): Promise<CapturedMailMessage | null> {
  const safeName = basename(name)
  if (safeName !== name || !safeName.endsWith('.html'))
    throw new TypeError('Captured disk email ids must reference one HTML filename.')

  const filePath = join(directory, safeName)
  let body: string
  let metadata
  try {
    [body, metadata] = await Promise.all([
      readFile(filePath, 'utf8'),
      stat(filePath),
    ])
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return null
    throw error
  }

  const headerMatch = body.match(/^<!--([\s\S]*?)-->/)
  if (!headerMatch?.[1])
    throw new TypeError(`Captured mail file ${safeName} is missing its log-driver header.`)
  const header = headerMatch[1]
  const capturedAt = header.match(/Captured by @stacksjs\/email log driver at\s+(\S+)/i)?.[1]
  if (!capturedAt)
    throw new TypeError(`Captured mail file ${safeName} is missing its capture timestamp.`)

  const visible = body.slice(headerMatch[0].length).trim()
  const from = headerValue(header, 'From')
  const to = headerValue(header, 'To')
  const subject = headerValue(header, 'Subject')
  if (!from || !to || !subject)
    throw new TypeError(`Captured mail file ${safeName} is missing required message headers.`)

  return {
    id: `disk:${safeName}`,
    source: 'disk',
    from,
    to,
    cc: headerValue(header, 'Cc'),
    bcc: headerValue(header, 'Bcc'),
    subject,
    preview: previewFor(visible),
    sentAt: validTimestamp(capturedAt, safeName),
    hasHtml: /<\w[\s>]/.test(visible),
    hasText: false,
    size: metadata.size,
    html: visible,
    text: '',
  }
}

type CapturedLogEmail = ReturnType<typeof LogEmailDriver.captured>[number]

function memoryMessage(email: CapturedLogEmail, index: number): CapturedMailMessage {
  if (!(email.sentAt instanceof Date) || !Number.isFinite(email.sentAt.getTime()))
    throw new TypeError('Captured in-memory email contains an invalid timestamp.')
  if (typeof email.subject !== 'string' || !email.subject.trim())
    throw new TypeError('Captured in-memory email is missing its subject.')

  const html = email.rendered?.html ?? email.html ?? ''
  const text = email.rendered?.text ?? email.text ?? ''
  if (typeof html !== 'string' || typeof text !== 'string')
    throw new TypeError('Captured in-memory email bodies must be strings.')

  const from = formatAddress(email.from)
  const to = formatAddress(email.to)
  if (!from || !to)
    throw new TypeError('Captured in-memory email is missing its sender or recipient.')

  const sentAt = email.sentAt.toISOString()
  return {
    id: `mem:${email.sentAt.getTime()}:${index}`,
    source: 'memory',
    from,
    to,
    cc: formatAddress(email.cc),
    bcc: formatAddress(email.bcc),
    subject: email.subject,
    preview: previewFor(html || text),
    sentAt,
    hasHtml: Boolean(html),
    hasText: Boolean(text),
    size: Buffer.byteLength(html, 'utf8') + Buffer.byteLength(text, 'utf8'),
    html,
    text,
  }
}

function memoryMessages(): CapturedMailMessage[] {
  return LogEmailDriver.captured().map(memoryMessage)
}

function dedupeKey(message: CapturedMailSummary): string {
  return `${message.sentAt}|${message.from}|${message.to}|${message.subject}`
}

/**
 * List every capture the log mail driver has taken.
 *
 * One unreadable capture must not take down the listing. A stale or
 * hand-edited file in the capture directory is an ordinary condition, and
 * failing the whole request over it returned a 503 that hid every other
 * captured email - on a real directory of 29 files, a single one written
 * before the header format settled was enough to empty the inbox.
 *
 * Skipping it silently would be the other wrong answer, so the capture is
 * reported in `problems` and the dashboard says what it could not read.
 * Nothing is fabricated for it, which is what the strict parse was for.
 *
 * `showCapturedMail` still throws for a capture the caller asked for by id:
 * there the broken file IS the answer, so the reason belongs in the response
 * rather than behind an empty result.
 */
export async function listCapturedMail(directory = capturedMailDirectory()): Promise<CapturedMailListing> {
  let names: string[]
  try {
    names = await readdir(directory)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      names = []
    else
      throw error
  }

  const problems: CapturedMailProblem[] = []

  const disk = await Promise.all(
    names.filter(name => name.endsWith('.html')).map(async (name) => {
      try {
        return await diskMessage(name, directory)
      }
      catch (error) {
        problems.push({ capture: name, reason: reasonFor(error) })
        return null
      }
    }),
  )

  const memory: CapturedMailMessage[] = []
  LogEmailDriver.captured().forEach((email, index) => {
    try {
      memory.push(memoryMessage(email, index))
    }
    catch (error) {
      problems.push({ capture: `mem:${index}`, reason: reasonFor(error) })
    }
  })

  const seen = new Set<string>()
  const messages: CapturedMailSummary[] = []
  for (const message of [...disk.filter((entry): entry is CapturedMailMessage => entry !== null), ...memory]) {
    const key = dedupeKey(message)
    if (seen.has(key))
      continue
    seen.add(key)
    messages.push({
      id: message.id,
      source: message.source,
      from: message.from,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      preview: message.preview,
      sentAt: message.sentAt,
      hasHtml: message.hasHtml,
      hasText: message.hasText,
      size: message.size,
    })
  }

  return {
    messages: messages.sort((left, right) =>
      new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime(),
    ),
    // Settled in filename order rather than whichever read rejected first, so
    // the same directory always produces the same response.
    problems: problems.sort((left, right) => left.capture.localeCompare(right.capture)),
  }
}

export async function showCapturedMail(id: string, directory = capturedMailDirectory()): Promise<CapturedMailMessage | null> {
  if (id.startsWith('disk:'))
    return diskMessage(id.slice(5), directory)

  const memoryMatch = id.match(/^mem:(\d+):(\d+)$/)
  if (memoryMatch) {
    const timestamp = Number(memoryMatch[1])
    const index = Number(memoryMatch[2])
    const message = memoryMessages()[index]
    return message && message.id === `mem:${timestamp}:${index}` ? message : null
  }

  throw new TypeError('Captured email id must use the disk or memory format.')
}
