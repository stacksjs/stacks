import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Referral',
  table: 'referrals',
  traits: { useTimestamps: true },
  indexes: [{ name: 'referrals_referrer_status', columns: ['referrer_id', 'status'] }],
  attributes: {
    referrerId: { required: true, validation: { rule: schema.number().integer().min(1) } },
    referredUserId: { required: true, unique: true, validation: { rule: schema.number().integer().min(1) } },
    code: { required: true, validation: { rule: schema.string().max(24) } },
    status: { required: true, default: 'registered', validation: { rule: schema.enum(['registered', 'qualified']) } },
    qualifiedAt: { nullable: true, validation: { rule: schema.date() } },
  },
} as const)
