/* eslint-disable */
/* prettier-ignore */
// @ts-nocheck
// Generated by unplugin-vue-router. \u203C\uFE0F DO NOT MODIFY THIS FILE \u203C\uFE0F
// It's recommended to commit this file.
// Make sure to add this file to your tsconfig.json file as an "includes" or "files" entry.

declare module 'vue-router/auto-routes' {
  import type {
    RouteRecordInfo,
    ParamValue,
    ParamValueOneOrMore,
    ParamValueZeroOrMore,
    ParamValueZeroOrOne,
  } from 'vue-router'

  /**
   * Route name map generated by unplugin-vue-router
   */
  export interface RouteNamedMap {
    '/': RouteRecordInfo<'/', '/', Record<never, never>, Record<never, never>>,
    '/access-tokens/': RouteRecordInfo<'/access-tokens/', '/access-tokens', Record<never, never>, Record<never, never>>,
    '/actions/': RouteRecordInfo<'/actions/', '/actions', Record<never, never>, Record<never, never>>,
    '/blog/': RouteRecordInfo<'/blog/', '/blog', Record<never, never>, Record<never, never>>,
    '/blog/authors/': RouteRecordInfo<'/blog/authors/', '/blog/authors', Record<never, never>, Record<never, never>>,
    '/blog/categories/': RouteRecordInfo<'/blog/categories/', '/blog/categories', Record<never, never>, Record<never, never>>,
    '/blog/comments/': RouteRecordInfo<'/blog/comments/', '/blog/comments', Record<never, never>, Record<never, never>>,
    '/blog/posts/': RouteRecordInfo<'/blog/posts/', '/blog/posts', Record<never, never>, Record<never, never>>,
    '/blog/seo/': RouteRecordInfo<'/blog/seo/', '/blog/seo', Record<never, never>, Record<never, never>>,
    '/blog/tags/': RouteRecordInfo<'/blog/tags/', '/blog/tags', Record<never, never>, Record<never, never>>,
    '/buddy/': RouteRecordInfo<'/buddy/', '/buddy', Record<never, never>, Record<never, never>>,
    '/cloud/': RouteRecordInfo<'/cloud/', '/cloud', Record<never, never>, Record<never, never>>,
    '/commands/': RouteRecordInfo<'/commands/', '/commands', Record<never, never>, Record<never, never>>,
    '/commerce/': RouteRecordInfo<'/commerce/', '/commerce', Record<never, never>, Record<never, never>>,
    '/commerce/analytics/': RouteRecordInfo<'/commerce/analytics/', '/commerce/analytics', Record<never, never>, Record<never, never>>,
    '/commerce/categories/': RouteRecordInfo<'/commerce/categories/', '/commerce/categories', Record<never, never>, Record<never, never>>,
    '/commerce/coupons/': RouteRecordInfo<'/commerce/coupons/', '/commerce/coupons', Record<never, never>, Record<never, never>>,
    '/commerce/customers/': RouteRecordInfo<'/commerce/customers/', '/commerce/customers', Record<never, never>, Record<never, never>>,
    '/commerce/delivery/': RouteRecordInfo<'/commerce/delivery/', '/commerce/delivery', Record<never, never>, Record<never, never>>,
    '/commerce/delivery/delivery-routes': RouteRecordInfo<'/commerce/delivery/delivery-routes', '/commerce/delivery/delivery-routes', Record<never, never>, Record<never, never>>,
    '/commerce/delivery/digital-delivery': RouteRecordInfo<'/commerce/delivery/digital-delivery', '/commerce/delivery/digital-delivery', Record<never, never>, Record<never, never>>,
    '/commerce/delivery/drivers': RouteRecordInfo<'/commerce/delivery/drivers', '/commerce/delivery/drivers', Record<never, never>, Record<never, never>>,
    '/commerce/delivery/license-keys': RouteRecordInfo<'/commerce/delivery/license-keys', '/commerce/delivery/license-keys', Record<never, never>, Record<never, never>>,
    '/commerce/delivery/shipping-methods': RouteRecordInfo<'/commerce/delivery/shipping-methods', '/commerce/delivery/shipping-methods', Record<never, never>, Record<never, never>>,
    '/commerce/delivery/shipping-rates': RouteRecordInfo<'/commerce/delivery/shipping-rates', '/commerce/delivery/shipping-rates', Record<never, never>, Record<never, never>>,
    '/commerce/delivery/shipping-zones': RouteRecordInfo<'/commerce/delivery/shipping-zones', '/commerce/delivery/shipping-zones', Record<never, never>, Record<never, never>>,
    '/commerce/gift-cards/': RouteRecordInfo<'/commerce/gift-cards/', '/commerce/gift-cards', Record<never, never>, Record<never, never>>,
    '/commerce/manufacturers/': RouteRecordInfo<'/commerce/manufacturers/', '/commerce/manufacturers', Record<never, never>, Record<never, never>>,
    '/commerce/orders/': RouteRecordInfo<'/commerce/orders/', '/commerce/orders', Record<never, never>, Record<never, never>>,
    '/commerce/payments/': RouteRecordInfo<'/commerce/payments/', '/commerce/payments', Record<never, never>, Record<never, never>>,
    '/commerce/products/': RouteRecordInfo<'/commerce/products/', '/commerce/products', Record<never, never>, Record<never, never>>,
    '/commerce/products/detail': RouteRecordInfo<'/commerce/products/detail', '/commerce/products/detail', Record<never, never>, Record<never, never>>,
    '/commerce/reviews/': RouteRecordInfo<'/commerce/reviews/', '/commerce/reviews', Record<never, never>, Record<never, never>>,
    '/commerce/taxes/': RouteRecordInfo<'/commerce/taxes/', '/commerce/taxes', Record<never, never>, Record<never, never>>,
    '/commerce/units/': RouteRecordInfo<'/commerce/units/', '/commerce/units', Record<never, never>, Record<never, never>>,
    '/commerce/variants/': RouteRecordInfo<'/commerce/variants/', '/commerce/variants', Record<never, never>, Record<never, never>>,
    '/commerce/waitlist/products': RouteRecordInfo<'/commerce/waitlist/products', '/commerce/waitlist/products', Record<never, never>, Record<never, never>>,
    '/commerce/waitlist/restaurant': RouteRecordInfo<'/commerce/waitlist/restaurant', '/commerce/waitlist/restaurant', Record<never, never>, Record<never, never>>,
    '/components/': RouteRecordInfo<'/components/', '/components', Record<never, never>, Record<never, never>>,
    '/dependencies/': RouteRecordInfo<'/dependencies/', '/dependencies', Record<never, never>, Record<never, never>>,
    '/deployments/': RouteRecordInfo<'/deployments/', '/deployments', Record<never, never>, Record<never, never>>,
    '/deployments/[id]': RouteRecordInfo<'/deployments/[id]', '/deployments/:id', { id: ParamValue<true> }, { id: ParamValue<false> }>,
    '/dns/': RouteRecordInfo<'/dns/', '/dns', Record<never, never>, Record<never, never>>,
    '/environment/': RouteRecordInfo<'/environment/', '/environment', Record<never, never>, Record<never, never>>,
    '/errors/': RouteRecordInfo<'/errors/', '/errors', Record<never, never>, Record<never, never>>,
    '/functions/': RouteRecordInfo<'/functions/', '/functions', Record<never, never>, Record<never, never>>,
    '/health/': RouteRecordInfo<'/health/', '/health', Record<never, never>, Record<never, never>>,
    '/inbox/': RouteRecordInfo<'/inbox/', '/inbox', Record<never, never>, Record<never, never>>,
    '/inbox/activity': RouteRecordInfo<'/inbox/activity', '/inbox/activity', Record<never, never>, Record<never, never>>,
    '/inbox/settings': RouteRecordInfo<'/inbox/settings', '/inbox/settings', Record<never, never>, Record<never, never>>,
    '/insights/': RouteRecordInfo<'/insights/', '/insights', Record<never, never>, Record<never, never>>,
    '/jobs/': RouteRecordInfo<'/jobs/', '/jobs', Record<never, never>, Record<never, never>>,
    '/jobs/[id]': RouteRecordInfo<'/jobs/[id]', '/jobs/:id', { id: ParamValue<true> }, { id: ParamValue<false> }>,
    '/jobs/history': RouteRecordInfo<'/jobs/history', '/jobs/history', Record<never, never>, Record<never, never>>,
    '/logs/': RouteRecordInfo<'/logs/', '/logs', Record<never, never>, Record<never, never>>,
    '/mailboxes/': RouteRecordInfo<'/mailboxes/', '/mailboxes', Record<never, never>, Record<never, never>>,
    '/marketing/campaigns/': RouteRecordInfo<'/marketing/campaigns/', '/marketing/campaigns', Record<never, never>, Record<never, never>>,
    '/marketing/lists/': RouteRecordInfo<'/marketing/lists/', '/marketing/lists', Record<never, never>, Record<never, never>>,
    '/marketing/social-posts/': RouteRecordInfo<'/marketing/social-posts/', '/marketing/social-posts', Record<never, never>, Record<never, never>>,
    '/models/': RouteRecordInfo<'/models/', '/models', Record<never, never>, Record<never, never>>,
    '/models/subscribers': RouteRecordInfo<'/models/subscribers', '/models/subscribers', Record<never, never>, Record<never, never>>,
    '/models/teams': RouteRecordInfo<'/models/teams', '/models/teams', Record<never, never>, Record<never, never>>,
    '/models/users': RouteRecordInfo<'/models/users', '/models/users', Record<never, never>, Record<never, never>>,
    '/notifications/': RouteRecordInfo<'/notifications/', '/notifications', Record<never, never>, Record<never, never>>,
    '/notifications/history': RouteRecordInfo<'/notifications/history', '/notifications/history', Record<never, never>, Record<never, never>>,
    '/packages/': RouteRecordInfo<'/packages/', '/packages', Record<never, never>, Record<never, never>>,
    '/queue/': RouteRecordInfo<'/queue/', '/queue', Record<never, never>, Record<never, never>>,
    '/realtime/': RouteRecordInfo<'/realtime/', '/realtime', Record<never, never>, Record<never, never>>,
    '/releases/': RouteRecordInfo<'/releases/', '/releases', Record<never, never>, Record<never, never>>,
    '/requests/': RouteRecordInfo<'/requests/', '/requests', Record<never, never>, Record<never, never>>,
    '/serverless/': RouteRecordInfo<'/serverless/', '/serverless', Record<never, never>, Record<never, never>>,
    '/servers/': RouteRecordInfo<'/servers/', '/servers', Record<never, never>, Record<never, never>>,
    '/servers/[id]': RouteRecordInfo<'/servers/[id]', '/servers/:id', { id: ParamValue<true> }, { id: ParamValue<false> }>,
    '/settings/billing': RouteRecordInfo<'/settings/billing', '/settings/billing', Record<never, never>, Record<never, never>>,
    '/settings/mail': RouteRecordInfo<'/settings/mail', '/settings/mail', Record<never, never>, Record<never, never>>,
    '/teams/[id]': RouteRecordInfo<'/teams/[id]', '/teams/:id', { id: ParamValue<true> }, { id: ParamValue<false> }>,
  }
}
