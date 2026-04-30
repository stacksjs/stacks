import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Action } from '@stacksjs/actions'
import { log as logDriver } from '@stacksjs/email'
import { logsPath } from '@stacksjs/path'

const { LogEmailDriver } = logDriver

interface InboxEntry {
  id: string
  source: 'memory' | 'disk'
  from: string
  to: string
  subject: string
  preview: string
  sent_at: string
  has_html: boolean
  has_text: boolean
  size: number
}

function formatAddress(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(formatAddress).filter(Boolean).join(', ')
  const obj = value as { name?: string, address?: string }
  if (obj.address) return obj.name ? `${obj.name} <${obj.address}>` : obj.address
  return ''
}

function makePreview(input?: string): string {
  if (!input) return ''
  // Strip HTML and collapse whitespace; preview ~140 chars.
  const text = input.replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 140)
}

async function readDiskEntries(): Promise<InboxEntry[]> {
  const dir = process.env.LOG_MAIL_DIR || logsPath('mail')
  let names: string[] = []
  try {
    names = await readdir(dir)
  }
  catch {
    return []
  }

  const entries = await Promise.all(
    names
      .filter(n => n.endsWith('.html'))
      .map(async (name) => {
        const filePath = join(dir, name)
        try {
          const [body, info] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)])
          // The log driver writes a `<!-- ... -->` header at the top of the file; parse it.
          const headerMatch = body.match(/<!--([\s\S]*?)-->/)
          const header = headerMatch?.[1] || ''
          const grab = (label: string) => {
            const m = header.match(new RegExp(`${label}:\\s*([^\\n]+)`, 'i'))
            return (m?.[1] || '').trim()
          }
          const subject = grab('Subject') || name.replace(/\.html$/, '')
          const from = grab('From')
          const to = grab('To')
          const stamp = grab('Captured by .* at')
            // The "Captured by ... at <iso>" line uses a fixed prefix; fall back to mtime.
            || (header.match(/at\s+([^\n]+)/)?.[1] || '').trim()
            || info.mtime.toISOString()
          // Strip the HTML comment so the preview reflects the visible body.
          const visible = body.replace(/<!--[\s\S]*?-->/, '')
          return {
            id: `disk:${name}`,
            source: 'disk' as const,
            from,
            to,
            subject,
            preview: makePreview(visible),
            sent_at: stamp,
            has_html: visible.trim().startsWith('<') || /<\w/.test(visible),
            has_text: !!visible.trim(),
            size: info.size,
          }
        }
        catch {
          return null
        }
      }),
  )

  return entries.filter((entry): entry is InboxEntry => entry !== null)
}

export default new Action({
  name: 'InboxIndexAction',
  description: 'Returns transactional emails captured by the log mail driver.',
  method: 'GET',
  async handle() {
    // 1) In-memory captured list (live for this process; survives nothing).
    const memory = LogEmailDriver.captured().map((email, index): InboxEntry => {
      const html = email.rendered?.html ?? email.html
      const text = email.rendered?.text ?? email.text
      return {
        id: `mem:${index}`,
        source: 'memory',
        from: formatAddress(email.from),
        to: formatAddress(email.to),
        subject: email.subject || '(no subject)',
        preview: makePreview(html || text),
        sent_at: email.sentAt.toISOString(),
        has_html: Boolean(html),
        has_text: Boolean(text),
        size: (html?.length || 0) + (text?.length || 0),
      }
    })

    // 2) Disk-rendered files (survive restarts, written by every send).
    const disk = await readDiskEntries()

    // Disk entries are authoritative across restarts, so prefer them when both
    // exist for the same subject/timestamp. We dedupe by `subject + sent_at`.
    const seen = new Set<string>()
    const merged: InboxEntry[] = []
    for (const entry of [...disk, ...memory]) {
      const key = `${entry.subject}|${entry.sent_at}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(entry)
    }

    merged.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())

    const driver = process.env.MAIL_MAILER || 'log'

    return {
      driver,
      total: merged.length,
      data: merged,
    }
  },
})
