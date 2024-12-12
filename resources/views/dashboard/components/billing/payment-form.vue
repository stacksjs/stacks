<script setup lang="ts">
import { useBillable } from '../../../../functions/billing/payments'

const { loadCardForm, handleAddPaymentMethod } = useBillable()
const paymentStore = usePaymentStore()

const paymentIntent = ref('')
const element = ref(null as any)

onMounted(async () => {
  element.value = await loadCardForm()
})

async function addPaymentMethod() {
  await handleAddPaymentMethod(paymentIntent.value, element.value)
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
      <button type="button" class="mt-6 w-full rounded bg-indigo-600 px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 focus-visible:outline" @click="addPaymentMethod">
        Save Payment Method
      </button>
    </form>
  </div>
</template>
