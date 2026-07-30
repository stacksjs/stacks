import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('dashboard button contract', () => {
  test('uses one canonical reusable button component', () => {
    const button = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/UI/Button.stx'),
      'utf8',
    )

    expect(existsSync(resolve('storage/framework/defaults/resources/components/Button.stx'))).toBe(false)
    expect(existsSync(resolve('storage/framework/defaults/resources/components/Buttons/BaseButton.stx'))).toBe(false)
    expect(button).toContain('bg-gradient-to-b from-blue-500 to-blue-600')
    expect(button).toContain("variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'")
    expect(button).toContain("tag?: 'button' | 'a'")
    expect(button).toContain("const liveDownload = useReactiveProp('download', '')")
  })

  test('routes primary commerce actions through the canonical component', () => {
    const files = [
      'CommerceProductsDashboard.stx',
      'CommerceProductDialog.stx',
      'CommerceProductDeleteDialog.stx',
      'CommerceProductDetailDashboard.stx',
      'CommerceCustomersDashboard.stx',
      'CommerceCustomerDialog.stx',
      'CommerceCustomerDeleteDialog.stx',
      'CommerceCustomerDetailsDialog.stx',
      'CommerceOrdersDashboard.stx',
      'CommerceOrderDialog.stx',
      'CommerceOrderDeleteDialog.stx',
      'CommerceOrderDetailsDialog.stx',
      'CommerceCouponsDashboard.stx',
      'CommerceCouponDialog.stx',
      'CommerceCouponDeleteDialog.stx',
      'CommerceCouponDetailsDialog.stx',
      'CommerceGiftCardsDashboard.stx',
      'CommerceGiftCardDialog.stx',
      'CommerceGiftCardDeleteDialog.stx',
      'CommerceGiftCardDetailsDialog.stx',
      'CommerceCategoriesTable.stx',
      'CommerceManufacturersTable.stx',
      'CommerceUnitsTable.stx',
      'CommerceTaxesTable.stx',
      'CommerceVariantsTable.stx',
      'CommerceReviewsTable.stx',
      'CommerceProductsTable.stx',
      'CommerceCustomersTable.stx',
      'CommerceOrdersTable.stx',
      'CommerceCouponsTable.stx',
      'CommerceGiftCardsTable.stx',
      'CommercePaymentsTable.stx',
      'PrintDevicesTable.stx',
      'PrintLogsTable.stx',
      'ProductWaitlistTable.stx',
      'CommerceOverviewDashboard.stx',
      'CommercePosDashboard.stx',
      'CommercePosCatalog.stx',
      'CommercePosCart.stx',
      'CommercePosCheckoutDialog.stx',
      'CommercePosReceiptDialog.stx',
      'PaymentDetailsDialog.stx',
      'PaymentRefundDialog.stx',
      'Delivery/DeliveryOverviewDashboard.stx',
      'Delivery/ShippingMethodsDashboard.stx',
      'Delivery/DriversDashboard.stx',
      'Delivery/DeliveryRoutesDashboard.stx',
      'Delivery/LicenseKeysDashboard.stx',
      'Delivery/ShippingZonesDashboard.stx',
      'Delivery/DigitalDeliveriesDashboard.stx',
      'Delivery/ShippingRatesDashboard.stx',
      'Delivery/DigitalDeliveryTable.stx',
      'Delivery/DeliveryRoutesTable.stx',
      'Delivery/LicenseKeysTable.stx',
      'Delivery/ShippingMethodsTable.stx',
      'Delivery/DriversTable.stx',
      'Delivery/ShippingZonesTable.stx',
      'Delivery/ShippingRatesTable.stx',
    ]

    for (const file of files) {
      const source = readFileSync(
        resolve('storage/framework/defaults/resources/components/Dashboard/Commerce', file),
        'utf8',
      )
      const nativeButtons = [...source.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

      expect(source).toContain('<Button')
      expect(nativeButtons.every(button => button.includes('absolute inset-0 bg-black/45'))).toBe(true)
    }
  })
})
