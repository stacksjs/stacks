import { describe, expect, test } from 'bun:test'
import Comment from '../../../defaults/app/Models/Comment'
import Notification from '../../../defaults/app/Models/Notification'
import NotificationDelivery from '../../../defaults/app/Models/NotificationDelivery'
import Cart from '../../../defaults/app/Models/commerce/Cart'
import CartItem from '../../../defaults/app/Models/commerce/CartItem'
import Coupon from '../../../defaults/app/Models/commerce/Coupon'
import Customer from '../../../defaults/app/Models/commerce/Customer'
import DeliveryRoute from '../../../defaults/app/Models/commerce/DeliveryRoute'
import DigitalDelivery from '../../../defaults/app/Models/commerce/DigitalDelivery'
import Driver from '../../../defaults/app/Models/commerce/Driver'
import GiftCard from '../../../defaults/app/Models/commerce/GiftCard'
import LicenseKey from '../../../defaults/app/Models/commerce/LicenseKey'
import LoyaltyPoint from '../../../defaults/app/Models/commerce/LoyaltyPoint'
import Payment from '../../../defaults/app/Models/commerce/Payment'
import PrintDevice from '../../../defaults/app/Models/commerce/PrintDevice'
import Receipt from '../../../defaults/app/Models/commerce/Receipt'
import Transaction from '../../../defaults/app/Models/commerce/Transaction'

describe('sensitive model API security', () => {
  test.each([
    ['cart', Cart],
    ['cart item', CartItem],
    ['comment', Comment],
    ['coupon', Coupon],
    ['customer', Customer],
    ['delivery route', DeliveryRoute],
    ['digital delivery', DigitalDelivery],
    ['driver', Driver],
    ['gift card', GiftCard],
    ['license key', LicenseKey],
    ['loyalty point', LoyaltyPoint],
    ['notification', Notification],
    ['notification delivery', NotificationDelivery],
    ['payment', Payment],
    ['print device', PrintDevice],
    ['receipt', Receipt],
    ['transaction', Transaction],
  ])('protects every generated %s API route', (_name, model) => {
    expect(model.traits.useApi).toMatchObject({
      middleware: ['auth'],
    })
  })
})
