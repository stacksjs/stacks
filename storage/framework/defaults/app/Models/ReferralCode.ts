import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'ReferralCode',
  table: 'referral_codes',
  traits: {
    useTimestamps: true,
    gdpr: { subject: 'user_id', erasure: 'delete', basis: 'contract', purpose: 'Referral codes' },
  },
  attributes: {
    userId: { required: true, unique: true, validation: { rule: schema.number().integer().min(1) } },
    code: { required: true, unique: true, validation: { rule: schema.string().max(24) } },
  },
} as const)
