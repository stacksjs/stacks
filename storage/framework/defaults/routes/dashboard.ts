/**
 * Framework Default Routes
 *
 * These routes power the Stacks dashboard and framework features.
 * They are loaded automatically AFTER user-defined routes.
 *
 * Users should NOT edit this file. To override any framework route,
 * simply define the same method + path in your routes/api.ts file.
 * bun-router uses first-registration-wins, and user routes load first,
 * so your custom handler will always take priority.
 *
 * @example Override the login route in routes/api.ts:
 * ```ts
 * route.post('/login', 'Actions/MyCustomLoginAction')
 * ```
 */

import { response, route } from '@stacksjs/router'

// ============================================================================
// Auth Routes
// ============================================================================

route.post('/login', 'Actions/Auth/LoginAction')
route.post('/register', 'Actions/Auth/RegisterAction')
route.get('/generate-registration-options', 'Actions/Auth/GenerateRegistrationAction')
route.post('/verify-registration', 'Actions/Auth/VerifyRegistrationAction')
route.get('/generate-authentication-options', 'Actions/Auth/GenerateAuthenticationAction')
route.get('/verify-authentication', 'Actions/Auth/VerifyAuthenticationAction')

route.group({ prefix: '/auth' }, () => {
  route.post('/refresh', 'Actions/Auth/RefreshTokenAction')
  route.get('/tokens', 'Actions/Auth/ListTokensAction').middleware('auth')
  route.post('/token', 'Actions/Auth/CreateTokenAction').middleware('auth')
  route.delete('/tokens/{id}', 'Actions/Auth/RevokeTokenAction').middleware('auth')
  route.get('/abilities', 'Actions/Auth/TestAbilitiesAction').middleware('auth')
})

route.group({ middleware: 'auth' }, () => {
  route.get('/me', 'Actions/Auth/AuthUserAction')
  route.post('/logout', 'Actions/Auth/LogoutAction')
})

// Password Reset
route.group({ prefix: '/password' }, () => {
  route.post('/forgot', 'Actions/Password/SendPasswordResetEmailAction')
  route.post('/reset', 'Actions/Password/PasswordResetAction')
  route.post('/verify-token', 'Actions/Password/VerifyResetTokenAction')
})

// ============================================================================
// Email
// ============================================================================

// CSRF is skipped for the same reason the storefront cart routes skip
// it: the storefront's email-subscribe form is rendered in static HTML
// without a CSRF token round-trip, and the abuse case (bots inflating
// the subscriber list) is better handled with the rate limiter — at
// the action layer — than with a token check the form can't satisfy.
route.post('/api/email/subscribe', 'Actions/SubscriberEmailAction').name('email.subscribe').skipCsrf()
route.get('/api/email/unsubscribe', 'Actions/UnsubscribeAction').name('email.unsubscribe')
// RFC 8058 one-click endpoint. Mailbox providers (Gmail, Yahoo, Outlook)
// POST here with body `List-Unsubscribe=One-Click` when the user clicks
// the inbox-native unsubscribe affordance — the request never carries a
// CSRF token because the mailbox provider isn't in our session, so skip.
route.post('/api/email/unsubscribe', 'Actions/UnsubscribeAction').name('email.unsubscribe.oneclick').skipCsrf()

// Public contact form. CSRF skipped for the same reason as the
// subscribe endpoint — the form renders without JS — and the outbound
// mailer hop makes rate-limiting essential. Quota is enforced inside
// the action itself.
route.post('/api/contact', 'Actions/ContactAction').name('contact.send').skipCsrf()

// ============================================================================
// Storefront (anonymous cart + multi-step checkout)
//
// CSRF is skipped because the storefront uses progressive-enhancement
// HTML forms — there's no JS to mint a token — and each cart is
// already gated by an opaque, HttpOnly session cookie that can't be
// guessed. Apps that want classic CSRF on top can re-register the
// same routes in their `routes/api.ts` without `.skipCsrf()`.
// ============================================================================

route.get('/api/cart', 'Actions/Storefront/GetCartAction').skipCsrf()
route.post('/api/cart/add', 'Actions/Storefront/AddToCartAction').skipCsrf()
route.post('/api/cart/update', 'Actions/Storefront/UpdateCartItemAction').skipCsrf()
route.post('/api/checkout/contact', 'Actions/Storefront/CheckoutContactAction').skipCsrf()
route.post('/api/checkout/shipping', 'Actions/Storefront/CheckoutShippingAction').skipCsrf()
route.post('/api/checkout/place', 'Actions/Storefront/PlaceOrderAction').skipCsrf()

// Buyer-submitted product review. Tied to a shipped order via
// order_id + email match (the SubmitReviewAction verifies ownership
// and stamps is_verified_purchase=1). Stored as is_approved=0 for
// admin moderation through `/dashboard/commerce/reviews`.
route.post('/api/reviews/submit', 'Actions/Storefront/SubmitReviewAction').skipCsrf()

// ============================================================================
// Health & System
// ============================================================================

