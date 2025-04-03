import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered. Last but
 * not least, you may also create any other `routes/*.ts` files.
 *
 * @see https://docs.stacksjs.org/routing
 */

route.get('/foo/bar/{id}', () => 'hello world, foo bar') // $API_URL/hello/world
route.get('/', () => 'hello world') // $API_URL
route.get('/hello/world', () => 'hello world, buddy') // $API_URL/hello/world

route.post('/email/subscribe', 'Actions/SubscriberEmailAction')
route.post('/login', 'Actions/LoginAction')
route.get('/generate-registration-options', 'Actions/Auth/GenerateRegistrationAction')
route.post('/verify-registration', 'Actions/Auth/VerifyRegistrationAction')
route.get('/generate-authentication-options', 'Actions/Auth/GenerateAuthenticationAction')
route.post('/verify-authentication', 'Actions/Auth/VerifyAuthenticationAction')

// route.email('/welcome')
route.health() // adds a GET `/health` route
route.get('/install', 'Actions/InstallAction')
route.post('/ai/ask', 'Actions/AI/AskAction')
route.post('/ai/summary', 'Actions/AI/SummaryAction')

route.group({ prefix: '/payments' }, async () => {
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

route.group({ prefix: '/commerce' }, async () => {
  route.get('/customers', 'Actions/Commerce/CustomersAction')

  // Print Devices
  route.get('/print-devices', 'Actions/Commerce/PrintDeviceIndexOrmAction')
  route.post('/print-devices', 'Actions/Commerce/PrintDeviceStoreOrmAction')
  route.get('/print-devices/{id}', 'Actions/Commerce/PrintDeviceShowOrmAction')
  route.patch('/print-devices/{id}', 'Actions/Commerce/PrintDeviceUpdateOrmAction')
  route.delete('/print-devices/{id}', 'Actions/Commerce/PrintDeviceDestroyOrmAction')

  // Product Categories
  route.get('/product-categories', 'Actions/Commerce/CategoryIndexOrmAction')
  route.post('/product-categories', 'Actions/Commerce/CategoryStoreOrmAction')
  route.get('/product-categories/{id}', 'Actions/Commerce/CategoryShowOrmAction')

  // Payments
  route.get('/payments', 'Actions/Commerce/PaymentIndexOrmAction')
  route.post('/payments', 'Actions/Commerce/PaymentStoreOrmAction')
  route.get('/payments/{id}', 'Actions/Commerce/PaymentShowOrmAction')

  // Drivers
  route.get('/drivers', 'Actions/Commerce/DriverIndexOrmAction')
  route.post('/drivers', 'Actions/Commerce/DriverStoreOrmAction')
  route.get('/drivers/{id}', 'Actions/Commerce/DriverShowOrmAction')
  route.patch('/drivers/{id}', 'Actions/Commerce/DriverUpdateOrmAction')
  route.delete('/drivers/{id}', 'Actions/Commerce/DriverDestroyOrmAction')

  // Waitlist Products
  route.get('/waitlist-products', 'Actions/Commerce/WaitlistProductIndexOrmAction')
  route.post('/waitlist-products', 'Actions/Commerce/WaitlistProductStoreOrmAction')
  route.get('/waitlist-products/{id}', 'Actions/Commerce/WaitlistProductShowOrmAction')
  route.patch('/waitlist-products/{id}', 'Actions/Commerce/WaitlistProductUpdateOrmAction')
  route.delete('/waitlist-products/{id}', 'Actions/Commerce/WaitlistProductDestroyOrmAction')

  // Digital Deliveries
  route.get('/digital-deliveries', 'Actions/Commerce/DigitalDeliveryIndexOrmAction')
  route.post('/digital-deliveries', 'Actions/Commerce/DigitalDeliveryStoreOrmAction')
  route.get('/digital-deliveries/{id}', 'Actions/Commerce/DigitalDeliveryShowOrmAction')
  route.patch('/digital-deliveries/{id}', 'Actions/Commerce/DigitalDeliveryUpdateOrmAction')
  route.delete('/digital-deliveries/{id}', 'Actions/Commerce/DigitalDeliveryDestroyOrmAction')

  // Product Manufacturers
  route.get('/product-manufacturers', 'Actions/Commerce/ManufacturerIndexOrmAction')
  route.post('/product-manufacturers', 'Actions/Commerce/ManufacturerStoreOrmAction')
  route.get('/product-manufacturers/{id}', 'Actions/Commerce/ManufacturerShowOrmAction')

  // Shipping Zones
  route.get('/shipping-zones', 'Actions/Commerce/ShippingZoneIndexOrmAction')
  route.post('/shipping-zones', 'Actions/Commerce/ShippingZoneStoreOrmAction')
  route.get('/shipping-zones/{id}', 'Actions/Commerce/ShippingZoneShowOrmAction')
  route.patch('/shipping-zones/{id}', 'Actions/Commerce/ShippingZoneUpdateOrmAction')
  route.delete('/shipping-zones/{id}', 'Actions/Commerce/ShippingZoneDestroyOrmAction')

  // Customers
  route.get('/customers', 'Actions/Commerce/CustomerIndexOrmAction')
  route.post('/customers', 'Actions/Commerce/CustomerStoreOrmAction')
  route.get('/customers/{id}', 'Actions/Commerce/CustomerShowOrmAction')
  route.patch('/customers/{id}', 'Actions/Commerce/CustomerUpdateOrmAction')
  route.delete('/customers/{id}', 'Actions/Commerce/CustomerDestroyOrmAction')

  // Products
  route.get('/products', 'Actions/Commerce/ProductIndexOrmAction')
  route.post('/products', 'Actions/Commerce/ProductStoreOrmAction')
  route.get('/products/{id}', 'Actions/Commerce/ProductShowOrmAction')

  // Print Logs
  route.get('/print-logs', 'Actions/Commerce/ReceiptIndexOrmAction')
  route.post('/print-logs', 'Actions/Commerce/ReceiptStoreOrmAction')
  route.get('/print-logs/{id}', 'Actions/Commerce/ReceiptShowOrmAction')
  route.patch('/print-logs/{id}', 'Actions/Commerce/ReceiptUpdateOrmAction')
  route.delete('/print-logs/{id}', 'Actions/Commerce/ReceiptDestroyOrmAction')

  // Product Variants
  route.get('/product-variants', 'Actions/Commerce/ProductVariantIndexOrmAction')
  route.post('/product-variants', 'Actions/Commerce/ProductVariantStoreOrmAction')
  route.get('/product-variants/{id}', 'Actions/Commerce/ProductVariantShowOrmAction')
  route.patch('/product-variants/{id}', 'Actions/Commerce/ProductVariantUpdateOrmAction')
  route.delete('/product-variants/{id}', 'Actions/Commerce/ProductVariantDestroyOrmAction')

  // License Keys
  route.get('/license-keys', 'Actions/Commerce/LicenseKeyIndexOrmAction')
  route.post('/license-keys', 'Actions/Commerce/LicenseKeyStoreOrmAction')
  route.get('/license-keys/{id}', 'Actions/Commerce/LicenseKeyShowOrmAction')
  route.patch('/license-keys/{id}', 'Actions/Commerce/LicenseKeyUpdateOrmAction')
  route.delete('/license-keys/{id}', 'Actions/Commerce/LicenseKeyDestroyOrmAction')

  // Waitlist Restaurants
  route.get('/waitlist-restaurants', 'Actions/Commerce/WaitlistRestaurantIndexOrmAction')
  route.post('/waitlist-restaurants', 'Actions/Commerce/WaitlistRestaurantStoreOrmAction')
  route.get('/waitlist-restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantShowOrmAction')
  route.patch('/waitlist-restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantUpdateOrmAction')
  route.delete('/waitlist-restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantDestroyOrmAction')

  // Product Reviews
  route.get('/product-reviews', 'Actions/Commerce/ReviewIndexOrmAction')
  route.post('/product-reviews', 'Actions/Commerce/ReviewStoreOrmAction')
  route.get('/product-reviews/{id}', 'Actions/Commerce/ReviewShowOrmAction')

  // Product Units
  route.get('/product-units', 'Actions/Commerce/ProductUnitIndexOrmAction')
  route.post('/product-units', 'Actions/Commerce/ProductUnitStoreOrmAction')
  route.get('/product-units/{id}', 'Actions/Commerce/ProductUnitShowOrmAction')

  // Gift Cards
  route.get('/gift-cards', 'Actions/Commerce/GiftCardIndexOrmAction')
  route.post('/gift-cards', 'Actions/Commerce/GiftCardStoreOrmAction')
  route.get('/gift-cards/{id}', 'Actions/Commerce/GiftCardShowOrmAction')

  // Orders
  route.get('/orders', 'Actions/Commerce/OrderIndexOrmAction')
  route.post('/orders', 'Actions/Commerce/OrderStoreOrmAction')
  route.get('/orders/{id}', 'Actions/Commerce/OrderShowOrmAction')

  // Coupons
  route.get('/coupons', 'Actions/Commerce/CouponIndexOrmAction')
  route.post('/coupons', 'Actions/Commerce/CouponStoreOrmAction')
  route.get('/coupons/{id}', 'Actions/Commerce/CouponShowOrmAction')

  // Tax Rates
  route.get('/tax-rates', 'Actions/Commerce/TaxRateIndexOrmAction')
  route.post('/tax-rates', 'Actions/Commerce/TaxRateStoreOrmAction')
  route.get('/tax-rates/{id}', 'Actions/Commerce/TaxRateShowOrmAction')
  route.patch('/tax-rates/{id}', 'Actions/Commerce/TaxRateUpdateOrmAction')
  route.delete('/tax-rates/{id}', 'Actions/Commerce/TaxRateDestroyOrmAction')

  // Transactions
  route.get('/transactions', 'Actions/Commerce/TransactionIndexOrmAction')
  route.post('/transactions', 'Actions/Commerce/TransactionStoreOrmAction')
  route.get('/transactions/{id}', 'Actions/Commerce/TransactionShowOrmAction')

  // Loyalty Points
  route.get('/loyalty-points', 'Actions/Commerce/LoyaltyPointIndexOrmAction')
  route.post('/loyalty-points', 'Actions/Commerce/LoyaltyPointStoreOrmAction')
  route.get('/loyalty-points/{id}', 'Actions/Commerce/LoyaltyPointShowOrmAction')

  // Product Items
  route.get('/product-items', 'Actions/Commerce/ProductItemIndexOrmAction')
  route.post('/product-items', 'Actions/Commerce/ProductItemStoreOrmAction')
  route.get('/product-items/{id}', 'Actions/Commerce/ProductItemShowOrmAction')

  // Loyalty Rewards
  route.get('/loyalty-rewards', 'Actions/Commerce/LoyaltyRewardIndexOrmAction')
  route.post('/loyalty-rewards', 'Actions/Commerce/LoyaltyRewardStoreOrmAction')
  route.get('/loyalty-rewards/{id}', 'Actions/Commerce/LoyaltyRewardShowOrmAction')

  // Shipping Methods
  route.get('/shipping-methods', 'Actions/Commerce/ShippingMethodIndexOrmAction')
  route.post('/shipping-methods', 'Actions/Commerce/ShippingMethodStoreOrmAction')
  route.get('/shipping-methods/{id}', 'Actions/Commerce/ShippingMethodShowOrmAction')
  route.patch('/shipping-methods/{id}', 'Actions/Commerce/ShippingMethodUpdateOrmAction')
  route.delete('/shipping-methods/{id}', 'Actions/Commerce/ShippingMethodDestroyOrmAction')

  // Shipping Rates
  route.get('/shipping-rates', 'Actions/Commerce/ShippingRateIndexOrmAction')
  route.post('/shipping-rates', 'Actions/Commerce/ShippingRateStoreOrmAction')
  route.get('/shipping-rates/{id}', 'Actions/Commerce/ShippingRateShowOrmAction')
  route.patch('/shipping-rates/{id}', 'Actions/Commerce/ShippingRateUpdateOrmAction')
  route.delete('/shipping-rates/{id}', 'Actions/Commerce/ShippingRateDestroyOrmAction')

  // Delivery Routes
  route.get('/delivery-routes', 'Actions/Commerce/DeliveryRouteIndexOrmAction')
  route.post('/delivery-routes', 'Actions/Commerce/DeliveryRouteStoreOrmAction')
  route.get('/delivery-routes/{id}', 'Actions/Commerce/DeliveryRouteShowOrmAction')
  route.patch('/delivery-routes/{id}', 'Actions/Commerce/DeliveryRouteUpdateOrmAction')
  route.delete('/delivery-routes/{id}', 'Actions/Commerce/DeliveryRouteDestroyOrmAction')
})

route.group({ prefix: '/queues' }, async () => {
  route.get('/', 'Actions/Queue/FetchQueuesAction')
})

// route.action('/example') // equivalent to `route.get('/example', 'ExampleAction')`
// route.action('Dashboard/GetProjects')
// route.action('Dashboard/Settings/UpdateAiConfig')
// route.job('/example-two') // equivalent to `route.get('/example-two', 'ExampleTwoJob')`
