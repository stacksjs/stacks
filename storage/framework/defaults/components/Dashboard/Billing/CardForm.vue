<script setup lang="ts">
import { useBillable } from '../../../functions/billing/payments'

const emit = defineEmits(['cancelPaymentMethodAddition'])
const { loadCardForm, handleAddPaymentMethod } = useBillable()
const paymentStore = usePaymentStore()

const element = ref(null as any)
let clientSecret: string

onMounted(async () => {
  clientSecret = await paymentStore.fetchSetupIntent(1)

  element.value = await loadCardForm(clientSecret)
})

async function addPaymentMethod() {
  await handleAddPaymentMethod(clientSecret, element.value)

  await paymentStore.fetchUserPaymentMethods(1)
  await paymentStore.fetchDefaultPaymentMethod(1)

  emit('cancelPaymentMethodAddition')
}
</script>

<template>
  <div>
    <form
      id="card-form"
      class="mt-8 border border-gray-200 p-8"
    >
      <div id="link-authentication-element" />
      <div id="card-element" />

      <div class="mt-6 flex space-x-2">
        <button type="button" class="w-full rounded bg-indigo-600 px-2 py-1.5 text-sm text-white font-semibold shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 focus-visible:outline" @click="addPaymentMethod">
          Save Payment Method
        </button>

        <button type="button" class="w-full rounded bg-white px-2 py-1.5 text-sm text-gray-900 font-semibold shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50" @click="emit('cancelPaymentMethodAddition')">
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>