route.health()
route.get('/install', 'Actions/InstallAction')
route.get('/test-error', 'Actions/TestErrorAction')

// ============================================================================
// SEO — sitemap.xml + robots.txt
//
// Both are framework defaults so every Stacks app ships discoverable
// out of the box. SitemapAction walks resources/views (skipping
// dynamic [slug] / [...all] pages and private routes like /cart) and
// fans the products table for product detail URLs. RobotsAction emits
// safe defaults — Allow: / plus Disallow on cart/checkout/auth/dashboard.
//
// Apps with stricter rules can re-register either route in routes/api.ts
// against their own action; user routes load before framework defaults
// so the override wins.
// ============================================================================

route.get('/sitemap.xml', 'Actions/SitemapAction')
route.get('/robots.txt', 'Actions/RobotsAction')

// ============================================================================
// AI
// ============================================================================

// `/ai/*` hits the user's configured LLM provider on the server side. Left
// unauthenticated, an attacker can rack up token bills and exfiltrate
// completions. Auth-gate by default; if a userland app intentionally wants
// a public AI endpoint (e.g. a homepage chat widget), it can register the
// route in `routes/api.ts` without the middleware — user routes load before
// framework routes, so the unauthenticated copy wins.
route.group({ middleware: 'auth' }, () => {
  route.post('/ai/ask', 'Actions/AI/AskAction')
  route.post('/ai/summary', 'Actions/AI/SummaryAction')
})

// ============================================================================
// Voide — Voice AI Code Assistant
//
// These endpoints drive the buddy/voice agent: open repos, run AI commits,
// push branches, manage GitHub credentials. Unauthenticated, an attacker
// could open arbitrary local repos and push to the user's GitHub account.
// Always auth-gated.
// ============================================================================

route.group({ prefix: '/voide', middleware: 'auth' }, () => {
  route.get('/state', 'Actions/Buddy/BuddyStateAction')
  route.post('/repo', 'Actions/Buddy/BuddyRepoOpenAction')
  route.post('/repo/validate', 'Actions/Buddy/BuddyRepoValidateAction')
  route.post('/process', 'Actions/Buddy/BuddyProcessAction')
  route.post('/process/stream', 'Actions/Buddy/BuddyProcessStreamAction')
  route.post('/commit', 'Actions/Buddy/BuddyCommitAction')
  route.post('/push', 'Actions/Buddy/BuddyPushAction')
  route.post('/cancel', 'Actions/Buddy/BuddyCancelAction')
  route.post('/browse', 'Actions/Buddy/BuddyBrowseAction')
  route.post('/title', 'Actions/Buddy/BuddyTitleAction')
  route.get('/settings', 'Actions/Buddy/BuddySettingsAction')
  route.post('/settings', 'Actions/Buddy/BuddySettingsUpdateAction')
  route.post('/github/connect', 'Actions/Buddy/BuddyGitHubConnectAction')
  route.post('/github/disconnect', 'Actions/Buddy/BuddyGitHubDisconnectAction')
})

// ============================================================================
// Dashboard
//
// Every dashboard-internal endpoint below is auth-gated. These routes back
// the admin UI and dump operational data (jobs, queues, mailboxes, captured
// transactional emails, error tracking, deployments). Anonymous access here
// would leak password-reset tokens, billing receipts, and PII via the
// inbox / notifications endpoints. The public CMS mirror lives at /blog,
// the newsletter signup lives at /api/email/subscribe — those stay open.
// ============================================================================

route.group({ prefix: '/dashboard', middleware: 'auth' }, () => {
  route.get('/home', 'Actions/Dashboard/DashboardHomeAction')
  route.get('/stats', 'Actions/Dashboard/DashboardStatsAction')
  route.get('/activity', 'Actions/Dashboard/DashboardActivityAction')
  route.get('/health', 'Actions/Dashboard/DashboardHealthAction')
  route.get('/services', 'Actions/Dashboard/ServiceHealthAction')
  route.get('/buddy', 'Actions/Dashboard/BuddyDashboardAction')
  route.get('/actions/list', 'Actions/Dashboard/Actions/GetActions')
  route.get('/settings', 'Actions/Dashboard/Settings/SettingsIndexAction')
  // Dashboard's omnisearch endpoint. Lived at root `/search` until users
  // building a public site discovered it shadowed `resources/views/search.stx`
  // (a registered route always wins over a same-path stx file). Now scoped
  // under /dashboard so userland keeps `/search` for their own pages.
  route.get('/search', 'Actions/Dashboard/Search/GlobalSearchAction')
})

// ============================================================================
// Payments
// ============================================================================

