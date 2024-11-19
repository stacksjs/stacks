<script setup lang="ts">
import { useBillable } from '../../../functions/billing/payments'

import ActivePlan from '../components/billing/active-plan.vue'
import PaymentMethod from '../components/billing/payment-method.vue'
import Plans from '../components/billing/plans.vue'

const { isEmpty } = useBillable()

const paymentStore = usePaymentStore()

onMounted(() => {
  paymentStore.fetchStripeCustomer().then(async () => {
    if (!isEmpty(paymentStore.getStripeCustomer)) {
      await paymentStore.fetchDefaultPaymentMethod()
      await paymentStore.fetchUserPaymentMethods()
      await paymentStore.fetchUserActivePlan()
    }
  })
})
</script>

<template>
  <div class="mx-auto px-4 py-8 container lg:px-8">
    <div id="subscribed">
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
                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                      Dashboard Subscription <em class="italic">(monthly)</em>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      30/07/2023
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      $20.00
                    </td>

                    <td class="flex items-center whitespace-nowrap px-3 py-4 text-sm text-gray-500 space-x-2">
                      <img src="/images/logos/visa.png" alt="Visa Logo" class="w-8">
                      <span>•••• •••• •••• 0000</span>
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

      <div class="flex space-x-8">
        <ActivePlan />

        <Plans v-if="isEmpty(paymentStore.getCurrentPlan)" />
        <PaymentMethod />
      </div>
    </div>
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
