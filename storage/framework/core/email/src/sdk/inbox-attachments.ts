import { createHash } from 'node:crypto'

export interface InboxAttachment {
  id: string
  name: string
  size: number
  lastModified?: string
}

export interface StoredInboxAttachment extends InboxAttachment {
  key: string
}

export interface InboxAttachmentObject {
  Key: string
  Size?: number
  LastModified?: string
}

export function inboxAttachmentPrefix(basePath: string): string {
  return `${basePath.replace(/\/+$/, '')}/attachments/`
}

export function inboxAttachmentId(key: string): string {
  return createHash('sha256').update(key).digest('base64url').slice(0, 22)
}

export function inboxAttachmentName(key: string, prefix: string): string {
  const rawStoredName = key.startsWith(prefix) ? key.slice(prefix.length) : key.split('/').pop() || ''
  const storedName = rawStoredName.replace(/^stacks-\d{4}--/, '')
  let decodedName = storedName

  try {
    decodedName = decodeURIComponent(storedName)
  }
  catch {
    // S3 object names are not required to be URI encoded.
  }

  const safeName = decodedName
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()

  return safeName.slice(0, 240) || 'attachment'
}

export function mapInboxAttachmentObjects(
  basePath: string,
  objects: InboxAttachmentObject[],
): StoredInboxAttachment[] {
  const prefix = inboxAttachmentPrefix(basePath)

  return objects
    .filter(object => object.Key.startsWith(prefix) && object.Key.length > prefix.length && !object.Key.endsWith('/'))
    .map(object => ({
      id: inboxAttachmentId(object.Key),
      key: object.Key,
      name: inboxAttachmentName(object.Key, prefix),
      size: Math.max(0, Number(object.Size) || 0),
      ...(object.LastModified ? { lastModified: object.LastModified } : {}),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function inboxAttachmentContentDisposition(filename: string): string {
  const asciiName = filename
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\]/g, '_')
    .trim() || 'attachment'
  const utf8Name = encodeURIComponent(filename).replace(/['()]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)

  return `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`
}

export function inboxAttachmentContentType(contentType?: string): string {
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase() || ''
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(mediaType)
    ? mediaType
    : 'application/octet-stream'
}