route.group({ prefix: '/payments' }, () => {
  route.get('/fetch-customer/{id}', 'Actions/Payment/FetchPaymentCustomerAction')
  route.get('/fetch-transaction-history/{id}', 'Actions/Payment/FetchTransactionHistoryAction')
  route.get('/fetch-user-subscriptions/{id}', 'Actions/Payment/FetchUserSubscriptionsAction')
  route.get('/fetch-active-subscription/{id}', 'Actions/Payment/FetchActiveSubscriptionAction')
  route.get('/default-payment-method/{id}', 'Actions/Payment/FetchDefaultPaymentMethodAction')
  route.get('/payment-methods/{id}', 'Actions/Payment/FetchPaymentMethodsAction')
  route.get('/create-setup-intent/{id}', 'Actions/Payment/CreateSetupIntentAction')
  route.delete('/delete-payment-method/{id}', 'Actions/Payment/DeleteDefaultPaymentAction')
  route.put('/update-default-payment-method/{id}', 'Actions/Payment/UpdateDefaultPaymentMethodAction')
  route.post('/set-default-payment-method/{id}', 'Actions/Payment/SetDefaultPaymentAction')
  route.post('/user-default-payment-method/{id}', 'Actions/Payment/SetUserDefaultPaymentAction')
  route.post('/payment-method/{id}', 'Actions/Payment/StorePaymentMethodAction')
  route.post('/create-payment-intent/{id}', 'Actions/Payment/CreatePaymentIntentAction')
  route.post('/create-subscription/{id}', 'Actions/Payment/CreateSubscriptionAction')
  route.post('/update-subscription/{id}', 'Actions/Payment/UpdateSubscriptionAction')
  route.post('/cancel-subscription/{id}', 'Actions/Payment/CancelSubscriptionAction')
  route.post('/create-invoice-subscription/{id}', 'Actions/Payment/CreateInvoiceSubscription')
  route.patch('/update-customer/{id}', 'Actions/Payment/UpdateCustomerAction')
  route.post('/checkout/{id}', 'Actions/Payment/CreateCheckoutAction')
  route.get('/fetch-product/{id}', 'Actions/Payment/FetchProductAction')
  route.post('/store-transaction/{id}', 'Actions/Payment/StoreTransactionAction')
})

// ============================================================================
// Queues & Realtime (legacy endpoints)
// ============================================================================

route.group({ prefix: '/queues' }, () => {
  route.get('/', 'Actions/Queue/FetchQueuesAction')
})

route.group({ prefix: '/realtime' }, () => {
  route.get('/websockets', 'Actions/Realtime/FetchWebsocketsAction')
  route.get('/stats', 'Actions/Dashboard/Realtime/RealtimeStatsAction')
})

// ============================================================================
// Query Dashboard
// ============================================================================

route.group({ prefix: '/queries', middleware: 'auth' }, () => {
  route.get('/dashboard', 'Actions/Dashboard/Queries/QueryIndexAction')
  route.get('/stats', 'Controllers/QueryController@getStats')
  route.get('/recent', 'Controllers/QueryController@getRecentQueries')
  route.get('/slow', 'Controllers/QueryController@getSlowQueries')
  route.get('/:id', 'Controllers/QueryController@getQuery')
  route.get('/timeline', 'Controllers/QueryController@getQueryTimeline')
  route.get('/frequent', 'Controllers/QueryController@getFrequentQueries')
  route.post('/prune', 'Controllers/QueryController@pruneQueryLogs')
})

// ============================================================================
// Monitoring / Error Tracking
// ============================================================================

route.group({ prefix: '/monitoring', middleware: 'auth' }, () => {
  route.get('/errors', 'Actions/Monitoring/ErrorIndexAction')
  route.get('/errors/stats', 'Actions/Monitoring/ErrorStatsAction')
  route.get('/errors/timeline', 'Actions/Monitoring/ErrorTimelineAction')
  route.get('/errors/group', 'Actions/Monitoring/ErrorGroupAction')
  route.get('/errors/{id}', 'Actions/Monitoring/ErrorShowAction')
  route.patch('/errors/resolve', 'Actions/Monitoring/ErrorResolveAction')
  route.patch('/errors/ignore', 'Actions/Monitoring/ErrorIgnoreAction')
  route.patch('/errors/unresolve', 'Actions/Monitoring/ErrorUnresolveAction')
  route.delete('/errors', 'Actions/Monitoring/ErrorDestroyAction')
})

// ============================================================================
// CMS / Blog
//
// /cms is the admin surface (auth-gated). /blog below mirrors a subset of
// the same handlers without auth so userland can render a public blog.
// ============================================================================

