# Dashboard `.stx` audit — stacksjs/stacks#1838

_Generated 2026-05-04 from `storage/framework/defaults/views/dashboard/`._

## Roll-up

| Metric | Count |
|---|---:|
| Total `.stx` files | 110 |
| `<script server>` blocks | 98 |
| `<script client>` blocks | 78 |
| Bare `<script>` blocks (no qualifier) | 11 |
| `window.` / `document.` lines | 168 |
| Files importing from `stores/` | 0 |
| Files importing `@stacksjs/components` | 0 |

### Routing setup

Per `dashboard/stx.config.ts`, `pagesDir: 'views'` (with `root: 'resources'`) — meaning every top-level dir under `dashboard/` is a route group. The support dirs (`components/`, `composables/`, `layouts/`, `stores/`) are the only non-routed ones.

## Per-area roll-up

| Area | Files | server | client | bare | DOM lines | uses store | uses components |
|---|---:|---:|---:|---:|---:|---:|---:|
| `_root` | 5 | 4 | 0 | 1 | 0 | 0 | 0 |
| `access-tokens` | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| `actions` | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| `analytics` | 12 | 12 | 12 | 0 | 22 | 0 | 0 |
| `buddy` | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| `cloud` | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| `commands` | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| `commerce` | 27 | 25 | 21 | 2 | 18 | 0 | 0 |
| `components` | 1 | 1 | 1 | 0 | 1 | 0 | 0 |
| `content` | 9 | 9 | 8 | 0 | 27 | 0 | 0 |
| `data` | 5 | 5 | 5 | 0 | 21 | 0 | 0 |
| `dependencies` | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| `deployments` | 2 | 2 | 1 | 0 | 0 | 0 | 0 |
| `dns` | 1 | 1 | 1 | 0 | 1 | 0 | 0 |
| `environment` | 1 | 0 | 0 | 1 | 2 | 0 | 0 |
| `errors` | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| `functions` | 1 | 1 | 1 | 0 | 1 | 0 | 0 |
| `health` | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| `inbox` | 3 | 3 | 3 | 0 | 7 | 0 | 0 |
| `insights` | 1 | 1 | 1 | 0 | 4 | 0 | 0 |
| `jobs` | 3 | 3 | 3 | 0 | 2 | 0 | 0 |
| `layouts` | 2 | 1 | 2 | 0 | 15 | 0 | 0 |
| `logs` | 1 | 1 | 1 | 0 | 2 | 0 | 0 |
| `mailboxes` | 1 | 1 | 1 | 0 | 1 | 0 | 0 |
| `management` | 1 | 1 | 1 | 0 | 2 | 0 | 0 |
| `marketing` | 4 | 4 | 1 | 0 | 17 | 0 | 0 |
| `models` | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| `monitoring` | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| `notifications` | 4 | 4 | 3 | 0 | 2 | 0 | 0 |
| `packages` | 1 | 1 | 1 | 0 | 2 | 0 | 0 |
| `queries` | 4 | 4 | 2 | 0 | 2 | 0 | 0 |
| `queue` | 1 | 1 | 1 | 0 | 2 | 0 | 0 |
| `realtime` | 1 | 1 | 1 | 0 | 1 | 0 | 0 |
| `releases` | 1 | 0 | 1 | 1 | 2 | 0 | 0 |
| `requests` | 1 | 1 | 1 | 0 | 4 | 0 | 0 |
| `serverless` | 1 | 1 | 1 | 0 | 10 | 0 | 0 |
| `servers` | 2 | 2 | 1 | 0 | 0 | 0 | 0 |
| `settings` | 2 | 1 | 1 | 1 | 0 | 0 | 0 |
| `teams` | 1 | 1 | 0 | 0 | 0 | 0 | 0 |

## Per-file inventory

Columns: file → `<script server>` count, `<script client>` count, bare `<script>` count, `window.`/`document.` lines, store import (✓), `@stacksjs/components` import (✓).

### `_root/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `[...all].stx` | 0 | 0 | 1 | 0 |  |  |
| `forgot-password.stx` | 1 | 0 | 0 | 0 |  |  |
| `index.stx` | 1 | 0 | 0 | 0 |  |  |
| `login.stx` | 1 | 0 | 0 | 0 |  |  |
| `register.stx` | 1 | 0 | 0 | 0 |  |  |

