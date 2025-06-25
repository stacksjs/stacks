<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script setup lang="ts">
import { useBillable } from '../../../functions/billing/payments'
import ActivePlan from '../../../components/Dashboard/Billing/ActivePlan.vue'
import PaymentMethod from '../../../components/Dashboard/Billing/PaymentMethod.vue'
import Plans from '../../../components/Dashboard/Billing/Plans.vue'
import LoadingDetails from '../../../components/Dashboard/Skeleton/LoadingCard.vue'
import TransactionHistory from '../../../components/Dashboard/Transaction/index.vue'

const { isEmpty, showCurrentPlan } = useBillable()

const paymentStore = usePaymentStore()

onMounted(async () => {
  await paymentStore.fetchStripeCustomer(1).then(async () => {
    if (!isEmpty(paymentStore.getStripeCustomer)) {
      await paymentStore.fetchDefaultPaymentMethod(1)
      await paymentStore.fetchUserActivePlan(1)
      await paymentStore.fetchTransactionHistory(1)
    }
  })
})
</script>

<template>
  <div class="mx-auto px-4 py-8 container lg:px-8">
    <div id="subscribed">
      <TransactionHistory />
      <div class="flex space-x-8">
        <div class="mt-16 w-2/3 bg-white px-8 py-6 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <LoadingDetails v-if="paymentStore.isStateLoading('fetchActivePlan') && paymentStore.isStateLoading('fetchStripeCustomer')" :height="24" />
          <div v-else class="w-full">
            <ActivePlan v-if="showCurrentPlan" />
            <Plans v-else />
          </div>
        </div>
        <PaymentMethod />
      </div>
    </div>
  </div>
</template>
