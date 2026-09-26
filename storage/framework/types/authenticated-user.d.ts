// The signed-in user's columns, derived rather than declared.
//
// `request.user()` resolves to `AuthenticatedUser` from `@stacksjs/types`. That
// package cannot import the ORM (it sits underneath it), so on its own it knows
// only `id` and `email`, and every other field is `unknown` until something
// says otherwise. This is what says otherwise: the columns of the User model
// the application actually runs, read off the same barrel
// `injectGlobalAutoImports` loads at runtime. Override `app/Models/User.ts` and
// the type follows with nothing to regenerate; add a column and `user.team_id`
// is typed the moment the model declares it.
//
// When that model declares `traits: { billable: true }`, the billable instance
// methods (`user.checkout(...)`, `user.newSubscription(...)`) come with it,
// because every record it hydrates carries them. With the trait off, they are
// absent, and `isBillable(user)` from `@stacksjs/orm` is how to ask.
//
// `id` stays as `@stacksjs/types` declares it, `number | string`, rather than
// the model's `number`: a BIGINT key comes back from Postgres as a string.

import type { BillableMethods, Def, ModelRow } from '@stacksjs/orm'

/** Every model, by the name the ORM exposes it under. */
type Models = typeof import('../auto-imports/models')

/** `true` for `any`, which is what an unresolvable barrel reads as. */
type IsAny<T> = 0 extends 1 & T ? true : false

/** The application's User model, or nothing when there is none to read. */
type AppUser = IsAny<Models> extends true ? never : Models extends { User: infer TUser } ? TUser : never

/** Its columns, minus the `id` the base interface declares more honestly. */
type AppUserColumns = [AppUser] extends [never] ? {} : Omit<ModelRow<AppUser>, 'id'>

/** Its billable methods, when it declares the trait. */
type AppUserBillable = [AppUser] extends [never]
  ? {}
  : Def<AppUser> extends { readonly traits: { readonly billable: true } } ? BillableMethods : {}

declare module '@stacksjs/types' {
  interface AuthenticatedUser extends AppUserColumns, AppUserBillable {}
}
