import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A social provider identity linked to a local user (stacksjs/stacks#2276).
 *
 * One row per (provider, provider account): a link table rather than columns
 * on `users`, so one user can attach several providers and a provider-side
 * email change cannot orphan the link. The unique index on
 * `(provider, provider_user_id)` is what makes "sign in with the same GitHub
 * account" resolve to the same local user forever.
 *
 * Rows are only ever written by the framework's social sign-in policy
 * (`resolveSocialSignIn` in @stacksjs/auth) — the takeover guard lives there,
 * not here.
 */
export default defineModel({
  name: 'SocialAccount',
  table: 'social_accounts',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'social_accounts_provider_provider_user_id_unique',
      columns: ['provider', 'provider_user_id'],
      unique: true,
    },
    {
      name: 'social_accounts_user_id_index',
      columns: ['user_id'],
    },
  ],

  traits: {
    useTimestamps: true,
  },

  belongsTo: ['User'],

  attributes: {
    provider: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(50),
        message: { max: 'Provider must not exceed 50 characters' },
      },
    },

    providerUserId: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: { max: 'Provider user id must not exceed 255 characters' },
      },
    },

    // The address the provider reported at link time. Informational — sign-in
    // resolves through (provider, provider_user_id), never through this.
    providerEmail: {
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: { max: 'Provider email must not exceed 255 characters' },
      },
    },
  },
})