route.group({ prefix: '/cms', middleware: 'auth' }, () => {
  route.get('/dashboard', 'Actions/Dashboard/Content/ContentDashboardAction')
  route.get('/posts', 'Actions/Cms/PostIndexAction')
  route.get('/posts/{id}', 'Actions/Cms/PostShowAction')
  route.post('/posts', 'Actions/Cms/PostStoreAction')
  route.patch('/posts/{id}', 'Actions/Cms/PostUpdateAction')
  route.delete('/posts/{id}', 'Actions/Cms/PostDestroyAction')
  route.patch('/posts/{id}/views', 'Actions/Cms/PostViewsUpdateAction')

  route.get('/authors', 'Actions/Cms/AuthorIndexAction')
  route.get('/authors/{id}', 'Actions/Cms/AuthorShowAction')
  route.post('/authors', 'Actions/Cms/AuthorStoreAction')
  route.patch('/authors/{id}', 'Actions/Cms/AuthorUpdateAction')
  route.delete('/authors/{id}', 'Actions/Cms/AuthorDestroyAction')

  route.get('/categories', 'Actions/Cms/CategorizableIndexAction')
  route.get('/categories/{id}', 'Actions/Cms/CategorizableShowAction')
  route.post('/categories', 'Actions/Cms/CategorizableStoreAction')
  route.patch('/categories/{id}', 'Actions/Cms/CategorizableUpdateAction')
  route.delete('/categories/{id}', 'Actions/Cms/CategorizableDestroyAction')

  route.get('/tags', 'Actions/Cms/TaggableIndexAction')
  route.get('/tags/{id}', 'Actions/Cms/TaggableShowAction')
  route.post('/tags', 'Actions/Cms/TaggableStoreAction')
  route.patch('/tags/{id}', 'Actions/Cms/TaggableUpdateAction')
  route.delete('/tags/{id}', 'Actions/Cms/TaggableDestroyAction')

  route.get('/comments', 'Actions/Cms/CommentIndexAction')
  route.get('/comments/{id}', 'Actions/Cms/CommentShowAction')
  route.post('/comments', 'Actions/Cms/CommentStoreAction')
  route.patch('/comments/{id}', 'Actions/Cms/CommentUpdateAction')
  route.delete('/comments/{id}', 'Actions/Cms/CommentDestroyAction')

  route.get('/pages', 'Actions/Cms/PageIndexAction')
  route.post('/pages', 'Actions/Cms/PageStoreAction')
  route.patch('/pages/{id}', 'Actions/Cms/PageUpdateAction')
  route.delete('/pages/{id}', 'Actions/Cms/PageDestroyAction')

  route.get('/seo', 'Actions/Dashboard/Content/SeoIndexAction')
  route.get('/files', 'Actions/Dashboard/Content/FileIndexAction')
})

// Public Blog routes
route.group({ prefix: '/blog' }, () => {
  route.get('/posts', 'Actions/Cms/PostIndexAction')
  route.get('/posts/{id}', 'Actions/Cms/PostShowAction')
  route.get('/categories', 'Actions/Cms/CategorizableIndexAction')
  route.get('/tags', 'Actions/Cms/TaggableIndexAction')
  route.get('/feed.xml', 'Actions/Cms/RssFeedAction')
  route.get('/sitemap.xml', 'Actions/Cms/SitemapAction')
})

// ============================================================================
// Commerce
//
// Admin commerce surface — products, orders, customers, etc. Storefront
// flows that need anonymous access (checkout, public product browsing,
// guest carts) should be defined in `routes/api.ts` against the same
// underlying actions, since user routes load before framework routes.
// ============================================================================

