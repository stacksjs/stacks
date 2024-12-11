<script setup lang="ts">
import { useBillable } from '../../../../functions/billing/payments'

const { loadPaymentElement, handleAddPaymentMethod } = useBillable()
const paymentStore = usePaymentStore()

const paymentIntent = ref('')
const element = ref(null as any)

onMounted(async () => {
  paymentIntent.value = await paymentStore.fetchSetupIntent(1)

  element.value = await loadPaymentElement(paymentIntent.value)
})

async function addPaymentMethod() {
  await handleAddPaymentMethod(paymentIntent.value, element.value)
}
</script>

<template>
  <div>
    <form
      id="payment-form"
    >
      <div id="link-authentication-element" />
      <div id="card-element" />
      <button type="button" class="mt-4 w-full rounded bg-indigo-600 px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 focus-visible:outline" @click="addPaymentMethod">
        Save Payment Method
      </button>
    </form>
  </div>
</template>

<style>
#payment-message {
  color: rgb(105, 115, 134);
  font-size: 16px;
  line-height: 20px;
  padding-top: 12px;
  text-align: center;
}

#payment-element {
  margin-bottom: 24px;
}

#payment-form {
  width: 30vw;
  min-width: 500px;
  align-self: center;
  border-radius: 7px;
  padding: 40px;
}
</style>
