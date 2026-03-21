---
name: stacks-orm
description: Use when working with the Stacks ORM — defining models, model relationships, queries, migrations, or the object-relational mapping layer. Covers @stacksjs/orm, storage/framework/orm/, and storage/framework/models/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks ORM

The Stacks ORM provides an object-relational mapping layer for database interaction.

## Key Paths
- Core ORM package: `storage/framework/core/orm/src/`
- ORM implementation: `storage/framework/orm/`
- Model definitions: `storage/framework/models/`
- Application models: `app/Models/`
- Default models: `storage/framework/defaults/models/`
- ORM types: `storage/framework/types/orm-globals.d.ts`
- Package: `@stacksjs/orm`

## Model Files (27+)
Located in `storage/framework/models/`:
Activity, Author, Campaign, Cart, CartItem, Category, Comment, Coupon, Customer, DeliveryRoute, DigitalDelivery, Driver, EmailList, Error, FailedJob, GiftCard, Job, LicenseKey, Log, LoyaltyPoint, LoyaltyReward, Manufacturer, Notification, Order, OrderItem, Page, Payment, PaymentMethod, PaymentProduct, PaymentTransaction, Post, PrintDevice, Product, ProductUnit, ProductVariant, Receipt, Request, Review, ShippingMethod, ShippingRate, ShippingZone, Subscription, TaxRate, Transaction, Websocket, WaitlistProduct, WaitlistRestaurant

## CLI Commands
- `buddy generate` - Generate model files
- `buddy generate:model-files` - Generate specific model files
- `buddy make:migration` - Create migration for model changes
- `buddy migrate` - Run pending migrations

## Architecture
- Models are defined as TypeScript classes in `storage/framework/models/`
- The ORM generates queries, migrations, and type definitions
- Relationships, accessors, and mutators are defined on model classes
- ORM globals provide query methods on all models

## Gotchas
- There are TWO orm locations: `storage/framework/core/orm/` (package) and `storage/framework/orm/` (implementation)
- Model files in `storage/framework/models/` may be auto-generated -- edit model definitions, not generated code
- Always use `buddy make:migration` for schema changes
- ORM types are in `storage/framework/types/orm-globals.d.ts`
- Default model templates are in `storage/framework/defaults/models/`
- The build:reset script runs `buddy generate:model-files`
