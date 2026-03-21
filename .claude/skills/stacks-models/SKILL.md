---
name: stacks-models
description: Use when working with data models in a Stacks application — creating models, defining relationships, model attributes, factories, or understanding the model system. Covers model definitions, generation, and the model architecture.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Models

Models in the Stacks framework define data structures, relationships, and database schemas.

## Key Paths
- Application models: `app/Models/`
- Framework models: `storage/framework/models/`
- Default model templates: `storage/framework/defaults/models/`
- Model attributes type: `storage/framework/types/attributes.ts`
- ORM globals: `storage/framework/types/orm-globals.d.ts`

## All Framework Models (50+)
Located in `storage/framework/models/`:
- **Content**: Page, Post, Comment, Author, Category
- **Commerce**: Product, ProductUnit, ProductVariant, Cart, CartItem, Order, OrderItem, Coupon, GiftCard, Customer, Manufacturer, Review, LicenseKey, DigitalDelivery, WaitlistProduct
- **Payments**: Payment, PaymentMethod, PaymentProduct, PaymentTransaction, Subscription
- **Shipping**: ShippingMethod, ShippingRate, ShippingZone, DeliveryRoute, Driver
- **Loyalty**: LoyaltyPoint, LoyaltyReward
- **System**: Job, FailedJob, Error, Log, Notification, Activity, Request, Websocket
- **Business**: Campaign, EmailList, Receipt, PrintDevice, TaxRate, Transaction
- **Other**: WaitlistRestaurant

## CLI Commands
- `buddy generate` - Generate model files
- `buddy generate:model-files` - Generate model-specific files
- `buddy make:migration` - Create migration for model changes
- `buddy make:factory` - Create a model factory

## Model Architecture
- Models define attributes, relationships, and behaviors
- The ORM generates TypeScript types from model definitions
- Migrations are created to match model schema changes
- Factories use `@stacksjs/faker` for test data generation

## Default Model Categories
- `storage/framework/defaults/models/commerce/` - Commerce model templates
- `storage/framework/defaults/models/Content/` - Content model templates
- `storage/framework/defaults/models/realtime/` - Realtime model templates

## Gotchas
- Model files in `storage/framework/models/` may be AUTO-GENERATED — edit the source definitions
- Application models go in `app/Models/`
- Always create migrations when changing model schemas
- The `build:reset` script runs `buddy generate:model-files`
- ORM globals provide query methods on all models
- Attribute types are in `storage/framework/types/attributes.ts`