### `access-tokens/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `access-tokens/index.stx` | 0 | 0 | 1 | 0 |  |  |

### `actions/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `actions/index.stx` | 0 | 0 | 1 | 0 |  |  |

### `analytics/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `analytics/blog/index.stx` | 1 | 1 | 0 | 1 |  |  |
| `analytics/browsers/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `analytics/commerce/sales/index.stx` | 1 | 1 | 0 | 1 |  |  |
| `analytics/commerce/web/index.stx` | 1 | 1 | 0 | 1 |  |  |
| `analytics/countries/index.stx` | 1 | 1 | 0 | 1 |  |  |
| `analytics/devices/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `analytics/events/index.stx` | 1 | 2 | 0 | 8 |  |  |
| `analytics/index.stx` | 1 | 0 | 0 | 0 |  |  |
| `analytics/marketing/index.stx` | 1 | 1 | 0 | 1 |  |  |
| `analytics/pages/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `analytics/referrers/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `analytics/web/index.stx` | 1 | 1 | 0 | 1 |  |  |

### `buddy/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `buddy/index.stx` | 0 | 0 | 1 | 0 |  |  |

### `cloud/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `cloud/index.stx` | 1 | 1 | 0 | 0 |  |  |

### `commands/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `commands/index.stx` | 0 | 0 | 1 | 0 |  |  |

### `commerce/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `commerce/categories/index.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/coupons/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `commerce/customers/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `commerce/dashboard/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `commerce/delivery/delivery-routes.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/delivery/digital-delivery.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/delivery/drivers.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/delivery/index.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/delivery/license-keys.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/delivery/shipping-methods.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/delivery/shipping-rates.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/delivery/shipping-zones.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/gift-cards/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `commerce/manufacturers/index.stx` | 1 | 0 | 0 | 0 |  |  |
| `commerce/orders/index.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/payments/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `commerce/pos/index.stx` | 1 | 0 | 0 | 1 |  |  |
| `commerce/printers/devices/index.stx` | 1 | 1 | 0 | 3 |  |  |
| `commerce/printers/receipts/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `commerce/products/detail.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/products/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `commerce/reviews/index.stx` | 1 | 0 | 0 | 0 |  |  |
| `commerce/taxes/index.stx` | 1 | 0 | 0 | 0 |  |  |
| `commerce/units/index.stx` | 0 | 0 | 1 | 0 |  |  |
| `commerce/variants/index.stx` | 0 | 0 | 1 | 0 |  |  |
| `commerce/waitlist/products.stx` | 1 | 1 | 0 | 0 |  |  |
| `commerce/waitlist/restaurant.stx` | 1 | 1 | 0 | 0 |  |  |

### `components/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `components/index.stx` | 1 | 1 | 0 | 1 |  |  |

### `content/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `content/authors/index.stx` | 1 | 1 | 0 | 8 |  |  |
| `content/categories/index.stx` | 1 | 1 | 0 | 3 |  |  |
| `content/comments/index.stx` | 1 | 1 | 0 | 3 |  |  |
| `content/dashboard.stx` | 1 | 1 | 0 | 2 |  |  |
| `content/files/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `content/pages/index.stx` | 1 | 1 | 0 | 3 |  |  |
| `content/posts/index.stx` | 1 | 1 | 0 | 3 |  |  |
| `content/seo/index.stx` | 1 | 0 | 0 | 0 |  |  |
| `content/tags/index.stx` | 1 | 1 | 0 | 3 |  |  |

### `data/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `data/activity/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `data/dashboard/index.stx` | 1 | 1 | 0 | 9 |  |  |
| `data/subscribers.stx` | 1 | 1 | 0 | 1 |  |  |
| `data/teams.stx` | 1 | 1 | 0 | 1 |  |  |
| `data/users.stx` | 1 | 1 | 0 | 8 |  |  |

### `dependencies/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `dependencies/index.stx` | 0 | 0 | 1 | 0 |  |  |

