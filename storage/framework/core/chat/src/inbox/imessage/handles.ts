/**
 * Messages identifies people by handle: an E.164 phone number (`+15551234567`)
 * or an email. The same person shows up spelled differently across `handle`,
 * `chat.chat_identifier` and the Contacts database (`(555) 123-4567`,
 * `Me@iCloud.com`), so everything is compared in one normal form.
 */
export function normalizeHandle(raw: string): string {
  const handle = raw.trim()
  if (handle.includes('@'))
    return handle.toLowerCase()

  const digits = handle.replace(/[^\d+]/g, '')
  if (!/^\+?\d{7,15}$/.test(digits))
    return handle

  if (digits.startsWith('+'))
    return digits
  // A bare 10-digit number is North American; Messages stores it with +1.
  if (digits.length === 10)
    return `+1${digits}`
  return `+${digits}`
}

/**
 * True for something Messages can address: an E.164 phone number or an
 * email. Short codes (`22395`) and business ids (`urn:biz:...`) are real
 * conversations but cannot be opened by address.
 */
export function isAddressable(handle: string): boolean {
  return /^\+\d{7,15}$/.test(handle) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle)
}

/** `+15551234567` as `+1 (555) 123-4567`; anything else unchanged. */
export function formatHandle(handle: string): string {
  const nanp = handle.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  if (nanp)
    return `+1 (${nanp[1]}) ${nanp[2]}-${nanp[3]}`
  return handle
}