route.group({ prefix: '/commerce', middleware: 'auth' }, () => {
  route.get('/dashboard', 'Actions/Dashboard/Commerce/CommerceDashboardAction')
  route.get('/pos', 'Actions/Dashboard/Commerce/PosIndexAction')
  route.get('/products', 'Actions/Commerce/Product/ProductIndexAction')
  route.get('/products/{id}', 'Actions/Commerce/Product/ProductShowAction')
  route.post('/products', 'Actions/Commerce/Product/ProductStoreAction')
  route.patch('/products/{id}', 'Actions/Commerce/Product/ProductUpdateAction')
  route.delete('/products/{id}', 'Actions/Commerce/Product/ProductDestroyAction')

  // Product subresources nested under /products/* to match the
  // frontend composables (defaults/functions/commerce/products/*.ts).
  route.get('/products/{productId}/variants', 'Actions/Commerce/Product/ProductVariantIndexAction')
  route.get('/products/variants', 'Actions/Commerce/Product/ProductVariantIndexAction')
  route.get('/products/variants/{id}', 'Actions/Commerce/Product/ProductVariantShowAction')
  route.post('/products/variants', 'Actions/Commerce/Product/ProductVariantStoreAction')
  route.patch('/products/variants/{id}', 'Actions/Commerce/Product/ProductVariantUpdateAction')
  route.delete('/products/variants/{id}', 'Actions/Commerce/Product/ProductVariantDestroyAction')

  route.get('/products/units', 'Actions/Commerce/Product/ProductUnitIndexAction')
  route.get('/products/units/{id}', 'Actions/Commerce/Product/ProductUnitShowAction')
  route.post('/products/units', 'Actions/Commerce/Product/ProductUnitStoreAction')
  route.delete('/products/units/{id}', 'Actions/Commerce/Product/ProductUnitDestroyAction')

  route.get('/product-categories', 'Actions/Commerce/Product/ProductCategoryIndexAction')
  route.post('/product-categories', 'Actions/Commerce/Product/ProductCategoryStoreAction')

  // Manufacturers — frontend composable hits `/commerce/product-manufacturers`,
  // so the resource name is namespaced to disambiguate from any future
  // standalone manufacturers concept.
  route.get('/product-manufacturers', 'Actions/Commerce/Product/ManufacturerIndexAction')
  route.get('/product-manufacturers/{id}', 'Actions/Commerce/Product/ManufacturerShowAction')
  route.post('/product-manufacturers', 'Actions/Commerce/Product/ManufacturerStoreAction')
  route.patch('/product-manufacturers/{id}', 'Actions/Commerce/Product/ProductManufacturerUpdateAction')
  route.delete('/product-manufacturers/{id}', 'Actions/Commerce/Product/ManufacturerDestroyAction')

  route.get('/orders', 'Actions/Commerce/OrderIndexAction')
  route.get('/orders/{id}', 'Actions/Commerce/OrderShowAction')
  route.post('/orders', 'Actions/Commerce/OrderStoreAction')
  route.patch('/orders/{id}', 'Actions/Commerce/OrderUpdateAction')
  route.delete('/orders/{id}', 'Actions/Commerce/OrderDestroyAction')
  route.get('/orders/export', 'Actions/Commerce/OrderExportAction')

  route.get('/customers', 'Actions/Commerce/CustomerIndexAction')
  route.get('/customers/{id}', 'Actions/Commerce/CustomerShowAction')
  route.post('/customers', 'Actions/Commerce/CustomerStoreAction')
  route.patch('/customers/{id}', 'Actions/Commerce/CustomerUpdateAction')
  route.delete('/customers/{id}', 'Actions/Commerce/CustomerDestroyAction')

  route.get('/coupons', 'Actions/Commerce/CouponIndexAction')
  route.get('/coupons/{id}', 'Actions/Commerce/CouponShowAction')
  route.post('/coupons', 'Actions/Commerce/CouponStoreAction')
  route.patch('/coupons/{id}', 'Actions/Commerce/CouponUpdateAction')
  route.delete('/coupons/{id}', 'Actions/Commerce/CouponDestroyAction')

  route.get('/gift-cards', 'Actions/Commerce/GiftCardIndexAction')
  route.get('/gift-cards/stats', 'Actions/Commerce/GiftCardStatsAction')
  route.get('/gift-cards/{id}', 'Actions/Commerce/GiftCardShowAction')
  route.post('/gift-cards', 'Actions/Commerce/GiftCardStoreAction')
  route.patch('/gift-cards/{id}', 'Actions/Commerce/GiftCardUpdateAction')
  route.patch('/gift-cards/{id}/balance', 'Actions/Commerce/GiftCardUpdateBalanceAction')
  route.delete('/gift-cards/{id}', 'Actions/Commerce/GiftCardDestroyAction')

  route.get('/tax-rates', 'Actions/Commerce/TaxRateIndexAction')
  route.get('/tax-rates/{id}', 'Actions/Commerce/TaxRateShowAction')
  route.post('/tax-rates', 'Actions/Commerce/TaxRateStoreAction')
  route.patch('/tax-rates/{id}', 'Actions/Commerce/TaxRateUpdateAction')
  route.delete('/tax-rates/{id}', 'Actions/Commerce/TaxRateDestroyAction')

  // Reviews are scoped to products — frontend composable hits
  // `/commerce/products/reviews`, not `/commerce/reviews`.
  route.get('/products/reviews', 'Actions/Commerce/ReviewIndexAction')
  route.get('/products/reviews/{id}', 'Actions/Commerce/ReviewShowAction')
  route.post('/products/reviews', 'Actions/Commerce/ReviewStoreAction')
  route.patch('/products/reviews/{id}', 'Actions/Commerce/ReviewUpdateAction')

  route.get('/receipts', 'Actions/Commerce/ReceiptIndexAction')
  route.get('/receipts/{id}', 'Actions/Commerce/ReceiptShowAction')
  route.post('/receipts', 'Actions/Commerce/ReceiptStoreAction')
  route.patch('/receipts/{id}', 'Actions/Commerce/ReceiptUpdateAction')
  route.delete('/receipts/{id}', 'Actions/Commerce/ReceiptDestroyAction')

  route.get('/print-devices', 'Actions/Commerce/PrintDeviceIndexAction')
  route.get('/print-devices/{id}', 'Actions/Commerce/PrintDeviceShowAction')
  route.post('/print-devices', 'Actions/Commerce/PrintDeviceStoreAction')
  route.patch('/print-devices/{id}', 'Actions/Commerce/PrintDeviceUpdateAction')
  route.delete('/print-devices/{id}', 'Actions/Commerce/PrintDeviceDestroyAction')

  route.get('/payment-stats', 'Actions/Commerce/PaymentFetchStatsAction')
  route.get('/payment-trends', 'Actions/Commerce/PaymentMonthlyTrendsAction')
  // Renamed from `/commerce-payments` — that path was double-prefixed
  // because this group already mounts under `/commerce`, so callers
  // hitting `/api/commerce/payments` (which the frontend composable
  // does — see defaults/functions/commerce/payments.ts) were 404ing.
  route.get('/payments', 'Actions/Commerce/PaymentIndexAction')
  route.get('/payments/{id}', 'Actions/Commerce/PaymentShowAction')
  route.post('/payments', 'Actions/Commerce/PaymentStoreAction')
  route.patch('/payments/{id}', 'Actions/Commerce/PaymentUpdateAction')
  route.delete('/payments/{id}', 'Actions/Commerce/PaymentDestroyAction')

  route.get('/waitlist/products', 'Actions/Commerce/WaitlistProductIndexAction')
  route.get('/waitlist/products/analytics', 'Actions/Commerce/WaitlistProductAnalyticsAction')
  route.get('/waitlist/products/status', 'Actions/Commerce/WaitlistProductStatusAction')
  route.get('/waitlist/products/time-series', 'Actions/Commerce/WaitlistProductTimeSeriesAction')
  route.get('/waitlist/products/quantity-distribution', 'Actions/Commerce/WaitlistProductQuantityDistributionAction')
  route.get('/waitlist/products/{id}', 'Actions/Commerce/WaitlistProductShowAction')
  route.post('/waitlist/products', 'Actions/Commerce/WaitlistProductStoreAction')
  route.patch('/waitlist/products/{id}', 'Actions/Commerce/WaitlistProductUpdateAction')
  route.delete('/waitlist/products/{id}', 'Actions/Commerce/WaitlistProductDestroyAction')

  route.get('/waitlist/restaurants', 'Actions/Commerce/WaitlistRestaurantIndexAction')
  route.get('/waitlist/restaurants/dashboard', 'Actions/Commerce/WaitlistRestaurantDashboardAction')
  route.get('/waitlist/restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantShowAction')
  route.post('/waitlist/restaurants', 'Actions/Commerce/WaitlistRestaurantStoreAction')
  route.patch('/waitlist/restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantUpdateAction')
  route.delete('/waitlist/restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantDestroyAction')

  // ----------------------------------------------------------------
  // Shipping (moved from a top-level /shipping group on 2026-05-08).
  // The frontend composables (defaults/functions/commerce/shippings/*.ts)
  // all expect these resources under /commerce/*, so the prior /shipping
  // group was orphaned — every shipping/driver/license/digital call
  // from the dashboard was 404ing. Resource names match the composable
  // file names: shipping-methods/rates/zones, delivery-routes, drivers,
  // digital-deliveries, license-keys.
  // ----------------------------------------------------------------
  route.get('/shipping-methods', 'Actions/Commerce/Shipping/ShippingMethodIndexAction')
  route.get('/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodShowAction')
  route.post('/shipping-methods', 'Actions/Commerce/Shipping/ShippingMethodStoreAction')
  route.patch('/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodUpdateAction')
  route.delete('/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodDestroyAction')

  route.get('/shipping-rates', 'Actions/Commerce/Shipping/ShippingRateIndexAction')
  route.get('/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateShowAction')
  route.post('/shipping-rates', 'Actions/Commerce/Shipping/ShippingRateStoreAction')
  route.patch('/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateUpdateAction')
  route.delete('/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateDestroyAction')

  route.get('/shipping-zones', 'Actions/Commerce/Shipping/ShippingZoneIndexAction')
  route.get('/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneShowAction')
  route.post('/shipping-zones', 'Actions/Commerce/Shipping/ShippingZoneStoreAction')
  route.patch('/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneUpdateAction')
  route.delete('/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneDestroyAction')

  route.get('/delivery-routes', 'Actions/Commerce/Shipping/DeliveryRouteIndexAction')
  route.get('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteShowAction')
  route.post('/delivery-routes', 'Actions/Commerce/Shipping/DeliveryRouteStoreAction')
  route.patch('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteUpdateAction')
  route.delete('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteDestroyAction')

  route.get('/drivers', 'Actions/Commerce/Shipping/DriverIndexAction')
  route.get('/drivers/{id}', 'Actions/Commerce/Shipping/DriverShowAction')
  route.post('/drivers', 'Actions/Commerce/Shipping/DriverStoreAction')
  route.patch('/drivers/{id}', 'Actions/Commerce/Shipping/DriverUpdateAction')

  // Renamed from `/digital` — frontend composable expects `/digital-deliveries`.
  route.get('/digital-deliveries', 'Actions/Commerce/Shipping/DigitalDeliveryIndexAction')
  route.get('/digital-deliveries/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryShowAction')
  route.post('/digital-deliveries', 'Actions/Commerce/Shipping/DigitalDeliveryStoreAction')
  route.patch('/digital-deliveries/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryUpdateAction')
  route.delete('/digital-deliveries/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryDestroyAction')

  route.get('/license-keys', 'Actions/Commerce/Shipping/LicenseKeyIndexAction')
  route.get('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyShowAction')
  route.post('/license-keys', 'Actions/Commerce/Shipping/LicenseKeyStoreAction')
  route.patch('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyUpdateAction')
  route.delete('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyDestroyAction')
})