### `deployments/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `deployments/[id].stx` | 1 | 1 | 0 | 0 |  |  |
| `deployments/index.stx` | 1 | 0 | 0 | 0 |  |  |

### `dns/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `dns/index.stx` | 1 | 1 | 0 | 1 |  |  |

### `environment/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `environment/index.stx` | 0 | 0 | 1 | 2 |  |  |

### `errors/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `errors/index.stx` | 1 | 0 | 0 | 0 |  |  |

### `functions/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `functions/index.stx` | 1 | 1 | 0 | 1 |  |  |

### `health/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `health/index.stx` | 1 | 0 | 0 | 0 |  |  |

### `inbox/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `inbox/activity.stx` | 1 | 1 | 0 | 4 |  |  |
| `inbox/index.stx` | 1 | 1 | 0 | 3 |  |  |
| `inbox/settings.stx` | 1 | 1 | 0 | 0 |  |  |

### `insights/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `insights/index.stx` | 1 | 1 | 0 | 4 |  |  |

### `jobs/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `jobs/[id].stx` | 1 | 1 | 0 | 0 |  |  |
| `jobs/history.stx` | 1 | 1 | 0 | 0 |  |  |
| `jobs/index.stx` | 1 | 1 | 0 | 2 |  |  |

### `layouts/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `layouts/default.stx` | 1 | 2 | 0 | 15 |  |  |
| `layouts/guest.stx` | 0 | 0 | 0 | 0 |  |  |

### `logs/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `logs/index.stx` | 1 | 1 | 0 | 2 |  |  |

### `mailboxes/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `mailboxes/index.stx` | 1 | 1 | 0 | 1 |  |  |

### `management/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `management/permissions/index.stx` | 1 | 1 | 0 | 2 |  |  |

### `marketing/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `marketing/campaigns/index.stx` | 1 | 0 | 0 | 0 |  |  |
| `marketing/lists/index.stx` | 1 | 0 | 0 | 0 |  |  |
| `marketing/reviews/index.stx` | 1 | 1 | 0 | 17 |  |  |
| `marketing/social-posts/index.stx` | 1 | 0 | 0 | 0 |  |  |

### `models/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `models/[model].stx` | 1 | 0 | 0 | 0 |  |  |
| `models/index.stx` | 1 | 0 | 0 | 0 |  |  |

### `monitoring/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `monitoring/errors/index.stx` | 1 | 1 | 0 | 0 |  |  |

### `notifications/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `notifications/dashboard.stx` | 1 | 1 | 0 | 2 |  |  |
| `notifications/email.stx` | 1 | 1 | 0 | 0 |  |  |
| `notifications/history.stx` | 1 | 0 | 0 | 0 |  |  |
| `notifications/sms.stx` | 1 | 1 | 0 | 0 |  |  |

### `packages/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `packages/index.stx` | 1 | 1 | 0 | 2 |  |  |

### `queries/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `queries/[id].stx` | 1 | 1 | 0 | 0 |  |  |
| `queries/history.stx` | 1 | 0 | 0 | 0 |  |  |
| `queries/index.stx` | 1 | 1 | 0 | 2 |  |  |
| `queries/slow.stx` | 1 | 0 | 0 | 0 |  |  |

### `queue/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `queue/index.stx` | 1 | 1 | 0 | 2 |  |  |

### `realtime/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `realtime/index.stx` | 1 | 1 | 0 | 1 |  |  |

### `releases/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `releases/index.stx` | 0 | 1 | 1 | 2 |  |  |

### `requests/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `requests/index.stx` | 1 | 1 | 0 | 4 |  |  |

### `serverless/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `serverless/index.stx` | 1 | 1 | 0 | 10 |  |  |

### `servers/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `servers/[id].stx` | 1 | 0 | 0 | 0 |  |  |
| `servers/index.stx` | 1 | 1 | 0 | 0 |  |  |

### `settings/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `settings/billing.stx` | 1 | 1 | 0 | 0 |  |  |
| `settings/mail.stx` | 0 | 0 | 1 | 0 |  |  |

### `teams/`

| File | server | client | bare | DOM | store | components |
|---|---:|---:|---:|---:|:---:|:---:|
| `teams/[id].stx` | 1 | 0 | 0 | 0 |  |  |

