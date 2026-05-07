import { config } from '@stacksjs/config'
import { mail, template } from '@stacksjs/email'

export interface OrderConfirmationItem {
  name: string
  qty: number
  lineTotal: number
}

export interface OrderConfirmationOptions {
  to: string
  orderId: number | string
  customerName?: string
  items: OrderConfirmationItem[]
  subtotal: number
  shipping: number
  total: number
  shippingAddress?: string
  /** Absolute URL the receipt CTA should link to (e.g. `/orders/123`). */
  orderUrl: string
}

/**
 * Send the post-checkout receipt email.
 *
 * Uses `resources/emails/order-confirmation.stx` for the layout. The
 * template renders the items table, totals, and a "View your order"
 * CTA back to the storefront. Failures bubble up as rejected
 * promises — the calling action should `.catch()` so a mailer
 * outage doesn't fail the order.
 */
export async function sendOrderConfirmation(options: OrderConfirmationOptions): Promise<void> {
  const appName = config.app.name || 'PetStore'
  const fromAddress = config.email.from?.address || 'hello@stacksjs.com'

  const { html, text } = await template('order-confirmation', {
    variables: {
      orderId: options.orderId,
      orderUrl: options.orderUrl,
      customerName: options.customerName || 'there',
      items: options.items,
      subtotal: options.subtotal,
      shipping: options.shipping,
      total: options.total,
      shippingAddress: options.shippingAddress || '',
      appName,
    },
    subject: `Your ${appName} order #${options.orderId} is confirmed`,
  })

  await mail.send({
    to: [options.to],
    from: { name: appName, address: fromAddress },
    subject: `Your ${appName} order #${options.orderId} is confirmed`,
    html,
    text,
  })
}

export default sendOrderConfirmation
