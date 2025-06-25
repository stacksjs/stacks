<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Commerce Delivery',
})

const router = useRouter()

onMounted(() => {
  // Redirect to shipping methods by default
  router.replace('/commerce/delivery/shipping-methods')
})
</script>

<template>
  <div class="py-6">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Delivery</h1>
    </div>
    <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
      <div class="py-4">
        <!-- Router view will render the active tab component -->
        <router-view />
      </div>
    </div>
  </div>
</template>