## Vanilla DOM offenders (per-line)

Each line below is a future composable target. Lines truncated to 100 chars.

### `analytics/blog/index.stx`

```
650: const ctx = document.getElementById('trafficChart')
```

### `analytics/browsers/index.stx`

```
281: const distributionCtx = document.getElementById('browserDistributionChart')
296: const trendCtx = document.getElementById('browserTrendChart')
```

### `analytics/commerce/sales/index.stx`

```
425: const ctx = document.getElementById('salesChart')
```

### `analytics/commerce/web/index.stx`

```
554: const ctx = document.getElementById('trafficChart')
```

### `analytics/countries/index.stx`

```
344: const ctx = document.getElementById('countryChart')
```

### `analytics/devices/index.stx`

```
330: const distributionCtx = document.getElementById('deviceDistributionChart')
345: const trendCtx = document.getElementById('deviceTrendChart')
```

### `analytics/events/index.stx`

```
746: window.addEventListener('load', (event) => {
747: document.getElementById('about-link').addEventListener('click', () => {
766: window.addEventListener('load', (event) => {
767: document.getElementById('contact-form').addEventListener('submit', () => {
780: window.addEventListener('load', (event) => {
793: window.addEventListener('load', () => {
794: const path = window.location.pathname;
1148: const ctx = document.getElementById('eventChart')
```

### `analytics/marketing/index.stx`

```
460: const ctx = document.getElementById('marketingChart')
```

### `analytics/pages/index.stx`

```
333: const trendCtx = document.getElementById('pageViewsTrendChart')
352: const topPagesCtx = document.getElementById('topPagesChart')
```

### `analytics/referrers/index.stx`

```
368: const typeCtx = document.getElementById('referrerTypeChart')
407: const trendCtx = document.getElementById('referrerTrendChart')
```

### `analytics/web/index.stx`

```
645: const ctx = document.getElementById('trafficChart')
```

### `commerce/coupons/index.stx`

```
532: const chart_1_ctx = document.getElementById('chart_1')
541: const chart_2_ctx = document.getElementById('chart_2')
```

### `commerce/customers/index.stx`

```
101: window.location.href = `/dashboard/commerce/customers/${customer.id}`
105: window.location.href = `/dashboard/commerce/customers/${customer.id}?edit=true`
```

### `commerce/dashboard/index.stx`

```
245: const revenueCtx = document.getElementById('revenueChart')
254: const ordersCtx = document.getElementById('ordersChart')
```

### `commerce/gift-cards/index.stx`

```
627: const chart_1_ctx = document.getElementById('chart_1')
636: const chart_2_ctx = document.getElementById('chart_2')
```

### `commerce/payments/index.stx`

```
693: const chart_1_ctx = document.getElementById('chart_1')
702: const chart_2_ctx = document.getElementById('chart_2')
```

### `commerce/pos/index.stx`

```
430: const orderElement = document.getElementById('order-section')
```

### `commerce/printers/devices/index.stx`

```
291: const chart_1_ctx = document.getElementById('chart_1')
300: const chart_2_ctx = document.getElementById('chart_2')
309: const chart_3_ctx = document.getElementById('chart_3')
```

### `commerce/printers/receipts/index.stx`

```
311: const chart_1_ctx = document.getElementById('chart_1')
320: const chart_2_ctx = document.getElementById('chart_2')
```

### `commerce/products/index.stx`

```
123: window.location.href = `/dashboard/commerce/products/${product.id}`
127: window.location.href = `/dashboard/commerce/products/${product.id}?edit=true`
```

### `components/index.stx`

```
471: const chart_1_ctx = document.getElementById('chart_1')
```

### `content/authors/index.stx`

```
421: const link = document.createElement('a')
424: document.body.appendChild(link)
426: document.body.removeChild(link)
441: const canvas = document.createElement('canvas')
464: const link = document.createElement('a')
467: document.body.appendChild(link)
469: document.body.removeChild(link)
1494: const chart_1_ctx = document.getElementById('chart_1')
```

### `content/categories/index.stx`

