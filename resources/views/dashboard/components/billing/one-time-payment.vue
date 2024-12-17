<script setup lang="ts">
import PaymentForm from './payment-form.vue'
</script>

<template>
  <div class="spacep-x-2 flex border border-gray-200 rounded-md p-4">
    <ul role="list" class="w-1/3 text-sm text-gray-900 font-medium divide-y divide-gray-200">
      <li class="items-ce flex space-x-4">
        <img src="https://tailwindui.com/plus/img/ecommerce-images/checkout-page-04-product-01.jpg" alt="Moss green canvas compact backpack with double top zipper, zipper front pouch, and matching carry handle and backpack straps." class="size-20 flex-none border rounded-md object-cover">
        <div class="mt-2 flex-auto space-y-1">
          <h3>Micro Backpack</h3>
          <p class="flex-none text-sm font-medium">
            $70.00
          </p>
        </div>
      </li>
    </ul>
    <PaymentForm class="w-2/3" />
  </div>
</template>
