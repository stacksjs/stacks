<script setup lang="ts">
import { ref } from 'vue'

const cardNumber = ref('')

function formatCardNumber(e: Event) {
  const input = e.target as HTMLInputElement
  let value = input.value.replace(/\D/g, '')
  value = value.replace(/(.{4})/g, '$1 ').trim()
  cardNumber.value = value
}

const expiryDate = ref('')

function formatExpiryDate(e: Event) {
  const input = e.target as HTMLInputElement
  let value = input.value.replace(/\D/g, '')

  if (value.length > 2) {
    value = `${value.slice(0, 2)}/${value.slice(2)}`
  }

  expiryDate.value = value.slice(0, 5)
}
</script>

<template>
  <div class="flex items-center justify-center bg-gray-50 px-4 py-8 lg:px-8 sm:px-6">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="text-center text-3xl text-gray-900 font-extrabold">
          Payment Form
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Enter your card details below
        </p>
      </div>
      <form id="payment-form" class="mt-8 rounded-lg bg-white p-6 shadow-md space-y-6">
        <div>
          <label for="card-number" class="block text-sm text-gray-700 font-medium">Card Number</label>
          <input
            id="card-number"
            v-model="cardNumber"
            type="text"
            maxlength="19"
            placeholder="4242 4242 4242 4242"
            class="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-2 shadow-sm focus:border-indigo-500 sm:text-sm focus:ring-indigo-500"
            @input="formatCardNumber"
          >
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="expiry-date" class="block text-sm text-gray-700 font-medium">Expiry Date</label>
            <input
              id="expiry-date"
              v-model="expiryDate"
              type="text"
              maxlength="5"
              placeholder="MM/YY"
              class="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-2 shadow-sm focus:border-indigo-500 sm:text-sm focus:ring-indigo-500"
              @input="formatExpiryDate"
            >
          </div>
          <div>
            <label for="cvc" class="block text-sm text-gray-700 font-medium">CVC</label>
            <input
              id="cvc"
              type="text"
              maxlength="3"
              placeholder="CVC"
              class="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-2 shadow-sm focus:border-indigo-500 sm:text-sm focus:ring-indigo-500"
              required
            >
          </div>
        </div>

        <div class="mt-6 flex justify-between space-x-4">
          <button
            type="button"
            class="w-full border border-gray-300 rounded-lg bg-white px-4 py-2 text-sm text-gray-700 font-medium shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>

          <button
            type="submit"
            class="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save Payment Method
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
