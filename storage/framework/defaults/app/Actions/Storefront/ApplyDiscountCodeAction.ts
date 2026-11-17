import type { DiscountRule } from '@stacksjs/commerce/discounts/engine'
import type { StorefrontLine } from '../../Storefront/StorefrontPricing'
import { Action } from '@stacksjs/actions/runtime'
import { discounts } from '@stacksjs/commerce'
import { db } from '@stacksjs/database/runtime'
import { refuse } from '@stacksjs/router'
import { readCartCookie } from '../../Storefront/CartCookie'
import { DISCOUNT_CODE_MESSAGES } from '../../Storefront/DiscountCodeMessages'
import { storefrontCurrency } from '../../Storefront/StorefrontMoney'
import { priceStorefront } from '../../Storefront/StorefrontPricing'

const CART_COOKIE = 'stacks_cart'

/**
 * The cart's discount code field: apply a code, or take it off (`remove`).
 *
 * A code is priced against the cart before it is kept, so the shopper hears
 * straight away that it has expired or does not reach anything in the cart,
 * in the engine's terms (`rejectedCodes`). It is checked again when the order
 * is placed. One code per cart; applying another replaces it.
 */
export default new Action({
  name: 'ApplyDiscountCodeAction',
  description: 'Apply or remove the discount code on the caller\'s cart.',
  method: 'POST',
  notice: (result: { code: string | null }) => result.code ? `Discount code ${result.code} applied.` : 'Discount code removed.',

  async handle(request: any) {
    const token = readCartCookie(request, CART_COOKIE)
    const cart = token
      ? await (db as any).selectFrom('carts').where('session_token', '=', token).where('status', '=', 'active').selectAll().executeTakeFirst()
      : null
    if (!cart)
      return refuse('Your cart is empty.', { status: 400 })

    const remove = String(request.get('remove') ?? '') !== ''
    const code = String(request.get('code') ?? '').trim()

    if (remove || code === '') {
      await (db as any).updateTable('carts').set({ discount_code: null }).where('id', '=', cart.id).execute()
      return { ok: true, code: null }
    }

    if (code.length > 64)
      return refuse(DISCOUNT_CODE_MESSAGES['not-found'], { field: 'code' })

    const items = await (db as any).selectFrom('cart_items').where('cart_id', '=', cart.id).selectAll().execute()
    const lines: StorefrontLine[] = []
    for (const item of items) {
      const product = await (db as any).selectFrom('products').where('slug', '=', item.product_sku).selectAll().executeTakeFirst()
      if (!product)
        continue
      lines.push({
        id: Number(item.id),
        productId: Number(product.id),
        categoryId: product.category_id == null ? null : Number(product.category_id),
        quantity: Number(item.quantity),
        unitPrice: Math.round(Number(item.unit_price)),
      })
    }
    if (lines.length === 0)
      return refuse('Your cart is empty.', { status: 400 })

    let rules: DiscountRule[] = []
    try {
      rules = await discounts.fetchRules({ codes: [code] })
    }
    catch {
      return refuse('Discount codes are not available right now.', { field: 'code' })
    }

    const priced = priceStorefront(lines, rules, storefrontCurrency(cart.currency), new Date(), [code])
    const rejected = priced.result.rejectedCodes.find(r => r.code.toUpperCase() === code.toUpperCase())
    if (rejected)
      return refuse(DISCOUNT_CODE_MESSAGES[rejected.reason], { field: 'code' })

    // Kept as the store spells it, so the cart shows the code it knows.
    const applied = priced.result.applied.find(a => a.code?.toUpperCase() === code.toUpperCase())
    const stored = applied?.code ?? code
    await (db as any).updateTable('carts').set({ discount_code: stored }).where('id', '=', cart.id).execute()
    return { ok: true, code: stored, discount: priced.discount, total: priced.total }
  },
})
