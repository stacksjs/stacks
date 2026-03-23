---
name: stacks-models
description: Use when working with data models in Stacks — the defineModel() API, model attributes with validation and factories, relationships (hasOne/hasMany/belongsTo/belongsToMany), traits (useAuth, useUuid, useTimestamps, useSearch, useApi, billable, taggable, categorizable, commentable, likeable, observe), computed properties (get/set), model generation, and the 50+ built-in framework models. Covers model definitions and storage/framework/models/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Models

## Key Paths
- Application models: `app/Models/`
- Framework models: `storage/framework/models/` (50+ auto-generated)
- Default templates: `storage/framework/defaults/models/`
- Attribute types: `storage/framework/types/attributes.ts` (240+ fields)

## All 50+ Framework Models by Category

### Users & Auth
- **User** — name, email, password | traits: useAuth(passkey), useUuid, useTimestamps, useSocials(github) | hasOne: Subscriber, Driver, Author | hasMany: PersonalAccessToken, Customer
- **Author** — name, email | belongsTo: User | hasMany: Post
- **Customer** — name, email, phone, totalSpent, lastOrder, status, avatar | belongsTo: User | hasMany: Order, GiftCard, Review, Payment
- **Driver** — name, phone, vehicleNumber, license, status | belongsTo: User | hasMany: DeliveryRoute
- **Subscriber** — email, status, source | belongsTo: User | hasMany: SubscriberEmail

### Content
- **Post** — title, content, poster, excerpt, views, publishedAt, status, isFeatured | belongsTo: Author | traits: categorizable, taggable, commentable | seeder: 20
- **Page** — similar to Post with taggable, categorizable
- **Comment** — author info, approval, content fields
- **Tag** — name(unique), slug(unique), description, postCount, color | seeder: 15
- **Category** — name, description, slug, imageUrl, isActive, parentCategoryId, displayOrder | hasMany: Product | seeder: 10

### Commerce (20+ models)
- **Product** — name(max100), description, price(min1), imageUrl, isAvailable, inventoryCount, preparationTime, allergens(JSON), nutritionalInfo(JSON) | belongsTo: Category, Manufacturer | hasMany: Review, ProductUnit, ProductVariant, LicenseKey, WaitlistProduct, Coupon | seeder: 10, dashboard: highlighted
- **ProductVariant** — SKU, options, pricing
- **ProductUnit** — unit-specific pricing
- **Cart** — status(active|abandoned|converted|expired), totalItems, subtotal, taxAmount, discountAmount, total, expiresAt, currency(USD), notes | hasMany: CartItem | belongsTo: Customer, Coupon
- **CartItem** — quantity(min1), unitPrice, totalPrice, taxRate, taxAmount, discountPercentage, productName, productSku | belongsTo: Cart
- **Order** — status, totalAmount, taxAmount, discountAmount, deliveryFee, tipAmount, orderType(DINE_IN|TAKEOUT|DELIVERY), deliveryAddress, specialInstructions | hasMany: OrderItem, Payment | belongsTo: Customer, Coupon | observe: true | seeder: 20
- **OrderItem** — quantity(min1), price(min0), specialInstructions | belongsTo: Order, Product
- **Coupon** — code(unique), discountType(fixed_amount|percentage), discountValue, minOrderAmount, usageLimit, usageCount, startDate, endDate | seeder: 15
- **GiftCard** — code(unique), initialBalance, currentBalance, currency, status, recipientEmail, isDigital, isReloadable, expiryDate | seeder: 20
- **Manufacturer** — manufacturer info
- **Review** — rating(1-5), title, content(max2000), isVerifiedPurchase, isApproved, isFeatured, helpfulVotes, unhelpfulVotes | belongsTo: Product, Customer | seeder: 50

### Shipping & Delivery
- **ShippingMethod**, **ShippingRate** (weightFrom, weightTo, rate), **ShippingZone**
- **DeliveryRoute** — driver, vehicle, stops, totalDistance | belongsTo: Driver
- **DigitalDelivery** — name, downloadLimit, expiryDays, automaticDelivery
- **LicenseKey** — key(XXXX-XXXX-XXXX-XXXX-XXXX), template, expiryDate, status

### Payments & Financial
- **Payment** — amount, method(creditCard|debitCard|paypal|...), status(pending|completed|failed|refunded), currency, transactionId(unique) | belongsTo: Order, Customer | seeder: 50
- **PaymentMethod**, **PaymentProduct**, **PaymentTransaction**
- **Subscription** — type, providerId, providerStatus, unitPrice
- **Transaction** — standard transaction tracking
- **TaxRate** — name, rate(0-100), type(VAT|GST|Sales Tax|Customs Duty), country, region, isDefault

### Engagement & Marketing
- **Notification** — type, channel, recipient, subject, body, status(pending|sent|delivered|failed|read) | belongsTo: User | seeder: 30
- **Campaign** — name, type(email|sms|push|social|multi-channel), status, audienceSize, openRate, clickRate, budget | seeder: 10
- **Activity** — type, description, subjectType, subjectId, causer, properties(JSON), ipAddress | belongsTo: User | seeder: 50
- **EmailList**, **SocialPost**, **LoyaltyPoint** (walletId, points, source, expiryDate), **LoyaltyReward**

### System
- **Job** — queue, payload, attempts, available_at, reserved_at | seeder: 15
- **FailedJob** — failed background jobs
- **Error** — type, message, stack, status, additionalInfo | seeder: 10
- **Log** — application logs
- **Request** — method, path, statusCode, durationMs, ipAddress, memoryUsage, userAgent, errorMessage | seeder: 50
- **Websocket** — connection tracking
- **PrintDevice** — name, location, terminal, lastPing, printCount, isActive
- **WaitlistProduct**, **WaitlistRestaurant** — waitlist tracking
- **Receipt** — receipt records

## CLI Commands
- `buddy make:model [name]` — create new model
- `buddy make:migration [name]` — create migration for schema changes
- `buddy make:factory [name]` — create model factory
- `buddy generate:migrations` — generate migrations from model diffs

## Gotchas
- Models work directly via the dynamic ORM — no code generation step needed
- `defineModel()` uses `createModel()` from bun-query-builder at runtime, providing typed query methods immediately
- Each model can have a `factory` function per attribute using `@stacksjs/faker`
- `hidden` attributes are excluded from JSON serialization (passwords)
- `guarded` attributes prevent mass assignment
- `fillable` explicitly allows mass assignment
- Model events fire when `observe: true` — emits `{model}:created/updated/deleted`
- Default seeder counts vary: User(10), Post(20), Review(50), Activity(50)
- Dashboard highlighted models appear prominently in the admin UI
- 240+ attribute definitions in `storage/framework/types/attributes.ts`