```
995: const chart_1_ctx = document.getElementById('chart_1')
1004: const chart_2_ctx = document.getElementById('chart_2')
1013: const chart_3_ctx = document.getElementById('chart_3')
```

### `content/comments/index.stx`

```
1173: const chart_1_ctx = document.getElementById('chart_1')
1182: const chart_2_ctx = document.getElementById('chart_2')
1191: const chart_3_ctx = document.getElementById('chart_3')
```

### `content/dashboard.stx`

```
421: const chart_1_ctx = document.getElementById('chart_1')
430: const chart_2_ctx = document.getElementById('chart_2')
```

### `content/files/index.stx`

```
1166: const chart_1_ctx = document.getElementById('chart_1')
1175: const chart_2_ctx = document.getElementById('chart_2')
```

### `content/pages/index.stx`

```
1364: const chart_pages_1_ctx = document.getElementById('chart_pages_1')
1373: const chart_pages_2_ctx = document.getElementById('chart_pages_2')
1382: const chart_pages_3_ctx = document.getElementById('chart_pages_3')
```

### `content/posts/index.stx`

```
284: const chart_1_ctx = document.getElementById('chart_1')
293: const chart_2_ctx = document.getElementById('chart_2')
302: const chart_3_ctx = document.getElementById('chart_3')
```

### `content/tags/index.stx`

```
1112: const chart_1_ctx = document.getElementById('chart_1')
1121: const chart_2_ctx = document.getElementById('chart_2')
1130: const chart_3_ctx = document.getElementById('chart_3')
```

### `data/activity/index.stx`

```
608: refreshInterval = window.setInterval(() => {
1190: const chart_1_ctx = document.getElementById('chart_1')
```

### `data/dashboard/index.stx`

```
403: const link = document.createElement('a')
406: document.body.appendChild(link)
408: document.body.removeChild(link)
417: const canvas = document.createElement('canvas')
443: const link = document.createElement('a')
446: document.body.appendChild(link)
448: document.body.removeChild(link)
1082: window.removeEventListener('resize', createDiagram)
1279: window.addEventListener('resize', createDiagram)
```

### `data/subscribers.stx`

```
489: const chart_1_ctx = document.getElementById('chart_1')
```

### `data/teams.stx`

```
515: const chart_1_ctx = document.getElementById('chart_1')
```

### `data/users.stx`

```
528: const link = document.createElement('a')
531: document.body.appendChild(link)
533: document.body.removeChild(link)
548: const canvas = document.createElement('canvas')
571: const link = document.createElement('a')
574: document.body.appendChild(link)
576: document.body.removeChild(link)
618: const chart_1_ctx = document.getElementById('chart_1')
```

### `dns/index.stx`

```
220: const chart_1_ctx = document.getElementById('chart_1')
```

### `environment/index.stx`

```
22: function isMac() { return (typeof window !== 'undefined' && window.navigator?.platform?.toLowerCase(
211: window.removeEventListener('keydown', handleKeyboardShortcuts)
```

### `functions/index.stx`

```
476: const chart_1_ctx = document.getElementById('chart_1')
```

### `inbox/activity.stx`

```
574: const chart_1_ctx = document.getElementById('chart_1')
583: const chart_2_ctx = document.getElementById('chart_2')
592: const chart_3_ctx = document.getElementById('chart_3')
601: const chart_4_ctx = document.getElementById('chart_4')
```

### `inbox/index.stx`

```
437: document.addEventListener('click', handleClickOutside)
445: document.removeEventListener('click', handleClickOutside)
451: document.removeEventListener('click', handleClickOutside)
```

### `insights/index.stx`

```
854: const cpuCtx = document.getElementById('cpuChart')
863: const memoryCtx = document.getElementById('memoryChart')
872: const storageCtx = document.getElementById('storageChart')
881: document.querySelectorAll('.queue-chart').forEach((canvas) => {
```

### `jobs/index.stx`

```
375: const chart_1_ctx = document.getElementById('chart_1')
384: const chart_2_ctx = document.getElementById('chart_2')
```

### `layouts/default.stx`

