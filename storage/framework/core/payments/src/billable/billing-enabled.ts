/**
 * What a payments endpoint answers when the signed-in user's model does not
 * declare `traits.billable`.
 *
 * The default User model leaves the trait off, because not every app bills
 * through its users. Without it a user record has none of the billable
 * methods, so an endpoint that reaches for `user.checkout()` has to ask first
 * (`isBillable(user)` from `@stacksjs/orm`) and say which switch is missing,
 * rather than fail with "user.checkout is not a function". One message, so
 * every endpoint names the same fix.
 */
export const BILLING_NOT_ENABLED = 'Billing is not enabled. Set `traits.billable` on the User model to use payments.'
