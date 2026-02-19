/**
 * Model Events
 *
 * Defines the event types emitted by models during CRUD operations.
 * Each model emits ':created', ':updated', and ':deleted' events
 * with the model's attributes as the payload.
 *
 * These event names use kebab-case to match the model's URL-friendly name.
 * The payload type is Record<string, any> — for precise typing, cast
 * to your model's attribute type at the listener site.
 */
export interface ModelEvents {
  // Content models
  'author:created': Record<string, any>
  'author:updated': Record<string, any>
  'author:deleted': Record<string, any>
  'page:created': Record<string, any>
  'page:updated': Record<string, any>
  'page:deleted': Record<string, any>
  'post:created': Record<string, any>
  'post:updated': Record<string, any>
  'post:deleted': Record<string, any>

  // Core models
  'user:created': Record<string, any>
  'user:updated': Record<string, any>
  'user:deleted': Record<string, any>
  'activity:created': Record<string, any>
  'activity:updated': Record<string, any>
  'activity:deleted': Record<string, any>
  'campaign:created': Record<string, any>
  'campaign:updated': Record<string, any>
  'campaign:deleted': Record<string, any>
  'comment:created': Record<string, any>
  'comment:updated': Record<string, any>
  'comment:deleted': Record<string, any>
  'email-list:created': Record<string, any>
  'email-list:updated': Record<string, any>
  'email-list:deleted': Record<string, any>
  'notification:created': Record<string, any>
  'notification:updated': Record<string, any>
  'notification:deleted': Record<string, any>
  'social-post:created': Record<string, any>
  'social-post:updated': Record<string, any>
  'social-post:deleted': Record<string, any>
  'subscription:created': Record<string, any>
  'subscription:updated': Record<string, any>
  'subscription:deleted': Record<string, any>
  'tag:created': Record<string, any>
  'tag:updated': Record<string, any>
  'tag:deleted': Record<string, any>

  // Commerce models
  'cart:created': Record<string, any>
  'cart:updated': Record<string, any>
  'cart:deleted': Record<string, any>
  'cart-item:created': Record<string, any>
  'cart-item:updated': Record<string, any>
  'cart-item:deleted': Record<string, any>
  'category:created': Record<string, any>
  'category:updated': Record<string, any>
  'category:deleted': Record<string, any>
  'coupon:created': Record<string, any>
  'coupon:updated': Record<string, any>
  'coupon:deleted': Record<string, any>
  'customer:created': Record<string, any>
  'customer:updated': Record<string, any>
  'customer:deleted': Record<string, any>
  'delivery-route:created': Record<string, any>
  'delivery-route:updated': Record<string, any>
  'delivery-route:deleted': Record<string, any>
  'digital-delivery:created': Record<string, any>
  'digital-delivery:updated': Record<string, any>
  'digital-delivery:deleted': Record<string, any>
  'driver:created': Record<string, any>
  'driver:updated': Record<string, any>
  'driver:deleted': Record<string, any>
  'gift-card:created': Record<string, any>
  'gift-card:updated': Record<string, any>
  'gift-card:deleted': Record<string, any>
  'license-key:created': Record<string, any>
  'license-key:updated': Record<string, any>
  'license-key:deleted': Record<string, any>
  'loyalty-point:created': Record<string, any>
  'loyalty-point:updated': Record<string, any>
  'loyalty-point:deleted': Record<string, any>
  'loyalty-reward:created': Record<string, any>
  'loyalty-reward:updated': Record<string, any>
  'loyalty-reward:deleted': Record<string, any>
  'manufacturer:created': Record<string, any>
  'manufacturer:updated': Record<string, any>
  'manufacturer:deleted': Record<string, any>
  'order:created': Record<string, any>
  'order:updated': Record<string, any>
  'order:deleted': Record<string, any>
  'order-item:created': Record<string, any>
  'order-item:updated': Record<string, any>
  'order-item:deleted': Record<string, any>
  'payment:created': Record<string, any>
  'payment:updated': Record<string, any>
  'payment:deleted': Record<string, any>
  'print-device:created': Record<string, any>
  'print-device:updated': Record<string, any>
  'print-device:deleted': Record<string, any>
  'product:created': Record<string, any>
  'product:updated': Record<string, any>
  'product:deleted': Record<string, any>
  'product-unit:created': Record<string, any>
  'product-unit:updated': Record<string, any>
  'product-unit:deleted': Record<string, any>
  'product-variant:created': Record<string, any>
  'product-variant:updated': Record<string, any>
  'product-variant:deleted': Record<string, any>
  'receipt:created': Record<string, any>
  'receipt:updated': Record<string, any>
  'receipt:deleted': Record<string, any>
  'review:created': Record<string, any>
  'review:updated': Record<string, any>
  'review:deleted': Record<string, any>
  'shipping-method:created': Record<string, any>
  'shipping-method:updated': Record<string, any>
  'shipping-method:deleted': Record<string, any>
  'shipping-rate:created': Record<string, any>
  'shipping-rate:updated': Record<string, any>
  'shipping-rate:deleted': Record<string, any>
  'shipping-zone:created': Record<string, any>
  'shipping-zone:updated': Record<string, any>
  'shipping-zone:deleted': Record<string, any>
  'tax-rate:created': Record<string, any>
  'tax-rate:updated': Record<string, any>
  'tax-rate:deleted': Record<string, any>
  'transaction:created': Record<string, any>
  'transaction:updated': Record<string, any>
  'transaction:deleted': Record<string, any>
  'waitlist-product:created': Record<string, any>
  'waitlist-product:updated': Record<string, any>
  'waitlist-product:deleted': Record<string, any>
  'waitlist-restaurant:created': Record<string, any>
  'waitlist-restaurant:updated': Record<string, any>
  'waitlist-restaurant:deleted': Record<string, any>

  // Realtime models
  'websocket:created': Record<string, any>
  'websocket:updated': Record<string, any>
  'websocket:deleted': Record<string, any>
}
