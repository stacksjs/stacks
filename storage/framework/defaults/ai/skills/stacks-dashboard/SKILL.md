---
name: stacks-dashboard
description: Use when building or customizing the Stacks admin dashboard — adding dashboard pages, model management views, analytics widgets, commerce dashboards, content management, settings panels, deployment monitoring, job/queue management, or the 150+ built-in dashboard components. Covers the dashboard system at storage/framework/defaults/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Dashboard

The Stacks admin dashboard provides a full-featured admin panel with 136+ routes, 150+ components, and multi-section layout.

## Key Paths
- Dashboard pages: `storage/framework/defaults/dashboard/pages/`
- Dashboard components: `storage/framework/defaults/components/`
- Dashboard views: `storage/framework/defaults/views/dashboard/`
- Dashboard layouts: `storage/framework/defaults/layouts/dashboard/`
- Dashboard router types: `storage/framework/types/dashboard-router.d.ts` (136+ routes)
- Dashboard actions: `storage/framework/defaults/actions/Dashboard/`
- Configuration: `config/ui.ts`

## Dashboard Sections

### Analytics & Monitoring
- `/dashboard` — main dashboard overview
- `/dashboard/analytics` — analytics widgets and charts
- `/dashboard/requests` — HTTP request analytics (method, path, status, duration)
- `/dashboard/errors` — error tracking and analysis
- `/dashboard/jobs` — background job monitoring
- `/dashboard/queue` — queue management and metrics

### Commerce
- `/dashboard/commerce/products` — product management (CRUD, variants, units)
- `/dashboard/commerce/orders` — order management and processing
- `/dashboard/commerce/customers` — customer profiles and history
- `/dashboard/commerce/payments` — payment tracking
- `/dashboard/commerce/coupons` — coupon and promotion management
- `/dashboard/commerce/gift-cards` — gift card management
- `/dashboard/commerce/shipping` — shipping methods, rates, zones
- `/dashboard/commerce/tax-rates` — tax rate configuration
- `/dashboard/commerce/reviews` — product review moderation
- `/dashboard/commerce/loyalty` — loyalty points and rewards
- `/dashboard/commerce/delivery` — delivery route tracking
- `/dashboard/commerce/waitlists` — product waitlist management
- `/dashboard/commerce/receipts` — receipt management

### Content Management
- `/dashboard/content/posts` — blog post CRUD
- `/dashboard/content/pages` — page management
- `/dashboard/content/authors` — author profiles
- `/dashboard/content/categories` — content categorization
- `/dashboard/content/tags` — tag management
- `/dashboard/content/comments` — comment moderation

### Data Management
- `/dashboard/data/users` — user management (highlighted model)
- `/dashboard/data/subscribers` — subscriber management
- `/dashboard/data/teams` — team management
- `/dashboard/data/notifications` — notification history

### Marketing
- `/dashboard/marketing/campaigns` — campaign management
- `/dashboard/marketing/email-lists` — email list management
- `/dashboard/marketing/social` — social post management

### Library
- `/dashboard/library/components` — component browser
- `/dashboard/library/functions` — function registry
- `/dashboard/library/releases` — release management

### Settings (20+ panels)
- `/dashboard/settings/ai` — AI/LLM configuration
- `/dashboard/settings/analytics` — analytics settings
- `/dashboard/settings/app` — application settings
- `/dashboard/settings/cache` — cache configuration
- `/dashboard/settings/cloud` — cloud/deployment settings
- `/dashboard/settings/database` — database configuration
- `/dashboard/settings/dns` — DNS management
- `/dashboard/settings/email` — email settings
- `/dashboard/settings/environment` — environment variables
- `/dashboard/settings/hashing` — hashing configuration
- `/dashboard/settings/logging` — logging settings
- `/dashboard/settings/notifications` — notification settings
- `/dashboard/settings/payment` — payment/Stripe settings
- `/dashboard/settings/ports` — port configuration
- `/dashboard/settings/queue` — queue settings
- `/dashboard/settings/search-engine` — search settings
- `/dashboard/settings/security` — security/firewall settings
- `/dashboard/settings/services` — third-party services
- `/dashboard/settings/storage` — storage configuration
- `/dashboard/settings/team` — team settings
- `/dashboard/settings/ui` — UI configuration

### Deployments
- `/dashboard/deployments` — deployment history and monitoring
- `/dashboard/deployments/scripts` — deployment scripts
- `/dashboard/deployments/live-terminal` — live terminal output

### Utilities
- `/dashboard/maintenance` — maintenance mode toggle

## Dashboard Components (150+)

### Layout Components
- `DashboardNavbar` — top navigation bar
- `DashboardSidebar` — side navigation
- `DashboardLayout` — main layout wrapper

### UI Components
- Buttons, Modals, Toasts, Alerts, Dropdowns
- Tables with sorting, filtering, pagination
- Forms with validation
- Charts and analytics widgets
- File upload components
- Rich text editors

### Feature Components
- `ProductForm`, `ProductList`, `ProductVariants`
- `OrderTable`, `OrderDetail`, `OrderStatusUpdate`
- `UserTable`, `UserForm`, `UserProfile`
- `PostEditor`, `PostList`, `PostPublish`
- `CouponForm`, `CouponList`
- `EmailCompose`, `EmailList`, `EmailDetail`
- `DeploymentHistory`, `LiveTerminal`
- `JobMonitor`, `QueueStatus`
- `SettingsForm` (generic, used by all settings pages)

## Dashboard Actions

Located in `storage/framework/defaults/actions/Dashboard/`:
- Settings actions — Get/Update for each settings category
- Commerce actions — CRUD operations for all commerce models
- Content actions — CRUD operations for content models
- Data actions — User count, subscriber count, metrics
- Deployment actions — Create, get, update deployments
- Job actions — Create, get, metrics
- Notification actions — Create, get, delivery rate
- Request actions — Analytics data

## Model Dashboard Integration

Models with `dashboard: { highlight: true }` appear prominently:
```typescript
defineModel({
  name: 'Product',
  dashboard: { highlight: true },  // highlighted in dashboard
  traits: {
    useApi: { uri: 'products', routes: ['index', 'store', 'show', 'update', 'destroy'] }
  }
})
```

The `useApi` trait auto-generates dashboard CRUD views for the model.

## Dashboard Development

```bash
buddy dev --dashboard        # start dashboard dev server
buddy dev -d                 # alias
buddy build:components       # build dashboard components
```

Port: 3002 (configured in `config/ports.ts` as `admin`)

## Gotchas
- Dashboard runs on port 3002 by default (separate from frontend on 3000)
- Dashboard components use STX templating with crosswind CSS
- 136+ routes are auto-typed in `storage/framework/types/dashboard-router.d.ts`
- Settings panels read/write from the corresponding `config/*.ts` files
- Models with `useApi` trait get auto-generated dashboard views
- `dashboard: { highlight: true }` makes models prominent in the dashboard
- Dashboard layout uses a sidebar + navbar pattern
- All dashboard actions are in `storage/framework/defaults/actions/Dashboard/`
- The live terminal component streams deployment output in real-time