```
69: window.craft = window.craft || {}
70: window.craft._sidebarSelectHandler = (event) => {
81: // Craft sidebar takes over inside the macOS window. We pick which one
85: //   2. `window.__craftNativeSidebar` — set by Craft's WKUserScript
86: //   3. `window.craft.window` — Craft's JS bridge is bound (window mode)
91: document.documentElement.setAttribute('data-has-stacks-sidebar', 'true')
92: var hasFlag = Boolean(window.__craftNativeSidebar)
93: var hasApi = Boolean(window.craft && window.craft.window)
94: var hasParam = window.location.search.indexOf('native-sidebar=1') !== -1
96: window.__craftNativeSidebar = true
97: document.documentElement.setAttribute('data-craft-native-sidebar', 'true')
102: if (!document.getElementById('stacks-sidebar-globals')) {
103: var s = document.createElement('style')
111: document.head.appendChild(s)
119: var secs = document.querySelectorAll('.sidebar-section[data-section]')
```

### `logs/index.stx`

```
366: refreshInterval = window.setInterval(() => {
960: const chart_1_ctx = document.getElementById('chart_1')
```

### `mailboxes/index.stx`

```
222: const chart_1_ctx = document.getElementById('chart_1')
```

### `management/permissions/index.stx`

```
574: const chart_1_ctx = document.getElementById('chart_1')
583: const chart_2_ctx = document.getElementById('chart_2')
```

### `marketing/reviews/index.stx`

```
625: const width = document.getElementById('rating-chart')?.clientWidth || 300;
626: const height = document.getElementById('rating-chart')?.clientHeight || 200;
657: .style('fill', document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280')
665: .style('fill', document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280');
695: .style('fill', document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151')
710: const width = document.getElementById('sentiment-chart')?.clientWidth || 300;
711: const height = document.getElementById('sentiment-chart')?.clientHeight || 200;
742: .style('fill', document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280')
750: .style('fill', document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280');
780: .style('fill', document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151')
795: const width = document.getElementById('source-chart')?.clientWidth || 300;
796: const height = document.getElementById('source-chart')?.clientHeight || 200;
832: .attr('stroke', document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff')
845: .style('fill', document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151')
865: .style('fill', document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151')
1631: window.addEventListener('resize', () => {
1644: observer.observe(document.documentElement, {
```

### `notifications/dashboard.stx`

```
498: const chart_1_ctx = document.getElementById('chart_1')
507: const chart_2_ctx = document.getElementById('chart_2')
```

### `packages/index.stx`

```
837: const chart_1_ctx = document.getElementById('chart_1')
846: const chart_2_ctx = document.getElementById('chart_2')
```

### `queries/index.stx`

```
564: const chart_1_ctx = document.getElementById('chart_1')
573: const chart_2_ctx = document.getElementById('chart_2')
```

### `queue/index.stx`

```
587: const throughputCtx = document.getElementById('throughputChart')
596: const waitTimeCtx = document.getElementById('waitTimeChart')
```

### `realtime/index.stx`

```
584: const chart_1_ctx = document.getElementById('chart_1')
```

### `releases/index.stx`

```
608: const chart_1_ctx = document.getElementById('chart_1')
617: const chart_2_ctx = document.getElementById('chart_2')
```

### `requests/index.stx`

```
428: const chart_1_ctx = document.getElementById('chart_1')
437: const chart_2_ctx = document.getElementById('chart_2')
446: const chart_3_ctx = document.getElementById('chart_3')
455: const chart_4_ctx = document.getElementById('chart_4')
```

### `serverless/index.stx`

```
490: const headerText = document.querySelector('.text-base.text-gray-900.dark\\:text-gray-100')
496: const description = document.querySelector('.mt-2.text-sm.text-gray-700.dark\\:text-gray-400')
542: const link = document.createElement('a')
545: document.body.appendChild(link)
547: document.body.removeChild(link)
562: const canvas = document.createElement('canvas')
585: const link = document.createElement('a')
588: document.body.appendChild(link)
590: document.body.removeChild(link)
862: const svgRects = document.querySelectorAll('.node svg rect');
```

## Suggested migration batches

Each batch is one feature area. Anything > ~12 files is split into sub-batches.

