import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

/**
 * A one-time offer shown after checkout, on the order confirmation page:
 * "Thank you for your purchase! Grab 5+ pairs and get 60% off". The shopper
 * picks a variant and a quantity and adds it to the order they just placed,
 * charged to the payment method they already used, without checking out again.
 *
 * `commerce.upsells` decides which offers an order qualifies for, prices them,
 * claims an acceptance once per order and product, takes the payment and adds
 * the line to the order in one transaction. Responses (views, acceptances,
 * declines) are `PostPurchaseOfferResponse` rows, which is where conversion
 * and revenue come from.
 */
export default defineModel({
  name: 'PostPurchaseOffer',
  table: 'post_purchase_offers',
  primaryKey: 'id',
  autoIncrement: true,

  // Store configuration, managed by staff through `middleware`.
  ownership: false,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'headline', 'discountPercent', 'minQuantity', 'isActive', 'priority'],
      searchable: ['name', 'headline'],
      sortable: ['createdAt', 'updatedAt', 'priority', 'name'],
      filterable: ['isActive'],
    },
    useSeeder: { count: 0 },
    useApi: {
      uri: 'post-purchase-offers',
      middleware: ['auth'],
    },
  },

  hasMany: ['PostPurchaseOfferResponse'],

  attributes: {
    /** For staff: which offer this is in the dashboard. */
    name: {
      order: 1,
      fillable: true,
      required: true,
      validation: { rule: schema.string().required().max(255) },
      factory: () => 'Sock bundle upsell',
    },

    /** The heading over the offer on the confirmation page. */
    headline: {
      order: 2,
      fillable: true,
      nullable: true,
      validation: { rule: schema.string().max(255) },
    },

    /** The offer in the shopper's words: "Grab 5+ pairs and get 60% off". */
    message: {
      order: 3,
      fillable: true,
      nullable: true,
      type: 'text',
      validation: { rule: schema.string().max(2000) },
    },

    /** JSON array of the product ids offered, in the order they are shown. */
    productIds: {
      order: 4,
      fillable: true,
      required: true,
      type: 'text',
      validation: { rule: schema.string().required() },
      factory: () => '[]',
    },

    /** Whole percent off the offered products' prices, 0 to 100. */
    discountPercent: {
      order: 5,
      fillable: true,
      default: 0,
      validation: { rule: schema.number().integer().min(0).max(100) },
      factory: () => 60,
    },

    /** Units a shopper has to take for the offer price. */
    minQuantity: {
      order: 6,
      fillable: true,
      default: 1,
      validation: { rule: schema.number().integer().min(1) },
      factory: () => 5,
    },

    /** What the quantity field starts at. */
    defaultQuantity: {
      order: 7,
      fillable: true,
      default: 1,
      validation: { rule: schema.number().integer().min(1) },
      factory: () => 5,
    },

    /** The most units one acceptance may take. Empty: no ceiling but stock. */
    maxQuantity: {
      order: 8,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(1) },
    },

    /** JSON array of product ids, one of which the order must contain. Empty: any order. */
    triggerProductIds: {
      order: 9,
      fillable: true,
      nullable: true,
      type: 'text',
      validation: { rule: schema.string() },
    },

    /** The order total, in minor units, an order needs to see the offer. */
    minOrderTotal: {
      order: 10,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(0) },
    },

    /** Minutes after the order is placed that the offer stays open. */
    windowMinutes: {
      order: 11,
      fillable: true,
      default: 30,
      validation: { rule: schema.number().integer().min(1) },
      factory: () => 30,
    },

    /** Higher shows first when an order qualifies for several. */
    priority: {
      order: 12,
      fillable: true,
      default: 0,
      validation: { rule: schema.number().integer() },
    },

    isActive: {
      order: 13,
      fillable: true,
      default: true,
      validation: { rule: schema.boolean() },
      factory: () => true,
    },

    startsAt: {
      order: 14,
      fillable: true,
      nullable: true,
      validation: { rule: schema.string() },
    },

    endsAt: {
      order: 15,
      fillable: true,
      nullable: true,
      validation: { rule: schema.string() },
    },
  },

  dashboard: {
    highlight: false,
  },
} as const)
