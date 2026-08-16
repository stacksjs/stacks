import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'SenderDomain',
  table: 'sender_domains',
  belongsTo: ['Team'],
  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: { uri: 'sender-domains', routes: ['index', 'store', 'show', 'update', 'destroy'], middleware: ['auth', 'team'] },
  },
  indexes: [{ name: 'sender_domains_domain_unique', columns: ['domain'], unique: true }],
  attributes: {
    domain: { required: true, fillable: true, validation: { rule: schema.string().max(253) }, factory: faker => faker.internet.domainName() },
    status: { required: true, fillable: true, default: 'pending', validation: { rule: schema.enum(['pending', 'verified', 'failed', 'disabled']) }, factory: () => 'pending' },
    selector: { required: true, fillable: true, default: 'mail', validation: { rule: schema.string().max(63) }, factory: () => 'mail' },
    dnsRecords: { required: false, fillable: true, validation: { rule: schema.json() }, factory: () => JSON.stringify([]) },
    verifiedAt: { required: false, fillable: true, validation: { rule: schema.timestamp() }, factory: () => null },
    lastCheckedAt: { required: false, fillable: true, validation: { rule: schema.timestamp() }, factory: () => null },
  },
} as const)
