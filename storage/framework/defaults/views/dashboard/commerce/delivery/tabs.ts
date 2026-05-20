/**
 * Shared TabNavigation config for every `/commerce/delivery/*` page.
 *
 * The seven sub-pages under this directory (shipping methods, zones,
 * rates, digital delivery, license keys, delivery routes, drivers) all
 * render the same top-tab bar. Lifting the array here lets each page
 * import it once via `<script client>` instead of redeclaring the same
 * list in every file (stacksjs/stacks#1838).
 */

export interface DeliveryTab {
  name: string
  value: string
  href: string
}

export const deliveryTabs: readonly DeliveryTab[] = Object.freeze([
  { name: 'Shipping Methods', value: 'methods', href: '/commerce/delivery/shipping-methods' },
  { name: 'Shipping Zones', value: 'zones', href: '/commerce/delivery/shipping-zones' },
  { name: 'Shipping Rates', value: 'rates', href: '/commerce/delivery/shipping-rates' },
  { name: 'Digital Delivery', value: 'digital', href: '/commerce/delivery/digital-delivery' },
  { name: 'License Keys', value: 'license', href: '/commerce/delivery/license-keys' },
  { name: 'Delivery Routes', value: 'routes', href: '/commerce/delivery/delivery-routes' },
  { name: 'Drivers', value: 'drivers', href: '/commerce/delivery/drivers' },
])
