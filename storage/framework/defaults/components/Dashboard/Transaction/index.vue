<script setup lang="ts">
import { useBillable } from '../../../functions/billing/payments'
import CardBrands from '../Billing/CardBrands.vue'

interface Recurring {
  aggregate_usage: string | null
  interval: string
  interval_count: number
  meter: string | null
  trial_period_days: number | null
  usage_type: string
}

interface Price {
  id: string
  object: string
  active: boolean
  billing_scheme: string
  created: number
  currency: string
  custom_unit_amount: number | null
  livemode: boolean
  lookup_key: string | null
  metadata: Record<string, unknown>
  nickname: string | null
  product: string
  recurring: Recurring
  tax_behavior: string
  tiers_mode: string | null
  transform_quantity: unknown | null
  type: string
  unit_amount: number
  unit_amount_decimal: string
}

interface Plan {
  id: string
  object: string
  active: boolean
  amount: number
  currency: string
  interval: string
  interval_count: number
}

interface LineItem {
  id: string
  object: string
  plan: Plan
  price: Price
}
const { formatTimestampDate } = useBillable()

const paymentStore = usePaymentStore()

function getTransactionType(lineData: LineItem[]) {
  return lineData[0]?.plan.interval
}

function getUnitPrice(lineData: LineItem[]) {
  return (Number((lineData[0]?.price.unit_amount)) / 100).toFixed(2)
}

function getLastDigits(paymentIntent: any) {
  return paymentIntent.payment_method.card.last4
}
</script>

<template>
  <div class="sm:flex sm:items-center">
    <div class="sm:flex-auto">
      <h1 class="text-base text-gray-900 font-semibold leading-6">
        Transaction History
      </h1>
      <p class="mt-2 text-sm text-gray-700">
        A list with all your Stacks-relating transactions.
      </p>
    </div>
  </div>

  <div class="mt-8 flow-root">
    <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
      <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
        <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 font-semibold sm:pl-6">
                  Transaction
                </th>

                <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                  Date
                </th>

                <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                  Amount
                </th>

                <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                  Payment Method
                </th>

                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Edit</span>
                </th>
              </tr>
            </thead>

            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="(transaction, index) in paymentStore.getTransactionHistory" :key="index">
                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                  Dashboard Subscription <em class="italic">({{ getTransactionType(transaction.name) }}ly)</em>
                </td>

                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {{ formatTimestampDate(transaction.created_at) }}
                </td>

                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  ${{ getUnitPrice(transaction.unit_price) }}
                </td>

                <td class="flex items-center whitespace-nowrap px-3 py-4 text-sm text-gray-500 space-x-2">
                  <CardBrands :width="2" :brand="transaction.brand" alt="Brand Logo" />
                  <span>•••• •••• •••• {{ getLastDigits(transaction.payment_intent) }}</span>
                </td>

                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <a href="#" class="text-blue-600 hover:text-blue-900">View<span class="sr-only">, Transaction</span></a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
