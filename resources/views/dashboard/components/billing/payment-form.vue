<script setup lang="ts">
import { ref } from 'vue';

const cardNumber = ref('');

const formatCardNumber = (e: Event) => {
  const input = e.target as HTMLInputElement
  let value = input.value.replace(/\D/g, '')
  value = value.replace(/(.{4})/g, '$1 ').trim()
  cardNumber.value = value
}

const expiryDate = ref('');

const formatExpiryDate = (e: Event) => {
  const input = e.target as HTMLInputElement
  let value = input.value.replace(/\D/g, '')

  if (value.length > 2) {
    value = value.slice(0, 2) + '/' + value.slice(2)
  }

  expiryDate.value = value.slice(0, 5)
}
</script>

<template>
  <div class="flex items-center py-8 justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="text-center text-3xl font-extrabold text-gray-900">
          Payment Form
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Enter your card details below
        </p>
      </div>
      <form id="payment-form" class="mt-8 space-y-6 bg-white p-6 rounded-lg shadow-md">
        <div>
          <label for="card-number" class="block text-sm font-medium text-gray-700">Card Number</label>
          <input
            type="text"
            id="card-number"
            maxlength="19"
            placeholder="4242 4242 4242 4242"
            v-model="cardNumber"
            @input="formatCardNumber"
            class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="expiry-date" class="block text-sm font-medium text-gray-700">Expiry Date</label>
            <input
              type="text"
              id="expiry-date"
              maxlength="5"
              placeholder="MM/YY"
              v-model="expiryDate"
              @input="formatExpiryDate"
              class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label for="cvc" class="block text-sm font-medium text-gray-700">CVC</label>
            <input
              type="text"
              id="cvc"
              maxlength="3"
              placeholder="CVC"
              class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
            />
          </div>
        </div>
        
        <div class="flex justify-between mt-6 space-x-4">
          <button
            type="button"
            class="py-2 px-4 w-full rounded-lg border border-gray-300 shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>

          <button
            type="submit"
            class="py-2 px-4 w-full rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save Payment Method
          </button>
        </div>
      </form>
    </div>
  </div>
</template>