// ============================================================================
// Analytics
// ============================================================================

route.group({ prefix: '/analytics', middleware: 'auth' }, () => {
  route.get('/sales', 'Actions/Dashboard/Analytics/SalesAnalyticsAction')
  route.get('/web', 'Actions/Dashboard/Analytics/WebAnalyticsAction')
  route.get('/blog', 'Actions/Dashboard/Analytics/BlogAnalyticsAction')
  route.get('/browsers', 'Actions/Dashboard/Analytics/BrowserAnalyticsAction')
  route.get('/countries', 'Actions/Dashboard/Analytics/CountryAnalyticsAction')
  route.get('/devices', 'Actions/Dashboard/Analytics/DeviceAnalyticsAction')
  route.get('/events', 'Actions/Dashboard/Analytics/EventAnalyticsAction')
  route.get('/marketing', 'Actions/Dashboard/Analytics/MarketingAnalyticsAction')
  route.get('/pages', 'Actions/Dashboard/Analytics/PageAnalyticsAction')
  route.get('/referrers', 'Actions/Dashboard/Analytics/ReferrerAnalyticsAction')
  route.get('/commerce', 'Actions/Dashboard/Analytics/CommerceAnalyticsAction')
})

// ============================================================================
// Jobs & Queue
// ============================================================================

