<script setup lang="ts">
import CardBrands from './card-brands.vue'

const paymentStore = usePaymentStore()

async function deletePayment(paymentMethodId: string) {
  await paymentStore.deletePaymentMethod(paymentMethodId)

  paymentStore.fetchUserPaymentMethods()
}
</script>

<template>
  <ul role="list" class="grid grid-cols-1 mt-4 gap-6 lg:grid-cols-1 sm:grid-cols-1">
    <li v-for="(method, index) in paymentStore.getPaymentMethods" :key="index" class="col-span-1 border rounded-lg bg-white shadow divide-y divide-gray-200">
      <div class="w-full p-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <CardBrands :brand="method.card.brand" alt="Brand Logo" />
            <h2 class="text-sm text-gray-600">
              {{ method.card.brand }} •••• {{ method.card.last4 }} <br>
              <span class="text-xs text-gray-500 italic">Expires {{ method.card.exp_month }} /  {{ method.card.exp_year }} </span>
            </h2>
          </div>

          <div class="flex justify-end space-x-4">
            <button
              type="button"
              class="border rounded-md bg-white px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
            >
              <svg class="h-4 w-4 text-gray-700" data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>

            <button
              aria-label="delete"
              type="button"
              class="border rounded-md bg-white px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
              @click="deletePayment(method.id)"
            >
              <svg class="h-4 w-4 text-gray-700" data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </li>
  </ul>
</template>
