import { config } from '@stacksjs/config'
import { escapeHtml, mail, safe, template } from '@stacksjs/email'

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
      // A template variable is a scalar - an array would be interpolated as
      // "[object Object],[object Object]". The rows are rendered here and
      // marked safe, with every value the customer supplied escaped first.
      itemRows: safe(renderItemRows(options.items)),
      subtotal: options.subtotal,
      shipping: options.shipping,
      total: options.total,
      shippingAddress: options.shippingAddress || '',
      appName,
    },
    subject: `Your ${appName} order #${options.orderId} is confirmed`,
  })

  await mail.sendOrFail({
    to: [options.to],
    from: { name: appName, address: fromAddress },
    subject: `Your ${appName} order #${options.orderId} is confirmed`,
    html,
    text,
  })
}

function formatMoney(amount: number): string {
  return (amount / 100).toFixed(2)
}

function renderItemRows(items: OrderConfirmationItem[]): string {
  return items
    .map(item => `<tr>
      <td style="padding: 12px 0; color: #d4d4d4; font-size: 15px;">${escapeHtml(item.name)} &times; ${Number(item.qty) || 0}</td>
      <td style="padding: 12px 0; color: #ececec; font-size: 15px; text-align: right;">${formatMoney(Number(item.lineTotal) || 0)}</td>
    </tr>`)
    .join('\n')
}

export default sendOrderConfirmation
