import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

/**
 * What one order did with one product of a post-purchase offer.
 *
 * Written when the offer is shown (`viewed`) and moved on from there:
 * `pending` while its payment is being taken, then `accepted` (the line is on
 * the order), `failed` (the payment did not go through; the shopper may try
 * again while the offer is open) or `declined`. The unique index makes the
 * offer one-time: an order can take each product of an offer once, however
 * many tabs or double clicks race for it.
 *
 * The line is snapshotted here before the payment is taken, so a payment that
 * needs the shopper to authenticate (3-D Secure) can be finished later by the
 * payment webhook with exactly the price that was shown.
 */
export default defineModel({
  name: 'PostPurchaseOfferResponse',
  table: 'post_purchase_offer_responses',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'post_purchase_offer_responses_order_offer_product_unique',
      columns: ['order_id', 'post_purchase_offer_id', 'product_id'],
      unique: true,
    },
  ],

  // Written by `commerce.upsells` on the order's behalf, read by staff.
  ownership: false,

  belongsTo: ['PostPurchaseOffer', 'Order'],

  traits: {
    // No personal attributes of its own: the person is on the order it points at.
    gdpr: { subject: { via: 'Order' }, erasure: 'keep', basis: 'legal_obligation', purpose: 'Order additions, kept for tax and accounting' },
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  attributes: {
    status: {
      order: 1,
      fillable: true,
      required: true,
      validation: { rule: schema.enum(['viewed', 'pending', 'accepted', 'declined', 'failed']).required() },
      factory: () => 'viewed',
    },

    productId: {
      order: 2,
      fillable: true,
      required: true,
      validation: { rule: schema.number().integer().required() },
      factory: () => 1,
    },

    variantId: {
      order: 3,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer() },
    },

    quantity: {
      order: 4,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(1) },
    },

    /** The offer price of one unit, in minor units. */
    unitPrice: {
      order: 5,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(0) },
    },

    /** The regular price of one unit the offer was taken off, in minor units. */
    compareAtPrice: {
      order: 6,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(0) },
    },

    /** `unitPrice * quantity`: what was added to the order. */
    amount: {
      order: 7,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(0) },
    },

    currency: {
      order: 8,
      fillable: true,
      nullable: true,
      validation: { rule: schema.string().max(3) },
    },

    /** The provider's id for the payment (a PaymentIntent), when one was taken. */
    paymentReference: {
      order: 9,
      fillable: true,
      nullable: true,
      validation: { rule: schema.string().max(255) },
    },

    paymentProvider: {
      order: 10,
      fillable: true,
      nullable: true,
      validation: { rule: schema.string().max(64) },
    },

    failureReason: {
      order: 11,
      fillable: true,
      nullable: true,
      validation: { rule: schema.string().max(1000) },
    },

    /** The `order_items` row the acceptance created. */
    orderItemId: {
      order: 12,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer() },
    },

    respondedAt: {
      order: 13,
      fillable: true,
      nullable: true,
      validation: { rule: schema.string() },
    },
  },

  dashboard: { enabled: false },
} as const)
