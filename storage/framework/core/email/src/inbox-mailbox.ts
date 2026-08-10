export interface InboxMailboxPath {
  address: string
  domain: string
  localPart: string
  prefix: string
  indexKey: string
}

export class InvalidInboxMailboxError extends TypeError {
  constructor(message = 'Mailbox must be a valid address on the configured email domain.') {
    super(message)
    this.name = 'InvalidInboxMailboxError'
  }
}

export class InvalidInboxPathError extends TypeError {
  constructor(message = 'Inbox metadata contains an invalid message path.') {
    super(message)
    this.name = 'InvalidInboxPathError'
  }
}

export function inboundMailboxRecipient(
  address: string,
  expectedDomain: string,
): { address: string, domain: string, localPart: string } | null {
  const normalizedAddress = address.trim().toLowerCase()
  const separator = normalizedAddress.lastIndexOf('@')
  if (separator <= 0)
    return null

  const localPart = normalizedAddress.slice(0, separator)
  const domain = normalizedAddress.slice(separator + 1)
  if (domain !== expectedDomain.trim().toLowerCase())
    return null
  if (!/^[a-z0-9.!#$%&'*+?^_`{|}~=-]+$/i.test(localPart) || localPart.includes('..'))
    return null
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i.test(domain))
    return null

  return { address: normalizedAddress, domain, localPart }
}

export function inboxMailboxPath(mailbox: string, expectedDomain: string): InboxMailboxPath {
  const address = mailbox.includes('@') ? mailbox : `${mailbox}@${expectedDomain}`
  const parsed = inboundMailboxRecipient(address, expectedDomain)
  if (!parsed)
    throw new InvalidInboxMailboxError()

  const prefix = `mailboxes/${parsed.domain}/${parsed.localPart}`
  return {
    ...parsed,
    prefix,
    indexKey: `${prefix}/inbox.json`,
  }
}

export function inboxMessagePath(path: string, mailbox: InboxMailboxPath): string {
  const normalized = path.trim()
  const prefix = `${mailbox.prefix}/`
  if (!normalized.startsWith(prefix))
    throw new InvalidInboxPathError()

  const segments = normalized.slice(prefix.length).split('/')
  if (segments.length === 0 || segments.some(segment =>
    !segment
    || segment === '.'
    || segment === '..'
    || segment.includes('\\')
    || /[\u0000-\u001F\u007F]/.test(segment),
  )) {
    throw new InvalidInboxPathError()
  }

  return normalized
}
