import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'CommunicationSuppression',
  table: 'communication_suppressions',
  belongsTo: ['Team'],
  traits: {
    gdpr: { subject: { email: 'recipient' }, erasure: 'keep', basis: 'legal_obligation', purpose: 'Honouring opt-outs, which needs the address it suppresses' },
    useUuid: true,
    useTimestamps: true,
    useApi: { uri: 'communication-suppressions', routes: ['index', 'store', 'show', 'destroy'], middleware: ['auth', 'team'] },
  },
  indexes: [{ name: 'communication_suppressions_unique', columns: ['team_id', 'channel', 'recipient'], unique: true }],
  attributes: {
    recipient: { personal: true, required: true, fillable: true, validation: { rule: schema.string().max(255) }, factory: faker => faker.internet.email() },
    channel: { required: true, fillable: true, validation: { rule: schema.enum(['email', 'sms', 'push']) }, factory: () => 'email' },
    reason: { required: true, fillable: true, validation: { rule: schema.enum(['unsubscribe', 'bounce', 'complaint', 'carrier', 'manual', 'legal']) }, factory: () => 'unsubscribe' },
    source: { required: true, fillable: true, validation: { rule: schema.string().max(120) }, factory: () => 'preference_center' },
    suppressedAt: { required: true, fillable: true, validation: { rule: schema.timestamp() }, factory: () => new Date().toISOString() },
    liftedAt: { required: false, fillable: false, validation: { rule: schema.timestamp() }, factory: () => null },
  },
} as const)
