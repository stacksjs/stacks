<script setup lang="ts">
import CardBrands from './card-brands.vue'
// import { notification } from '@stacksjs/notification'
// import { Popover, PopoverPanel, PopoverButton } from '@stacksjs/popover'

const isDefaultLoading = ref<{ [key: string]: boolean }>({})

const paymentStore = usePaymentStore()

async function deletePayment(paymentMethodId: string) {
  await paymentStore.deletePaymentMethod(paymentMethodId)

  paymentStore.fetchUserPaymentMethods()
}

async function makeDefault(paymentMethodId: string) {
  isDefaultLoading.value[paymentMethodId] = true

  await paymentStore.updateDefaultPaymentMethod(paymentMethodId)

  await paymentStore.fetchUserPaymentMethods()
  await paymentStore.fetchDefaultPaymentMethod()

  // notification.success('Default payment method updated')
  isDefaultLoading.value[paymentMethodId] = false
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
              @click="makeDefault(method.id)"
              :disabled="isDefaultLoading[method.id]"
            >
              <svg v-if="!isDefaultLoading[method.id]" class="h-4 w-4 text-gray-700" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>

              <svg v-else class="h-4 w-4 text-gray-700 animate-spin" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25" stroke-width="4"></circle>
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round"></path>
              </svg>
            </button>

            <!-- <button
              aria-label="delete"
              type="button"
              class="border rounded-md bg-white px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
              @click="deletePayment(method.id)"
            >
              <svg class="h-4 w-4 text-gray-700" data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button> -->

            <!-- <Popover v-slot="{ open }" class="relative">
              <PopoverButton
                :class="open ? 'text-white' : 'text-white/90'"
                class="border rounded-md bg-white px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
              >
                <svg class="h-4 w-4 text-gray-700" data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </PopoverButton>

              <PopoverPanel
                class="absolute left-1/2 z-10 mt-3 w-screen max-w-sm -translate-x-1/2 transform px-4 sm:px-0 lg:max-w-3xl"
              >
                <div class="p-4">
                  <h3 class="text-lg font-medium leading-6 text-gray-900">Delete Payment Method</h3>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500">Are you sure you want to delete this payment method?</p>
                  </div>
                  <div class="mt-4 flex justify-end">
                    <button type="button" class="border rounded-md bg-white px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline">
                      Delete
                    </button>
                  </div>
                </div>
              </PopoverPanel>
            </Popover> -->
          </div>
        </div>
      </div>
    </li>
  </ul>
</template>
