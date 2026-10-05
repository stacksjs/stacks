import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'ConsentEvent',
  table: 'consent_events',
  belongsTo: ['Team'],
  traits: {
    gdpr: { subject: { email: 'recipient' }, erasure: 'keep', basis: 'legal_obligation', purpose: 'Proof of consent and its withdrawal (Article 7(1))' },
    useUuid: true,
    useTimestamps: true,
    useApi: { uri: 'consent-events', routes: ['index', 'show'], middleware: ['auth', 'team'] },
  },
  indexes: [
    { name: 'consent_events_idempotency_unique', columns: ['team_id', 'idempotency_key'], unique: true },
    { name: 'consent_events_lookup', columns: ['team_id', 'channel', 'recipient', 'occurred_at'] },
  ],
  attributes: {
    recipient: { personal: true, required: true, fillable: true, validation: { rule: schema.string().max(255) }, factory: faker => faker.internet.email() },
    channel: { required: true, fillable: true, validation: { rule: schema.enum(['email', 'sms', 'push']) }, factory: () => 'email' },
    action: { required: true, fillable: true, validation: { rule: schema.enum(['requested', 'granted', 'revoked', 'confirmed', 'suppressed']) }, factory: () => 'granted' },
    purpose: { required: true, fillable: true, validation: { rule: schema.string().max(120) }, factory: () => 'marketing' },
    source: { required: true, fillable: true, validation: { rule: schema.string().max(120) }, factory: () => 'signup_form' },
    jurisdiction: { required: false, fillable: true, validation: { rule: schema.string().max(80) }, factory: () => null },
    policyVersion: { required: true, fillable: true, validation: { rule: schema.string().max(40) }, factory: () => '1.0' },
    idempotencyKey: { required: false, fillable: true, validation: { rule: schema.string().max(255) }, factory: faker => faker.string.uuid() },
    proof: { personal: true, required: false, fillable: true, validation: { rule: schema.json() }, factory: () => JSON.stringify({}) },
    ipAddress: { personal: true, required: false, fillable: true, validation: { rule: schema.string().max(45) }, factory: faker => faker.internet.ip() },
    occurredAt: { required: true, fillable: true, validation: { rule: schema.timestamp() }, factory: () => new Date().toISOString() },
  },
} as const)
