import type { NotificationTemplateDefinition } from '../templates'

/** Where the commerce messages' buttons lead. */
export interface CommerceNotificationPaths {
  /** The buyer's purchases. Default `/orders`. */
  orders?: string
  /** The seller's view of one order or of their sales. Default `/orders`. */
  sales?: string
}

/**
 * Receipts and money messages, in English and German. Format every amount
 * before passing it (`formatMinor` from `@stacksjs/commerce/money`), so the
 * currency is right; `lines` is the itemized purchase, one line each
 * (`receiptLinesText` from `@stacksjs/commerce/receipt-text`).
 *
 * Variables:
 * - `order_receipt` (to the buyer): `seller`, `lines`, `total`, `order_number`, `date`;
 * - `order_refunded` (to the buyer): `seller`, `amount`, `order_number`;
 * - `new_sale` (to the seller): `buyer`, `item`, `total`, `order_number`;
 * - `account_credit_added` (to the customer): `seller`, `amount`, `reason`, `balance`.
 */
/** The names this catalog defines. */
export type CommerceNotificationTemplateName = 'order_receipt' | 'order_refunded' | 'new_sale' | 'account_credit_added'

export function commerceNotificationTemplates(paths: CommerceNotificationPaths = {}): Record<CommerceNotificationTemplateName, NotificationTemplateDefinition> {
  const orders = paths.orders ?? '/orders'
  const sales = paths.sales ?? '/orders'
  return {
    order_receipt: {
      copy: {
        en: { subject: 'Your receipt from {{seller}}', body: 'Thanks for your purchase from {{seller}}.\n\n{{lines}}\nTotal: {{total}}\n\nOrder {{order_number}}, paid {{date}}.' },
        de: { subject: 'Deine Quittung von {{seller}}', body: 'Danke für deinen Einkauf bei {{seller}}.\n\n{{lines}}\nSumme: {{total}}\n\nBestellung {{order_number}}, bezahlt am {{date}}.' },
      },
      action: { path: orders, label: { en: 'View your purchases', de: 'Deine Käufe ansehen' } },
    },
    order_refunded: {
      copy: {
        en: { subject: 'Refund from {{seller}}: {{amount}}', body: '{{seller}} refunded {{amount}} for order {{order_number}}.\n\nMoney paid by card goes back to that card, which usually takes 5 to 10 business days to show. Anything refunded as account credit is ready for your next purchase.' },
        de: { subject: 'Erstattung von {{seller}}: {{amount}}', body: '{{seller}} hat dir {{amount}} für die Bestellung {{order_number}} erstattet.\n\nPer Karte Bezahltes geht auf diese Karte zurück, was meist 5 bis 10 Werktage dauert. Als Guthaben Erstattetes kannst du bei deinem nächsten Einkauf verwenden.' },
      },
      action: { path: orders, label: { en: 'View your purchases', de: 'Deine Käufe ansehen' } },
    },
    new_sale: {
      copy: {
        en: { subject: 'New sale: {{item}}', body: '{{buyer}} bought {{item}} for {{total}}.\n\nOrder {{order_number}}.' },
        de: { subject: 'Neuer Verkauf: {{item}}', body: '{{buyer}} hat {{item}} für {{total}} gekauft.\n\nBestellung {{order_number}}.' },
      },
      action: { path: sales, label: { en: 'View your sales', de: 'Verkäufe ansehen' } },
    },
    account_credit_added: {
      copy: {
        en: { subject: '{{amount}} credit from {{seller}}', body: '{{seller}} added {{amount}} to your account: {{reason}}\n\nYour balance is now {{balance}}. You can use it on your next purchase.' },
        de: { subject: '{{amount}} Guthaben von {{seller}}', body: '{{seller}} hat deinem Konto {{amount}} gutgeschrieben: {{reason}}\n\nDein Guthaben beträgt jetzt {{balance}}. Du kannst es bei deinem nächsten Einkauf verwenden.' },
      },
    },
  }
}
