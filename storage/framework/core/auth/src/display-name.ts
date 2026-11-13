/**
 * What a display name may be, and what of it an email may print.
 *
 * A name is the one free-text field an anonymous visitor fills at sign-up,
 * and the framework then writes it into mail it sends from the application's
 * own domain. Registration never proved the address belonged to the person
 * registering it, so a name of "70.000 TL bonus bit.ly/..." registered against
 * somebody else's address became an advert delivered to a stranger, greeted
 * by name, with the application as its sender (2026-11-13: three such
 * accounts on each of two production services).
 *
 * Two rules, kept apart on purpose:
 *
 * - {@link displayNameProblem} decides what registration STORES. A name is
 *   letters, marks, digits, spaces and a little punctuation, at most
 *   {@link DISPLAY_NAME_MAX_LENGTH} characters, and never a web address.
 * - {@link greetingName} decides what a mail PRINTS, and trusts nothing: it
 *   re-applies the rule to whatever is in the column, because rows written
 *   before this existed, by a social provider, or by a later profile edit
 *   never went through registration. It answers with a first name or nothing.
 *
 * No dependencies: `buddy user:audit` and the mail actions import this
 * without booting the rest of auth.
 */

/**
 * The longest name registration stores.
 *
 * Eighty characters holds every real full name with room to spare (the
 * longest in common use run to about sixty) and is too short to carry a
 * sentence of advertising. The `users.name` column keeps its own, larger
 * ceiling; this is the limit on what a stranger may put there.
 */
export const DISPLAY_NAME_MAX_LENGTH = 80

/** The shortest name registration stores, as `RegisterAction` always had it. */
export const DISPLAY_NAME_MIN_LENGTH = 2

/** The longest first name a greeting prints. Longer reads as a phrase, not a name. */
const GREETING_MAX_LENGTH = 30

export type DisplayNameProblem = 'empty' | 'too_short' | 'too_long' | 'control' | 'markup' | 'link' | 'characters'

// Zero-width joiner and non-joiner are part of spelling in Persian and
// several Indic scripts, so they are the two format characters a name keeps.
const JOINERS = /[\u200C\u200D]/g

// Control characters (a newline in a name is a header-injection attempt in
// waiting) and the invisible format characters: bidi overrides, zero-width
// space, the byte order mark.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\p{Cc}\p{Cf}\u2028\u2029]/u

const MARKUP = /[<>]/

/*
 * A web address, as a mail client would link it.
 *
 * Besides the unmistakable forms (a scheme, `www.`, a slash, an `@`), this is
 * any dot standing between two runs of two or more letters or digits:
 * `bit.ly`, `example.com`, `70.000`. Initials stay legal because their runs
 * are one letter long ("J.R.R. Tolkien"), and so does a title followed by a
 * space ("Dr. Okafor"). "Dr.Okafor" without the space is refused, and the
 * message says what to change; a real person can add a space, and a link
 * cannot survive one.
 */
const LINK = /:\/\/|www\.|[/\\@]|[\p{L}\p{N}-]{2,}\.[\p{L}\p{N}]{2,}/iu

// Letters and their combining marks, digits, spaces, and the punctuation
// names actually use: O'Neil, Jean-Luc, Smith Jr., "Katherine (Kate)".
const ALLOWED = /^[\p{L}\p{M}\p{N} .,'\u2019()\-]+$/u

/**
 * A name as it is compared and stored: compatibility forms folded (full-width
 * letters and dots become their plain selves, so `ｂｉｔ．ｌｙ` is judged as
 * `bit.ly`), runs of whitespace collapsed to one space, ends trimmed.
 */
export function normalizeDisplayName(name: unknown): string {
  if (typeof name !== 'string')
    return ''
  return name.normalize('NFKC').replace(/[^\S\n\r]+/g, ' ').trim()
}

/**
 * Why `name` may not be stored as a display name, or `null` when it may.
 *
 * The order is the order of how alarming the finding is, so an audit that
 * prints the reason prints the most telling one.
 */
export function displayNameProblem(name: unknown): DisplayNameProblem | null {
  if (typeof name !== 'string')
    return 'empty'

  const normalized = normalizeDisplayName(name)
  if (normalized === '')
    return 'empty'

  const visible = normalized.replace(JOINERS, '')
  if (CONTROL.test(visible))
    return 'control'
  if (MARKUP.test(visible))
    return 'markup'
  if (LINK.test(visible))
    return 'link'
  if (!ALLOWED.test(visible))
    return 'characters'

  const length = [...normalized].length
  if (length > DISPLAY_NAME_MAX_LENGTH)
    return 'too_long'
  if (length < DISPLAY_NAME_MIN_LENGTH)
    return 'too_short'

  return null
}

/** The sentence a person reads when their name was refused. */
export function displayNameMessage(problem: DisplayNameProblem): string {
  switch (problem) {
    case 'link':
      return 'Name cannot contain a link or web address. If your name has a dot in it, add a space after the dot.'
    case 'markup':
    case 'control':
    case 'characters':
      return 'Name can only contain letters, numbers, spaces, and the punctuation . , \' - ( )'
    case 'too_long':
      return `Name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters.`
    default:
      return `Name must be between ${DISPLAY_NAME_MIN_LENGTH} and ${DISPLAY_NAME_MAX_LENGTH} characters.`
  }
}

/**
 * The first name a mail may greet someone by, or `undefined` for "no name".
 *
 * Every mail that says "Hi ..." reads the name through this, whatever wrote
 * the column. A name that would not pass registration today yields no name at
 * all rather than a cleaned-up one: a row holding an advert is not improved
 * by printing the first word of it.
 */
export function greetingName(name: unknown): string | undefined {
  if (displayNameProblem(name) !== null)
    return undefined

  const first = normalizeDisplayName(name).split(' ')[0]!.replace(/[.,()]+$/, '')
  if ([...first].length > GREETING_MAX_LENGTH || !/\p{L}/u.test(first))
    return undefined

  return first
}