route.group({ prefix: '/jobs', middleware: 'auth' }, () => {
  route.get('/', 'Actions/Dashboard/Jobs/JobIndexAction')
  route.get('/stats', 'Actions/Dashboard/Jobs/JobStatsAction')
  route.post('/{id}/retry', 'Actions/Dashboard/Jobs/JobRetryAction')
})

route.group({ prefix: '/queue', middleware: 'auth' }, () => {
  route.get('/stats', 'Actions/Dashboard/Queue/QueueStatsAction')
  route.get('/workers', 'Actions/Dashboard/Queue/QueueWorkersAction')
  route.post('/retry-failed', 'Actions/Dashboard/Queue/QueueRetryFailedAction')
})

// ============================================================================
// Inbox — captured transactional emails (log driver)
//
// Auth-gated: the rendered email body can include reset links, billing
// receipts, and PII. Treat as sensitive even though the log driver is
// "dev-only" — staging environments are still real.
// ============================================================================

route.group({ prefix: '/inbox', middleware: 'auth' }, () => {
  route.get('/', 'Actions/Dashboard/Inbox/InboxIndexAction')
  route.get('/{id}', 'Actions/Dashboard/Inbox/InboxShowAction')
})

// ============================================================================
// Releases
// ============================================================================

route.group({ prefix: '/releases', middleware: 'auth' }, () => {
  route.get('/', 'Actions/Dashboard/Releases/ReleaseIndexAction')
  route.get('/stats', 'Actions/Dashboard/Releases/ReleaseIndexAction')
})

// ============================================================================
// Settings
// ============================================================================

route.group({ prefix: '/settings', middleware: 'auth' }, () => {
  route.get('/mail', 'Actions/Dashboard/Settings/MailSettingsGetAction')
  route.put('/mail', 'Actions/Dashboard/Settings/MailSettingsUpdateAction')
})

// ============================================================================
// Data Management
// ============================================================================

route.group({ prefix: '/data', middleware: 'auth' }, () => {
  route.get('/dashboard', 'Actions/Dashboard/Data/DataDashboardAction')
  route.get('/access-tokens', 'Actions/Dashboard/Data/AccessTokenIndexAction')
  route.get('/subscribers', 'Actions/Dashboard/Data/SubscriberIndexAction')
  route.get('/teams', 'Actions/Dashboard/Data/TeamIndexAction')
  route.get('/users', 'Actions/Dashboard/Data/UserIndexAction')
  route.get('/activity', 'Actions/Dashboard/Data/ActivityIndexAction')
})

// ============================================================================
// Infrastructure
// ============================================================================

route.group({ prefix: '/infrastructure', middleware: 'auth' }, () => {
  route.get('/commands', 'Actions/Dashboard/Infrastructure/CommandIndexAction')
  route.get('/requests', 'Actions/Dashboard/Infrastructure/RequestIndexAction')
  route.get('/servers', 'Actions/Dashboard/Infrastructure/ServerIndexAction')
  route.get('/dns', 'Actions/Dashboard/Infrastructure/DnsIndexAction')
  route.get('/environment', 'Actions/Dashboard/Infrastructure/EnvironmentIndexAction')
  route.get('/logs', 'Actions/Dashboard/Infrastructure/LogIndexAction')
  route.get('/mailboxes', 'Actions/Dashboard/Infrastructure/MailboxIndexAction')
  route.get('/permissions', 'Actions/Dashboard/Infrastructure/PermissionIndexAction')
  route.get('/insights', 'Actions/Dashboard/Infrastructure/InsightsAction')
  route.get('/cloud', 'Actions/Dashboard/Cloud/CloudIndexAction')
})

route.get('/serverless', 'Actions/Dashboard/Cloud/CloudIndexAction').middleware('auth')

// ============================================================================
// Dashboard Views — Commerce
// ============================================================================

