import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

/**
 * The ledger of data-subject requests (stacksjs/stacks#365).
 *
 * One row per access export, per erasure, and per retention run that changed
 * something - written by `exportSubjectData`, `eraseSubject` and
 * `pruneRetainedData`, inside the erasure's own transaction, so an erasure is
 * recorded exactly when it happened. It is the answer to "when did we act on
 * this request, and what did we do", which a regulator can ask and which the
 * data itself can no longer answer once it is erased.
 *
 * It holds no personal data of its own: `summary` carries per-model counts,
 * never values. `subject_id` has no foreign key on purpose - the user row it
 * names may be anonymized or gone, and the record of having erased it must
 * outlive it.
 */
export default defineModel({
  name: 'GdprRequest',
  table: 'gdpr_requests',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    { name: 'gdpr_requests_subject_lookup', columns: ['subject_id', 'type', 'occurred_at'] },
  ],

  // System-written; there is no caller whose rows these are, and no API.
  ownership: false,

  traits: {
    useUuid: true,
    useTimestamps: true,
    gdpr: { subject: 'subject_id', erasure: 'keep', basis: 'legal_obligation', purpose: 'Record of the data-subject requests acted on' },
  },

  attributes: {
    type: {
      required: true,
      fillable: true,
      validation: { rule: schema.enum(['access', 'erasure', 'retention']) },
      factory: () => 'access',
    },
    subjectId: {
      required: false,
      fillable: true,
      validation: { rule: schema.number().integer().min(1) },
      factory: () => 1,
    },
    actor: {
      required: false,
      fillable: true,
      validation: { rule: schema.string().max(120) },
      factory: () => 'cli',
    },
    status: {
      required: true,
      fillable: true,
      default: 'completed',
      validation: { rule: schema.enum(['completed', 'failed']) },
      factory: () => 'completed',
    },
    summary: {
      required: false,
      fillable: true,
      validation: { rule: schema.json() },
      factory: () => JSON.stringify({}),
    },
    occurredAt: {
      required: true,
      fillable: true,
      validation: { rule: schema.timestamp() },
      factory: () => new Date().toISOString(),
    },
  },
} as const)
