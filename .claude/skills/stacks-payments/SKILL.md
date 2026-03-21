---
name: stacks-payments
description: Use when implementing payment processing in a Stacks application — Stripe integration, payment methods, subscriptions, invoicing, or payment configuration. Covers @stacksjs/payments and config/payment.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Payments

The `@stacksjs/payments` package provides payment processing for Stacks applications, primarily via Stripe.

## Key Paths
- Core package: `storage/framework/core/payments/src/`
- Configuration: `config/payment.ts`
- SaaS config: `config/saas.ts`
- Default billing functions: `storage/framework/defaults/functions/billing/`
- Payment models: `storage/framework/models/Payment.ts`, `PaymentMethod.ts`, `PaymentProduct.ts`, `PaymentTransaction.ts`
- Subscription model: `storage/framework/models/Subscription.ts`
- Package: `@stacksjs/payments`

## Models
- `Payment.ts` - Payment records
- `PaymentMethod.ts` - Stored payment methods
- `PaymentProduct.ts` - Products with payment integration
- `PaymentTransaction.ts` - Transaction history
- `Subscription.ts` - Recurring subscriptions

## Features
- Stripe payment processing
- Subscription management
- Payment method storage
- Transaction tracking
- SaaS billing integration

## CLI Commands
- `buddy saas` - SaaS-related commands

## Gotchas
- Stripe API keys go in `.env`, never in config files
- Payment config is in `config/payment.ts`
- SaaS features are configured in `config/saas.ts`
- Default billing functions are in `storage/framework/defaults/functions/billing/`
- Always use test mode keys during development
