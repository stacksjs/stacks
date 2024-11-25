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

route.get('/payments/fetch-customer', 'Actions/Payment/FetchPaymentCustomerAction')
route.get('/payments/fetch-transaction-history', 'Actions/Payment/FetchTransactionHistoryAction')
route.get('/payments/fetch-user-subscriptions', 'Actions/Payment/FetchUserSubscriptionsAction')
route.get('/payments/fetch-active-subscription', 'Actions/Payment/FetchActiveSubscriptionAction')
route.get('/payments/default-payment-method', 'Actions/Payment/FetchDefaultPaymentMethodAction')
route.get('/payments/user-payment-methods', 'Actions/Payment/FetchPaymentMethodsAction')
route.get('/payments/create-setup-intent', 'Actions/Payment/CreateSetupIntentAction')
route.delete('/payments/delete-payment-method', 'Actions/Payment/DeleteDefaultPaymentAction')
route.put('/payments/update-default-payment-method', 'Actions/Payment/UpdateDefaultPaymentMethodAction')
route.post('/payments/set-default-payment-method', 'Actions/Payment/SetDefaultPaymentAction')
route.post('/payments/create-payment-intent', 'Actions/Payment/CreatePaymentIntentAction')
route.post('/payments/create-subscription', 'Actions/Payment/CreateSubscriptionAction')
route.post('/payments/update-subscription', 'Actions/Payment/UpdateSubscriptionAction')
route.post('/payments/cancel-subscription', 'Actions/Payment/CancelSubscriptionAction')
route.post('/payments/create-invoice-subscription', 'Actions/Payment/CreateInvoiceSubscription')
route.patch('/payments/update-customer', 'Actions/Payment/UpdateCustomerAction')
route.post('/payments/checkout', 'Actions/Payment/CreateCheckoutAction')

// route.group('/some-path', async () => {...})
// route.action('/example') // equivalent to `route.get('/example', 'ExampleAction')`
// route.action('Dashboard/GetProjects')
// route.action('Dashboard/Settings/UpdateAiConfig')
// route.job('/example-two') // equivalent to `route.get('/example-two', 'ExampleTwoJob')`