route.group({ prefix: '/dashboard/commerce', middleware: 'auth' }, () => {
  route.get('/customers', 'Actions/Dashboard/Commerce/CommerceCustomersAction')
  route.get('/orders', 'Actions/Dashboard/Commerce/CommerceOrdersAction')
  route.get('/products', 'Actions/Dashboard/Commerce/CommerceProductsAction')
  route.get('/coupons', 'Actions/Dashboard/Commerce/CommerceCouponsAction')
  route.get('/gift-cards', 'Actions/Dashboard/Commerce/CommerceGiftCardsAction')
  route.get('/payments', 'Actions/Dashboard/Commerce/CommercePaymentsAction')
  route.get('/delivery', 'Actions/Dashboard/Commerce/CommerceDeliveryAction')
  route.get('/taxes', 'Actions/Dashboard/Commerce/CommerceTaxesAction')
  route.get('/reviews', 'Actions/Dashboard/Commerce/ReviewIndexAction')
})

// ============================================================================
// Dashboard Views — CMS Content
// ============================================================================

route.group({ prefix: '/dashboard/cms', middleware: 'auth' }, () => {
  route.get('/posts', 'Actions/Dashboard/Content/PostIndexAction')
  route.get('/pages', 'Actions/Dashboard/Content/PageIndexAction')
  route.get('/categories', 'Actions/Dashboard/Content/CategoryIndexAction')
  route.get('/tags', 'Actions/Dashboard/Content/TagIndexAction')
  route.get('/comments', 'Actions/Dashboard/Content/CommentIndexAction')
  route.get('/authors', 'Actions/Dashboard/Content/AuthorIndexAction')
})

// ============================================================================
// Marketing
// ============================================================================

route.group({ prefix: '/marketing', middleware: 'auth' }, () => {
  route.get('/campaigns', 'Actions/Dashboard/Marketing/CampaignIndexAction')
  route.get('/lists', 'Actions/Dashboard/Marketing/ListIndexAction')
  route.get('/social-posts', 'Actions/Dashboard/Marketing/SocialPostIndexAction')
})

// ============================================================================
// Notifications
// ============================================================================

route.group({ prefix: '/notifications', middleware: 'auth' }, () => {
  route.get('/dashboard', 'Actions/Dashboard/Notifications/NotificationDashboardAction')
  route.get('/email', 'Actions/Dashboard/Notifications/NotificationDashboardAction')
  route.get('/sms', 'Actions/Dashboard/Notifications/NotificationDashboardAction')
  route.get('/history', 'Actions/Dashboard/Notifications/NotificationDashboardAction')
})

// ============================================================================
// Library & Packages
// ============================================================================

route.group({ prefix: '/library', middleware: 'auth' }, () => {
  route.get('/dependencies', 'Actions/Dashboard/Library/DependencyIndexAction')
  route.get('/packages', 'Actions/Dashboard/Library/PackageIndexAction')
  route.get('/functions', 'Actions/Dashboard/Library/GetFunctions')
  route.get('/functions/downloads', 'Actions/Dashboard/Library/GetFunctionsDownloadCount')
  route.post('/functions', 'Actions/Dashboard/Library/CreateFunction')
  route.get('/components', 'Actions/Dashboard/Library/GetComponents')
  route.get('/components/downloads', 'Actions/Dashboard/Library/GetComponentsDownloadCount')
  route.post('/components', 'Actions/Dashboard/Library/CreateComponent')
  route.get('/releases', 'Actions/Dashboard/Library/GetReleases')
  route.get('/releases/count', 'Actions/Dashboard/Library/GetReleaseCount')
  route.get('/releases/avg-time', 'Actions/Dashboard/Library/GetAverageReleaseTime')
  route.get('/downloads', 'Actions/Dashboard/Library/GetDownloadCount')
})

// ============================================================================
// Deployments
// ============================================================================

route.group({ prefix: '/deployments', middleware: 'auth' }, () => {
  route.get('/', 'Actions/Dashboard/Deployments/GetDeployments')
  route.get('/count', 'Actions/Dashboard/Deployments/GetDeploymentCount')
  route.get('/recent', 'Actions/Dashboard/Deployments/GetRecentDeployments')
  route.get('/avg-time', 'Actions/Dashboard/Deployments/GetAverageDeploymentTime')
  route.post('/', 'Actions/Dashboard/Deployments/CreateDeployment')
  route.get('/script', 'Actions/Dashboard/Deployments/GetDeployScript')
  route.put('/script', 'Actions/Dashboard/Deployments/UpdateDeployScript')
  route.get('/terminal', 'Actions/Dashboard/Deployments/GetDeploymentLiveTerminalOutput')
})

// ============================================================================
// Models
// ============================================================================

route.group({ prefix: '/models', middleware: 'auth' }, () => {
  route.get('/', 'Actions/Dashboard/Models/GetModels')
  route.get('/user-count', 'Actions/Dashboard/Models/GetUserCount')
  route.get('/subscriber-count', 'Actions/Dashboard/Models/GetSubscriberCount')
})
