<script setup lang="ts">
import { useBillable } from '../../../functions/billing/payments'

const paymentStore = usePaymentStore()

const { convertUnixTimestampToDate, editPlan } = useBillable()

async function cancelPlan() {
  await paymentStore.cancelPlan()

  await paymentStore.fetchUserActivePlan()
}

const subscriptionType = computed(() => {
  const type = paymentStore.getCurrentPlan.subscription.type

  return type.charAt(0).toUpperCase() + type.slice(1)
})

const nextPayment = computed(() => {
  return convertUnixTimestampToDate(paymentStore.getCurrentPlan.providerSubscription.current_period_end)
})

const unitPrice = computed(() => {
  return paymentStore.getCurrentPlan.subscription.unit_price / 100
})
</script>

<template>
  <div class="w-full">
    <h2 class="text-lg text-gray-900 font-medium">
      Plan Details
    </h2>

    <div class="pt-8">
      <p class="text-gray-700 font-bold">
        {{ subscriptionType }} Plan
      </p>

      <p class="pt-2 text-sm text-gray-500 font-normal italic">
        {{ paymentStore.getCurrentPlan.subscription.description }}
      </p>

      <p class="pt-4 text-sm text-gray-700 font-semibold">
        Next payment of ${{ unitPrice }} occurs on {{ nextPayment }}
      </p>
    </div>

    <div class="mt-8 flex">
      <button
        type="button"
        class="rounded-md bg-white px-2.5 py-1.5 text-sm text-gray-900 font-semibold shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50"
        @click="cancelPlan"
      >
        Cancel Plan
      </button>

      <button
        type="button"
        class="ml-4 rounded-md bg-blue-600 px-2.5 py-1.5 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
        @click="editPlan"
      >
        Change Plan
      </button>
    </div>
  </div>
</template>
