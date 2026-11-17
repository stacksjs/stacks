import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

/**
 * A discount the storefront applies by itself (automatic) or when a shopper
 * enters its code.
 *
 * Coupons cover the simple case, a code worth a percentage or an amount.
 * This covers the rest of what merchants run: buy X get Y ("buy 4, get 4
 * free"), volume tiers ("5+ pairs 20% off"), free shipping, discounts limited
 * to products, variants or categories, minimums, caps and the rules for which
 * discounts combine. `commerce.discounts.price()` reads these rows and prices a
 * basket with the pure engine in `@stacksjs/commerce/discounts/engine`.
 *
 * Amounts are integer minor units of the store's currency; percentages are
 * plain numbers from 0 to 100.
 */
export default defineModel({
  name: 'Discount',
  table: 'discounts',
  primaryKey: 'id',
  autoIncrement: true,

  // Store configuration: no row has a per-caller owner. Writes are an
  // administrative concern gated by `middleware` (stacksjs/stacks#2375).
  ownership: false,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'title', 'code', 'type', 'value', 'isActive', 'usageCount', 'startsAt', 'endsAt'],
      searchable: ['title', 'code'],
      sortable: ['createdAt', 'updatedAt', 'title', 'usageCount', 'startsAt', 'endsAt'],
      filterable: ['type', 'isActive'],
    },
    useSeeder: { count: 0 },
    useApi: {
      uri: 'discounts',
      middleware: ['auth'],
    },
  },

  attributes: {
    /** What the shopper sees beside the saving: "BUY 4, GET 4 FREE | 50% OFF". */
    title: {
      order: 1,
      fillable: true,
      required: true,
      validation: { rule: schema.string().required().max(255) },
      factory: () => 'BUY 4, GET 4 FREE',
    },

    /** The code a shopper types. Empty makes the discount automatic. */
    code: {
      order: 2,
      fillable: true,
      unique: true,
      nullable: true,
      validation: { rule: schema.string().max(64) },
    },

    type: {
      order: 3,
      fillable: true,
      required: true,
      validation: {
        rule: schema.enum(['percentage', 'fixed_amount', 'buy_x_get_y', 'volume', 'free_shipping']).required(),
      },
      factory: () => 'percentage',
    },

    /** Whole percent off for `percentage`, minor units for `fixed_amount`. */
    value: {
      order: 4,
      fillable: true,
      default: 0,
      validation: { rule: schema.number().integer().min(0) },
      factory: () => 10,
    },

    /** `product` or `order`, for percentage and fixed amounts. Empty: decided by whether a target is set. */
    scope: {
      order: 5,
      fillable: true,
      nullable: true,
      validation: { rule: schema.enum(['product', 'order']) },
    },

    /** A fixed amount off every targeted unit rather than once. */
    perItem: {
      order: 6,
      fillable: true,
      default: false,
      validation: { rule: schema.boolean() },
    },

    /** JSON `{ productIds, variantIds, categoryIds }`: the lines it reaches. Empty reaches every line. */
    target: {
      order: 7,
      fillable: true,
      nullable: true,
      type: 'text',
      validation: { rule: schema.string() },
    },

    buyQuantity: {
      order: 8,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(1) },
    },

    /** JSON target for what must be bought. Empty: `target`. */
    buyTarget: {
      order: 9,
      fillable: true,
      nullable: true,
      type: 'text',
      validation: { rule: schema.string() },
    },

    getQuantity: {
      order: 10,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(1) },
    },

    /** JSON target for what comes discounted. Empty: the buy target. */
    getTarget: {
      order: 11,
      fillable: true,
      nullable: true,
      type: 'text',
      validation: { rule: schema.string() },
    },

    /** Whole percent off each "get" unit: 100 is free. */
    getPercent: {
      order: 12,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(0).max(100) },
    },

    /** Times one order may use a buy X get Y. Empty: unlimited. */
    maxApplications: {
      order: 13,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(1) },
    },

    /** JSON `[{ minQuantity, percent }]` for volume tiers. */
    tiers: {
      order: 14,
      fillable: true,
      nullable: true,
      type: 'text',
      validation: { rule: schema.string() },
    },

    /** Free shipping only applies to a rate at or below this. */
    maxShipping: {
      order: 15,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(0) },
    },

    minimumSubtotal: {
      order: 16,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(0) },
    },

    minimumQuantity: {
      order: 17,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(0) },
    },

    /** The most it takes off one order. */
    maxAmount: {
      order: 18,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(0) },
    },

    combinesWithProduct: {
      order: 19,
      fillable: true,
      default: false,
      validation: { rule: schema.boolean() },
    },

    combinesWithOrder: {
      order: 20,
      fillable: true,
      default: false,
      validation: { rule: schema.boolean() },
    },

    combinesWithShipping: {
      order: 21,
      fillable: true,
      default: false,
      validation: { rule: schema.boolean() },
    },

    usageLimit: {
      order: 22,
      fillable: true,
      nullable: true,
      validation: { rule: schema.number().integer().min(1) },
    },

    usageCount: {
      order: 23,
      fillable: true,
      default: 0,
      validation: { rule: schema.number().integer().min(0) },
    },

    isActive: {
      order: 24,
      fillable: true,
      default: true,
      validation: { rule: schema.boolean() },
      factory: () => true,
    },

    startsAt: {
      order: 25,
      fillable: true,
      nullable: true,
      validation: { rule: schema.string() },
    },

    endsAt: {
      order: 26,
      fillable: true,
      nullable: true,
      validation: { rule: schema.string() },
    },
  },

  dashboard: {
    highlight: false,
  },
} as const)
