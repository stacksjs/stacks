<script setup lang="ts">
import SettingsHeader from '../../components/SettingsHeader.vue'
</script>

<template>
  <SettingsHeader />

  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex space-x-4">
      <div class="bg-white shadow-md px-8 py-6 rounded-md w-1/3">
        <div class="flex items-center">
          <img
            src="/stacks.png"
            alt=""
            class="w-12 h-12 rounded-md"
          >
          <h2 class="text-lg font-medium text-gray-900 ml-4">
            Stacks Dashboard
          </h2>
        </div>

        <div class="pt-8">
          <p class="text-gray-500">
            Switch your subscription to a different type, such as a monthly plan, annual plan, or student plan. And see a list of subscription plans that Stacks offers.
          </p>

          <p class="text-gray-700 pt-4 font-semibold text-sm">
            Next payment of $20 (yearly) occurs on August 30, 2023
          </p>
        </div>

        <div class="flex mt-8">
          <button
            type="button"
            class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancel Plan
          </button>

          <button
            type="button"
            class="rounded-md ml-4  bg-blue-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Change Plan
          </button>
        </div>
      </div>

      <div class="bg-white shadow-md px-8 py-6 rounded-md w-2/3">
        <h2 class="text-lg font-medium text-gray-900">
          Payment
        </h2>

        <fieldset class="mt-4">
          <legend class="sr-only">
            Payment type
          </legend>
          <div class="space-y-4 sm:flex sm:items-center sm:space-x-10 sm:space-y-0">
            <div class="flex items-center">
              <input
                id="credit-card"
                name="payment-type"
                type="radio"
                class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              >
              <label
                for="credit-card"
                class="ml-3 block text-sm font-medium text-gray-700"
              >Credit card</label>
            </div>
            <div class="flex items-center">
              <input
                id="paypal"
                name="payment-type"
                type="radio"
                class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              >
              <label
                for="paypal"
                class="ml-3 block text-sm font-medium text-gray-700"
              >PayPal</label>
            </div>
          </div>
        </fieldset>

        <div class="mt-6 grid grid-cols-4 gap-x-4 gap-y-6">
          <div class="col-span-4">
            <label
              for="card-number"
              class="block text-sm font-medium text-gray-700"
            >Card number</label>
            <div class="mt-1">
              <input
                id="card-number"
                type="text"
                name="card-number"
                autocomplete="cc-number"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
            </div>
          </div>

          <div class="col-span-4">
            <label
              for="name-on-card"
              class="block text-sm font-medium text-gray-700"
            >Name on card</label>
            <div class="mt-1">
              <input
                id="name-on-card"
                type="text"
                name="name-on-card"
                autocomplete="cc-name"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
            </div>
          </div>

          <div class="col-span-3">
            <label
              for="expiration-date"
              class="block text-sm font-medium text-gray-700"
            >Expiration date (MM/YY)</label>
            <div class="mt-1">
              <input
                id="expiration-date"
                type="text"
                name="expiration-date"
                autocomplete="cc-exp"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
            </div>
          </div>

          <div>
            <label
              for="cvc"
              class="block text-sm font-medium text-gray-700"
            >CVC</label>
            <div class="mt-1">
              <input
                id="cvc"
                type="text"
                name="cvc"
                autocomplete="csc"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-md shadow-md p-4 mt-8">
      <h3 class="font-semibold text-xl">
        Transaction History
      </h3>

      <div class="mt-4 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-3"
                  >
                    Transaction
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Payment Method
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white">
                <tr class="even:bg-gray-50">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-3">
                    Stacks Subscription
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    30/07/2023
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    $20.00
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    •••• •••• •••• 0000
                  </td>
                </tr>

              <!-- More people... -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
