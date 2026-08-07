/**
 * One password policy, in one place (stacksjs/stacks#2226).
 *
 * The framework shipped three numbers for one product concept: `RegisterAction`
 * and `LoginAction` accepted six characters, the `User` model declared six, and
 * `PasswordResetAction` hand-checked eight with `password.length < 8` — not in a
 * `validations:` block at all, so it could not even be read by the machinery
 * that reads the others.
 *
 * Apps then retyped the rule again in the browser, because an Action's
 * `validations:` was unreachable from a template. That is how a real app ended
 * up refusing a 7-character password in the browser that `POST /register` would
 * have accepted.
 *
 * Change the policy here and every declaration follows. An app that wants a
 * different one edits this file, which is scaffolded into it.
 */

/**
 * Minimum length for a NEW password.
 *
 * Eight, because that is what the password-reset path already enforced and it
 * is the weaker of the two that was actually protecting anything. Raising the
 * registration minimum only affects accounts created from now on.
 */
export const PASSWORD_MIN_LENGTH = 8

/**
 * Maximum length. Also the `varchar` width the User model's column derives
 * from, so lowering it is a migration, not just a rule change.
 */
export const PASSWORD_MAX_LENGTH = 255

export const PASSWORD_POLICY_MESSAGE
  = `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`

/**
 * What a sign-in must require: that a password was supplied, and nothing more.
 *
 * Deliberately NOT the policy above. Applying a creation rule to authentication
 * locks out every account created under a previous, shorter policy — they would
 * get a 422 before their credentials were ever checked, with a message telling
 * them their own password is too short. The policy belongs on the paths that
 * SET a password.
 */
export const PASSWORD_PRESENCE_MESSAGE = 'Password is required.'
