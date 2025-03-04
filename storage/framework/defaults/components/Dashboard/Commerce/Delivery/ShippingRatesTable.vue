<template>
  <div class="mt-8 flow-root">
    <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
      <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
        <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
          <thead>
            <tr>
              <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Method</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Zone</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Weight From</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Weight To</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Rate</th>
              <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
            <tr v-for="rate in rates" :key="rate.id">
              <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                {{ getMethodName(rate.methodId) }}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                {{ getZoneName(rate.zoneId) }}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                {{ rate.weightFrom }} kg
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                {{ rate.weightTo }} kg
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                {{ formatCurrency(rate.rate) }}
              </td>
              <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" title="Edit" @click="$emit('edit', rate)">
                  <div class="i-hugeicons-edit-01 h-5 w-5" />
                </button>
                <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-md border border-transparent hover:border-red-200 dark:hover:border-red-800" title="Delete" @click="$emit('delete', rate)">
                  <div class="i-hugeicons-waste h-5 w-5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ShippingRate {
  id: number
  methodId: number
  zoneId: number
  weightFrom: number
  weightTo: number
  rate: number
}

interface ShippingMethod {
  id: number
  name: string
}

interface ShippingZone {
  id: number
  name: string
}

const props = defineProps({
  rates: {
    type: Array as () => ShippingRate[],
    required: true
  },
  methods: {
    type: Array as () => ShippingMethod[],
    required: true
  },
  zones: {
    type: Array as () => ShippingZone[],
    required: true
  }
})

defineEmits(['edit', 'delete'])

const getMethodName = (methodId: number): string => {
  const method = props.methods.find(m => m.id === methodId)
  return method ? method.name : 'Unknown'
}

const getZoneName = (zoneId: number): string => {
  const zone = props.zones.find(z => z.id === zoneId)
  return zone ? zone.name : 'Unknown'
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}
</script>
