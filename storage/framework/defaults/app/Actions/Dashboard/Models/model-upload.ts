/**
 * A file chosen for a model's field (`dashboard.fields.<name>.input:
 * 'upload'`): whether it is one the field takes, and where it is kept.
 */
import { detectMimeFromMagicBytes } from '@stacksjs/storage'

/** The largest file a field's upload takes. The same limit the Files page has. */
export const MODEL_UPLOAD_BYTES = 10 * 1024 * 1024

/** The image types an extension stands for, so `.png` is held to the same check `image/png` is. */
const IMAGE_EXTENSIONS: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

/**
 * What a file is, as far as it can be told.
 *
 * Its bytes say, for the formats that have a signature: that is what it is,
 * whatever it was sent as. A file sent as an image whose bytes are no image
 * this can recognise is not taken to be one: the type on a request is the
 * sender's word, and an image is where a wrong word matters (it is shown in
 * a page). An SVG is text and has no signature, so it is an image only to a
 * field that names it.
 */
export function uploadedType(file: { type?: string, bytes?: Uint8Array }): string {
  const detected = file.bytes ? detectMimeFromMagicBytes(file.bytes) : null
  if (detected)
    return detected
  const claimed = (file.type ?? '').split(';')[0]!.trim().toLowerCase()
  return claimed.startsWith('image/') && claimed !== 'image/svg+xml' ? '' : claimed
}

/**
 * Whether a file is of a kind the field accepts.
 *
 * `accept` is spelled as a file input spells it: a type (`image/png`), a
 * family (`image/*`), or an extension (`.pdf`). The browser's file chooser
 * reads the same list, but it is a hint there and a rule here: a request can
 * be made without the chooser, so the file is judged by what it is
 * ({@link uploadedType}) and not by what it was sent as. With no `accept`,
 * any file is one.
 */
export function uploadAccepts(accept: string | undefined, file: { type?: string, name?: string, bytes?: Uint8Array }): boolean {
  const entries = (accept ?? '').split(',').map(entry => entry.trim().toLowerCase()).filter(Boolean)
  if (entries.length === 0)
    return true
  const type = uploadedType(file)
  const name = (file.name ?? '').toLowerCase()
  return entries.some((entry) => {
    if (entry.startsWith('.')) {
      // An image's extension is its type; any other is the name's to say,
      // unless the bytes turn out to be an image after all.
      return IMAGE_EXTENSIONS[entry] ? type === IMAGE_EXTENSIONS[entry] : name.endsWith(entry) && !type.startsWith('image/')
    }
    // A family takes what is of it. An SVG can carry script, so it is taken
    // only where it is named.
    if (entry.endsWith('/*'))
      return type.startsWith(entry.slice(0, -1)) && type !== 'image/svg+xml'
    return type === entry
  })
}

/** What an `accept` reads as in a sentence: "image/*" is "an image", a list is itself. */
export function describeAccept(accept: string): string {
  const entries = accept.split(',').map(entry => entry.trim()).filter(Boolean)
  if (entries.length === 1 && entries[0]!.toLowerCase() === 'image/*')
    return 'an image'
  return `one of: ${entries.join(', ')}`
}

/** Where a field's files are kept on the disk: together, by table and column. */
export function uploadDirectory(table: string, column: string): string {
  const segment = (value: string) => value.toLowerCase().replace(/[^a-z\d_-]+/g, '-').replace(/^-+|-+$/g, '') || 'file'
  return `uploads/${segment(table)}/${segment(column)}`
}
