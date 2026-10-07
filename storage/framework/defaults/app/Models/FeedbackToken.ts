import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

/**
 * A revocable capability to add one card to one board, and nothing else.
 *
 * Deliberately NOT a personal access token. `tokenCan()` and the `abilities`
 * middleware are opt-in per route, and the dashboard's own actions authorize
 * by calling `request.user()` rather than by checking scopes, so a
 * user-owned bearer token authenticates as its owner across the whole
 * dashboard API. Handing an external reviewer one of those to file feedback
 * with would hand them an account (stacksjs/stacks#2872).
 *
 * This is a capability instead: the auth stack does not know it, so it can
 * authenticate nothing. It names a board, it is checked only by the feedback
 * intake action, and it never resolves to a user.
 *
 * `token` stores the SHA-256 of the raw value - deterministic, so a submit is
 * one indexed lookup, and with 256 bits of entropy in the raw token an
 * offline attack on a fast hash is irrelevant. Same reasoning as
 * `MagicLinkToken`, and deliberately not the bcrypt-and-scan of password
 * resets.
 *
 * No `useApi`: these rows are minted by a command and read by the intake
 * action. Exposing them over REST would publish the thing they protect.
 */
export default defineModel({
  name: 'FeedbackToken',
  table: 'feedback_tokens',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    gdpr: { erasure: 'delete', basis: 'legitimate_interests', purpose: 'Invites an external reviewer to file feedback on one board' },
    useTimestamps: true,
    useUuid: true,
  },

  // Cascade, so deleting a board takes its links with it: a token that
  // outlives the board it names would be admitted carrying a board id that no
  // longer resolves.
  //
  // Declared, not relied on. SQLite enforces this only with
  // `foreign_keys = ON`, which the framework sets while renaming and not
  // otherwise - `fk-audit.ts` exists because of exactly that. Verified with
  // the pragma on (the row goes) and off (it stays), so the intake action
  // checks the board resolves rather than trusting the constraint to have
  // removed the token.
  belongsTo: [{ model: 'Board', onDelete: 'cascade' }],

  attributes: {
    /** SHA-256 hex of the raw token. Never the raw value. */
    token: {
      required: true,
      order: 1,
      fillable: true,
      unique: true,
      validation: {
        rule: schema.string().min(64).max(64),
      },
      factory: faker => faker.string.hexadecimal({ length: 64, prefix: '' }).toLowerCase(),
    },

    /**
     * Who it was issued to, so an operator can tell two links apart and
     * revoke the right one. Shown in `buddy feedback:tokens`, never sent to
     * the submitter and never used to authenticate.
     */
    label: {
      personal: true,
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(120),
      },
      factory: faker => faker.person.firstName(),
    },

    /**
     * Revocation, which is the whole point of the design: flipping this stops
     * the link without a deploy. Nullable rather than a boolean so the
     * operator can also see *when* it was pulled.
     */
    revokedAt: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },

    /** Unset means it does not expire on its own; revocation still applies. */
    expiresAt: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },

    /**
     * Last accepted submission. Lets an operator retire a link nobody uses,
     * and tells them whether a leaked token has been exercised.
     */
    lastUsedAt: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },

    /** The user who minted it. Set server-side, surfaced in the listing. */
    createdByUserId: {
      required: false,
      order: 6,
      fillable: true,
      validation: { rule: schema.number() },
      factory: () => null,
    },
  },
} as const)
