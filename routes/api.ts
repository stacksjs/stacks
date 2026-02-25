import { response, route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered. Last but
 * not least, you may also create any other `routes/*.ts` files.
 *
 * @see https://docs.stacksjs.com/routing
 */

route.get('/foo/bar/{id}', () => response.text('hello world, foo bar')) // $API_URL/hello/world
route.get('/', () => response.text('hello world')) // $API_URL
route.get('/hello/world', () => response.text('hello world, buddy')) // $API_URL/hello/world
route.get('/json', () => response.json({ message: 'Hello JSON!', status: 'ok', timestamp: Date.now() }))

// Email subscription & unsubscribe endpoints
route.post('/api/email/subscribe', 'Actions/SubscriberEmailAction').name('email.subscribe')
route.get('/api/email/unsubscribe', 'Actions/UnsubscribeAction').name('email.unsubscribe')
route.post('/login', 'Actions/Auth/LoginAction')
route.post('/register', 'Actions/Auth/RegisterAction')
route.get('/generate-registration-options', 'Actions/Auth/GenerateRegistrationAction')
route.post('/verify-registration', 'Actions/Auth/VerifyRegistrationAction')
route.get('/generate-authentication-options', 'Actions/Auth/GenerateAuthenticationAction')
route.get('/verify-authentication', 'Actions/Auth/VerifyAuthenticationAction')

// Token management routes
route.group({ prefix: '/auth' }, () => {
  // Public - refresh token (no auth middleware needed)
  route.post('/refresh', 'Actions/Auth/RefreshTokenAction')

  // Protected - requires authentication
  route.get('/tokens', 'Actions/Auth/ListTokensAction').middleware('auth')
  route.post('/token', 'Actions/Auth/CreateTokenAction').middleware('auth')
  route.delete('/tokens/{id}', 'Actions/Auth/RevokeTokenAction').middleware('auth')
  route.get('/abilities', 'Actions/Auth/TestAbilitiesAction').middleware('auth')
})

route.get('/coming-soon', 'Controllers/ComingSoonController@index')

// route.email('/welcome')
route.health() // adds a GET `/health` route

// Test error page (development only)
route.get('/test-error', 'Actions/TestErrorAction') // Visit /test-error?type=database|validation|auth|notfound|generic
route.get('/install', 'Actions/InstallAction')
route.post('/ai/ask', 'Actions/AI/AskAction')
route.post('/ai/summary', 'Actions/AI/SummaryAction')

// Voide - Voice AI Code Assistant routes (Voice + Claude)
route.group({ prefix: '/voide' }, () => {
  route.get('/state', 'Actions/Buddy/BuddyStateAction')
  route.post('/repo', 'Actions/Buddy/BuddyRepoOpenAction')
  route.post('/repo/validate', 'Actions/Buddy/BuddyRepoValidateAction')
  route.post('/process', 'Actions/Buddy/BuddyProcessAction')
  route.post('/process/stream', 'Actions/Buddy/BuddyProcessStreamAction') // SSE streaming endpoint
  route.post('/commit', 'Actions/Buddy/BuddyCommitAction')
  route.post('/push', 'Actions/Buddy/BuddyPushAction')
  route.post('/cancel', 'Actions/Buddy/BuddyCancelAction')
  route.post('/browse', 'Actions/Buddy/BuddyBrowseAction')
  route.post('/title', 'Actions/Buddy/BuddyTitleAction') // Generate chat title from prompt
  route.get('/settings', 'Actions/Buddy/BuddySettingsAction')
  route.post('/settings', 'Actions/Buddy/BuddySettingsUpdateAction')
  route.post('/github/connect', 'Actions/Buddy/BuddyGitHubConnectAction')
  route.post('/github/disconnect', 'Actions/Buddy/BuddyGitHubDisconnectAction')
})  

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

route.group({ prefix: '/queues' }, () => {
  route.get('/', 'Actions/Queue/FetchQueuesAction')
})

route.group({ prefix: '/realtime' }, () => {
  route.get('/websockets', 'Actions/Realtime/FetchWebsocketsAction')
})

// Password Reset routes
route.group({ prefix: '/password' }, () => {
  route.post('/forgot', 'Actions/Password/SendPasswordResetEmailAction')
  route.post('/reset', 'Actions/Password/PasswordResetAction')
  route.post('/verify-token', 'Actions/Password/VerifyResetTokenAction')
})

// route.action('/example') // equivalent to `route.get('/example', 'ExampleAction')`
// route.action('Dashboard/GetProjects')
// route.action('Dashboard/Settings/UpdateAiConfig')
// route.job('/example-two') // equivalent to `route.get('/example-two', 'ExampleTwoJob')`

// Query Dashboard routes
route.group({ prefix: '/queries' }, () => {
  route.get('/stats', 'Controllers/QueryController@getStats')
  route.get('/recent', 'Controllers/QueryController@getRecentQueries')
  route.get('/slow', 'Controllers/QueryController@getSlowQueries')
  route.get('/:id', 'Controllers/QueryController@getQuery')
  route.get('/timeline', 'Controllers/QueryController@getQueryTimeline')
  route.get('/frequent', 'Controllers/QueryController@getFrequentQueries')
  route.post('/prune', 'Controllers/QueryController@pruneQueryLogs')
})

// Dashboard routes
route.group({ prefix: '/dashboard' }, () => {
  route.get('/stats', 'Actions/Dashboard/DashboardStatsAction')
  route.get('/activity', 'Actions/Dashboard/DashboardActivityAction')
  route.get('/health', 'Actions/Dashboard/DashboardHealthAction')
})

// Direct test route without action resolution
route.get('/test/direct', () => response.json({ message: 'Direct route works!' }))

// File upload test route
route.post('/test/upload', 'Actions/UploadTestAction')

// Error Tracking / Monitoring routes
route.group({ prefix: '/monitoring' }, () => {
  // Errors
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




// CMS / Blog routes
route.group({ prefix: '/cms' }, () => {
  // Posts - Full CRUD for blog posts
  route.get('/posts', 'Actions/Cms/PostIndexAction')
  route.get('/posts/{id}', 'Actions/Cms/PostShowAction')
  route.post('/posts', 'Actions/Cms/PostStoreAction')
  route.patch('/posts/{id}', 'Actions/Cms/PostUpdateAction')
  route.delete('/posts/{id}', 'Actions/Cms/PostDestroyAction')
  route.patch('/posts/{id}/views', 'Actions/Cms/PostViewsUpdateAction')

  // Authors
  route.get('/authors', 'Actions/Cms/AuthorIndexAction')
  route.get('/authors/{id}', 'Actions/Cms/AuthorShowAction')
  route.post('/authors', 'Actions/Cms/AuthorStoreAction')
  route.patch('/authors/{id}', 'Actions/Cms/AuthorUpdateAction')
  route.delete('/authors/{id}', 'Actions/Cms/AuthorDestroyAction')

  // Categories
  route.get('/categories', 'Actions/Cms/CategorizableIndexAction')
  route.get('/categories/{id}', 'Actions/Cms/CategorizableShowAction')
  route.post('/categories', 'Actions/Cms/CategorizableStoreAction')
  route.patch('/categories/{id}', 'Actions/Cms/CategorizableUpdateAction')
  route.delete('/categories/{id}', 'Actions/Cms/CategorizableDestroyAction')

  // Tags
  route.get('/tags', 'Actions/Cms/TaggableIndexAction')
  route.get('/tags/{id}', 'Actions/Cms/TaggableShowAction')
  route.post('/tags', 'Actions/Cms/TaggableStoreAction')
  route.patch('/tags/{id}', 'Actions/Cms/TaggableUpdateAction')
  route.delete('/tags/{id}', 'Actions/Cms/TaggableDestroyAction')

  // Comments
  route.get('/comments', 'Actions/Cms/CommentIndexAction')
  route.get('/comments/{id}', 'Actions/Cms/CommentShowAction')
  route.post('/comments', 'Actions/Cms/CommentStoreAction')
  route.patch('/comments/{id}', 'Actions/Cms/CommentUpdateAction')
  route.delete('/comments/{id}', 'Actions/Cms/CommentDestroyAction')

  // Pages
  route.get('/pages', 'Actions/Cms/PageIndexAction')
  route.post('/pages', 'Actions/Cms/PageStoreAction')
  route.patch('/pages/{id}', 'Actions/Cms/PageUpdateAction')
  route.delete('/pages/{id}', 'Actions/Cms/PageDestroyAction')
})

// Public Blog routes (for frontend consumption)
route.group({ prefix: '/blog' }, () => {
  route.get('/posts', 'Actions/Cms/PostIndexAction')
  route.get('/posts/{id}', 'Actions/Cms/PostShowAction')
  route.get('/categories', 'Actions/Cms/CategorizableIndexAction')
  route.get('/tags', 'Actions/Cms/TaggableIndexAction')
  route.get('/feed.xml', 'Actions/Cms/RssFeedAction')
  route.get('/sitemap.xml', 'Actions/Cms/SitemapAction')
})

// Commerce routes
route.group({ prefix: '/commerce' }, () => {
  // Products
  route.get('/products', 'Actions/Commerce/Product/ProductIndexAction')
  route.get('/products/{id}', 'Actions/Commerce/Product/ProductShowAction')
  route.post('/products', 'Actions/Commerce/Product/ProductStoreAction')
  route.patch('/products/{id}', 'Actions/Commerce/Product/ProductUpdateAction')
  route.delete('/products/{id}', 'Actions/Commerce/Product/ProductDestroyAction')

  // Product Variants
  route.get('/products/{productId}/variants', 'Actions/Commerce/Product/ProductVariantIndexAction')
  route.get('/variants/{id}', 'Actions/Commerce/Product/ProductVariantShowAction')
  route.post('/variants', 'Actions/Commerce/Product/ProductVariantStoreAction')
  route.patch('/variants/{id}', 'Actions/Commerce/Product/ProductVariantUpdateAction')
  route.delete('/variants/{id}', 'Actions/Commerce/Product/ProductVariantDestroyAction')

  // Product Units
  route.get('/units', 'Actions/Commerce/Product/ProductUnitIndexAction')
  route.get('/units/{id}', 'Actions/Commerce/Product/ProductUnitShowAction')
  route.post('/units', 'Actions/Commerce/Product/ProductUnitStoreAction')
  route.delete('/units/{id}', 'Actions/Commerce/Product/ProductUnitDestroyAction')

  // Product Categories
  route.get('/product-categories', 'Actions/Commerce/Product/ProductCategoryIndexAction')
  route.post('/product-categories', 'Actions/Commerce/Product/ProductCategoryStoreAction')

  // Manufacturers
  route.get('/manufacturers', 'Actions/Commerce/Product/ManufacturerIndexAction')
  route.get('/manufacturers/{id}', 'Actions/Commerce/Product/ManufacturerShowAction')
  route.post('/manufacturers', 'Actions/Commerce/Product/ManufacturerStoreAction')
  route.patch('/manufacturers/{id}', 'Actions/Commerce/Product/ProductManufacturerUpdateAction')
  route.delete('/manufacturers/{id}', 'Actions/Commerce/Product/ManufacturerDestroyAction')

  // Orders
  route.get('/orders', 'Actions/Commerce/OrderIndexAction')
  route.get('/orders/{id}', 'Actions/Commerce/OrderShowAction')
  route.post('/orders', 'Actions/Commerce/OrderStoreAction')
  route.patch('/orders/{id}', 'Actions/Commerce/OrderUpdateAction')
  route.delete('/orders/{id}', 'Actions/Commerce/OrderDestroyAction')
  route.get('/orders/export', 'Actions/Commerce/OrderExportAction')

  // Customers
  route.get('/customers', 'Actions/Commerce/CustomerIndexAction')
  route.get('/customers/{id}', 'Actions/Commerce/CustomerShowAction')
  route.post('/customers', 'Actions/Commerce/CustomerStoreAction')
  route.patch('/customers/{id}', 'Actions/Commerce/CustomerUpdateAction')
  route.delete('/customers/{id}', 'Actions/Commerce/CustomerDestroyAction')

  // Coupons
  route.get('/coupons', 'Actions/Commerce/CouponIndexAction')
  route.get('/coupons/{id}', 'Actions/Commerce/CouponShowAction')
  route.post('/coupons', 'Actions/Commerce/CouponStoreAction')
  route.patch('/coupons/{id}', 'Actions/Commerce/CouponUpdateAction')
  route.delete('/coupons/{id}', 'Actions/Commerce/CouponDestroyAction')

  // Gift Cards
  route.get('/gift-cards', 'Actions/Commerce/GiftCardIndexAction')
  route.get('/gift-cards/stats', 'Actions/Commerce/GiftCardStatsAction')
  route.get('/gift-cards/{id}', 'Actions/Commerce/GiftCardShowAction')
  route.post('/gift-cards', 'Actions/Commerce/GiftCardStoreAction')
  route.patch('/gift-cards/{id}', 'Actions/Commerce/GiftCardUpdateAction')
  route.patch('/gift-cards/{id}/balance', 'Actions/Commerce/GiftCardUpdateBalanceAction')
  route.delete('/gift-cards/{id}', 'Actions/Commerce/GiftCardDestroyAction')

  // Tax Rates
  route.get('/tax-rates', 'Actions/Commerce/TaxRateIndexAction')
  route.get('/tax-rates/{id}', 'Actions/Commerce/TaxRateShowAction')
  route.post('/tax-rates', 'Actions/Commerce/TaxRateStoreAction')
  route.patch('/tax-rates/{id}', 'Actions/Commerce/TaxRateUpdateAction')
  route.delete('/tax-rates/{id}', 'Actions/Commerce/TaxRateDestroyAction')

  // Reviews
  route.get('/reviews', 'Actions/Commerce/ReviewIndexAction')
  route.get('/reviews/{id}', 'Actions/Commerce/ReviewShowAction')
  route.post('/reviews', 'Actions/Commerce/ReviewStoreAction')
  route.patch('/reviews/{id}', 'Actions/Commerce/ReviewUpdateAction')

  // Receipts
  route.get('/receipts', 'Actions/Commerce/ReceiptIndexAction')
  route.get('/receipts/{id}', 'Actions/Commerce/ReceiptShowAction')
  route.post('/receipts', 'Actions/Commerce/ReceiptStoreAction')
  route.patch('/receipts/{id}', 'Actions/Commerce/ReceiptUpdateAction')
  route.delete('/receipts/{id}', 'Actions/Commerce/ReceiptDestroyAction')

  // Print Devices (POS)
  route.get('/print-devices', 'Actions/Commerce/PrintDeviceIndexAction')
  route.get('/print-devices/{id}', 'Actions/Commerce/PrintDeviceShowAction')
  route.post('/print-devices', 'Actions/Commerce/PrintDeviceStoreAction')
  route.patch('/print-devices/{id}', 'Actions/Commerce/PrintDeviceUpdateAction')
  route.delete('/print-devices/{id}', 'Actions/Commerce/PrintDeviceDestroyAction')

  // Commerce Payments (stats & trends)
  route.get('/payment-stats', 'Actions/Commerce/PaymentFetchStatsAction')
  route.get('/payment-trends', 'Actions/Commerce/PaymentMonthlyTrendsAction')
  route.get('/commerce-payments', 'Actions/Commerce/PaymentIndexAction')
  route.get('/commerce-payments/{id}', 'Actions/Commerce/PaymentShowAction')
  route.post('/commerce-payments', 'Actions/Commerce/PaymentStoreAction')

  // Waitlist - Product
  route.get('/waitlist/products', 'Actions/Commerce/WaitlistProductIndexAction')
  route.get('/waitlist/products/analytics', 'Actions/Commerce/WaitlistProductAnalyticsAction')
  route.get('/waitlist/products/status', 'Actions/Commerce/WaitlistProductStatusAction')
  route.get('/waitlist/products/time-series', 'Actions/Commerce/WaitlistProductTimeSeriesAction')
  route.get('/waitlist/products/quantity-distribution', 'Actions/Commerce/WaitlistProductQuantityDistributionAction')
  route.get('/waitlist/products/{id}', 'Actions/Commerce/WaitlistProductShowAction')
  route.post('/waitlist/products', 'Actions/Commerce/WaitlistProductStoreAction')
  route.patch('/waitlist/products/{id}', 'Actions/Commerce/WaitlistProductUpdateAction')
  route.delete('/waitlist/products/{id}', 'Actions/Commerce/WaitlistProductDestroyAction')

  // Waitlist - Restaurant
  route.get('/waitlist/restaurants', 'Actions/Commerce/WaitlistRestaurantIndexAction')
  route.get('/waitlist/restaurants/dashboard', 'Actions/Commerce/WaitlistRestaurantDashboardAction')
  route.get('/waitlist/restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantShowAction')
  route.post('/waitlist/restaurants', 'Actions/Commerce/WaitlistRestaurantStoreAction')
  route.patch('/waitlist/restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantUpdateAction')
  route.delete('/waitlist/restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantDestroyAction')
})

// Shipping routes
route.group({ prefix: '/shipping' }, () => {
  // Shipping Methods
  route.get('/methods', 'Actions/Commerce/Shipping/ShippingMethodIndexAction')
  route.get('/methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodShowAction')
  route.post('/methods', 'Actions/Commerce/Shipping/ShippingMethodStoreAction')
  route.patch('/methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodUpdateAction')
  route.delete('/methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodDestroyAction')

  // Shipping Rates
  route.get('/rates', 'Actions/Commerce/Shipping/ShippingRateIndexAction')
  route.get('/rates/{id}', 'Actions/Commerce/Shipping/ShippingRateShowAction')
  route.post('/rates', 'Actions/Commerce/Shipping/ShippingRateStoreAction')
  route.patch('/rates/{id}', 'Actions/Commerce/Shipping/ShippingRateUpdateAction')
  route.delete('/rates/{id}', 'Actions/Commerce/Shipping/ShippingRateDestroyAction')

  // Shipping Zones
  route.get('/zones', 'Actions/Commerce/Shipping/ShippingZoneIndexAction')
  route.get('/zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneShowAction')
  route.post('/zones', 'Actions/Commerce/Shipping/ShippingZoneStoreAction')
  route.patch('/zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneUpdateAction')
  route.delete('/zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneDestroyAction')

  // Delivery Routes
  route.get('/delivery-routes', 'Actions/Commerce/Shipping/DeliveryRouteIndexAction')
  route.get('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteShowAction')
  route.post('/delivery-routes', 'Actions/Commerce/Shipping/DeliveryRouteStoreAction')
  route.patch('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteUpdateAction')
  route.delete('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteDestroyAction')

  // Drivers
  route.get('/drivers', 'Actions/Commerce/Shipping/DriverIndexAction')
  route.get('/drivers/{id}', 'Actions/Commerce/Shipping/DriverShowAction')
  route.post('/drivers', 'Actions/Commerce/Shipping/DriverStoreAction')
  route.patch('/drivers/{id}', 'Actions/Commerce/Shipping/DriverUpdateAction')

  // Digital Delivery
  route.get('/digital', 'Actions/Commerce/Shipping/DigitalDeliveryIndexAction')
  route.get('/digital/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryShowAction')
  route.post('/digital', 'Actions/Commerce/Shipping/DigitalDeliveryStoreAction')
  route.patch('/digital/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryUpdateAction')
  route.delete('/digital/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryDestroyAction')

  // License Keys
  route.get('/license-keys', 'Actions/Commerce/Shipping/LicenseKeyIndexAction')
  route.get('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyShowAction')
  route.post('/license-keys', 'Actions/Commerce/Shipping/LicenseKeyStoreAction')
  route.patch('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyUpdateAction')
  route.delete('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyDestroyAction')
})

// Authenticated user routes
route.group({ middleware: 'auth' }, () => {
  route.get('/me', 'Actions/Auth/AuthUserAction')
  route.post('/logout', 'Actions/Auth/LogoutAction')
})
