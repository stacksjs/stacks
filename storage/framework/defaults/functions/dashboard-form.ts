/**
 * Form helpers shared by the dashboard's editor dialogs.
 *
 * `formErrorMessages` was copied verbatim into fourteen Commerce dialogs
 * (stacksjs/stacks#2918). It is a pure function of a validation-error map with
 * no reactive dependency and no markup, so a component was the wrong home for
 * it: the label formatting it encodes had fourteen definitions, and a change
 * to how a field name becomes a label had to be made in all of them or drift.
 */

/**
 * Turn a map of field errors into lines a person can read.
 *
 * Behaviour is the fourteen copies' behaviour, unchanged, including one wart
 * worth naming rather than silently fixing: the two spellings do not read
 * alike. `first_name` becomes "First name", while `firstName` becomes
 * "First Name", because the split inserts a space without lowering the second
 * word. A server reporting snake_case and a client reporting camelCase
 * therefore render differently for the same field.
 *
 * Left as-is here because extracting and changing at once makes a regression
 * impossible to attribute. Fixing it is a one-line change in one place now,
 * which is the point of the extraction.
 */
export function formErrorMessages(errors: Record<string, string>): string[] {
  return Object.entries(errors).map(([field, message]) => {
    const label = field.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ')
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${message}`
  })
}

/**
 * A slug a dialog proposes from a name: accents folded, lowercase, and every
 * run of anything but a letter or digit one hyphen.
 *
 * The category dialog defined this inline; the product dialog needs the same
 * rule (stacksjs/stacks#3005), so it lives here once.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
