<script setup lang="ts">
import { useBillable } from '../../../../functions/billing/payments'

const paymentStore = usePaymentStore()

const { isEmpty } = useBillable()

async function cancelPlan() {
  paymentStore.cancelPlan()
}
</script>

<template>
  <div v-if="!isEmpty(paymentStore.getCurrentPlan)" class="mt-16 w-2/3 bg-white px-8 py-6 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
    <h2 class="text-lg text-gray-900 font-medium">
      Plan Details
    </h2>

    <div class="pt-2">
      <p class="text-gray-700 font-bold">
        {{ paymentStore.getCurrentPlan.type }} Plan
      </p>

      <p class="pt-2 text-sm text-gray-500 font-normal italic">
        {{ paymentStore.getCurrentPlan.description }}
      </p>

      <p class="pt-4 text-sm text-gray-700 font-semibold">
        Next payment of $20 (yearly) occurs on August 30, 2025
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
      >
        Change Plan
      </button>
    </div>
  </div>
</template>