- **_root** (4 files): `forgot-password.stx`, `index.stx`, `login.stx`, `register.stx`
- **analytics** (12 files): `analytics/blog/index.stx`, `analytics/browsers/index.stx`, `analytics/commerce/sales/index.stx`, `analytics/commerce/web/index.stx`, `analytics/countries/index.stx`, `analytics/devices/index.stx`, `analytics/events/index.stx`, `analytics/index.stx`, `analytics/marketing/index.stx`, `analytics/pages/index.stx`, `analytics/referrers/index.stx`, `analytics/web/index.stx`
- **cloud** (1 files): `cloud/index.stx`
- **commerce** [1/3] (9 files): `commerce/categories/index.stx`, `commerce/coupons/index.stx`, `commerce/customers/index.stx`, `commerce/dashboard/index.stx`, `commerce/delivery/delivery-routes.stx`, `commerce/delivery/digital-delivery.stx`, `commerce/delivery/drivers.stx`, `commerce/delivery/index.stx`, `commerce/delivery/license-keys.stx`
- **commerce** [2/3] (9 files): `commerce/delivery/shipping-methods.stx`, `commerce/delivery/shipping-rates.stx`, `commerce/delivery/shipping-zones.stx`, `commerce/gift-cards/index.stx`, `commerce/manufacturers/index.stx`, `commerce/orders/index.stx`, `commerce/payments/index.stx`, `commerce/pos/index.stx`, `commerce/printers/devices/index.stx`
- **commerce** [3/3] (7 files): `commerce/printers/receipts/index.stx`, `commerce/products/detail.stx`, `commerce/products/index.stx`, `commerce/reviews/index.stx`, `commerce/taxes/index.stx`, `commerce/waitlist/products.stx`, `commerce/waitlist/restaurant.stx`
- **components** (1 files): `components/index.stx`
- **content** (9 files): `content/authors/index.stx`, `content/categories/index.stx`, `content/comments/index.stx`, `content/dashboard.stx`, `content/files/index.stx`, `content/pages/index.stx`, `content/posts/index.stx`, `content/seo/index.stx`, `content/tags/index.stx`
- **data** (5 files): `data/activity/index.stx`, `data/dashboard/index.stx`, `data/subscribers.stx`, `data/teams.stx`, `data/users.stx`
- **deployments** (2 files): `deployments/[id].stx`, `deployments/index.stx`
- **dns** (1 files): `dns/index.stx`
- **environment** (1 files): `environment/index.stx`
- **errors** (1 files): `errors/index.stx`
- **functions** (1 files): `functions/index.stx`
- **health** (1 files): `health/index.stx`
- **inbox** (3 files): `inbox/activity.stx`, `inbox/index.stx`, `inbox/settings.stx`
- **insights** (1 files): `insights/index.stx`
- **jobs** (3 files): `jobs/[id].stx`, `jobs/history.stx`, `jobs/index.stx`
- **layouts** (1 files): `layouts/default.stx`
- **logs** (1 files): `logs/index.stx`
- **mailboxes** (1 files): `mailboxes/index.stx`
- **management** (1 files): `management/permissions/index.stx`
- **marketing** (4 files): `marketing/campaigns/index.stx`, `marketing/lists/index.stx`, `marketing/reviews/index.stx`, `marketing/social-posts/index.stx`
- **models** (2 files): `models/[model].stx`, `models/index.stx`
- **monitoring** (1 files): `monitoring/errors/index.stx`
- **notifications** (4 files): `notifications/dashboard.stx`, `notifications/email.stx`, `notifications/history.stx`, `notifications/sms.stx`
- **packages** (1 files): `packages/index.stx`
- **queries** (4 files): `queries/[id].stx`, `queries/history.stx`, `queries/index.stx`, `queries/slow.stx`
- **queue** (1 files): `queue/index.stx`
- **realtime** (1 files): `realtime/index.stx`
- **releases** (1 files): `releases/index.stx`
- **requests** (1 files): `requests/index.stx`
- **serverless** (1 files): `serverless/index.stx`
- **servers** (2 files): `servers/[id].stx`, `servers/index.stx`
- **settings** (1 files): `settings/billing.stx`
- **teams** (1 files): `teams/[id].stx`
