---
name: stacks-commerce
description: Use when building e-commerce features in a Stacks application — products, carts, orders, inventory, shipping, coupons, or commerce configuration. Covers the @stacksjs/commerce package and related models.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Commerce

The `@stacksjs/commerce` package provides e-commerce utilities for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/commerce/src/`
- Default commerce functions: `storage/framework/defaults/functions/commerce/`
- Default commerce models: `storage/framework/defaults/models/commerce/`
- Package: `@stacksjs/commerce`

## Commerce Models
Located in `storage/framework/models/`:
- `Product.ts` - Product catalog
- `ProductUnit.ts` - Product units/SKUs
- `ProductVariant.ts` - Product variants
- `Cart.ts` - Shopping cart
- `CartItem.ts` - Cart line items
- `Order.ts` - Customer orders
- `OrderItem.ts` - Order line items
- `Coupon.ts` - Discount coupons
- `GiftCard.ts` - Gift card management
- `ShippingMethod.ts` - Shipping methods
- `ShippingRate.ts` - Shipping rates
- `ShippingZone.ts` - Shipping zones
- `TaxRate.ts` - Tax rate configuration
- `Customer.ts` - Customer profiles
- `Manufacturer.ts` - Product manufacturers
- `Review.ts` - Product reviews
- `LicenseKey.ts` - Digital license keys
- `DigitalDelivery.ts` - Digital product delivery
- `WaitlistProduct.ts` - Product waitlists

## Integration
- Works with `@stacksjs/payments` for payment processing
- Uses `@stacksjs/database` and ORM for data persistence
- Integrates with `@stacksjs/email` for order notifications

## Gotchas
- Commerce models are auto-generated — edit definitions, not generated files
- Payment processing is handled by the separate `@stacksjs/payments` package
- Use `buddy make:migration` when modifying commerce schemas
- Default commerce functions are in `storage/framework/defaults/functions/commerce/`
