<template>
  <div class="mt-6 flow-root">
    <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
      <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
        <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-700">
              <tr>
                <th scope="col" class="py-4 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Key</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Template</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Customer</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Product</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Order ID</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Date Created</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Expiry Date</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
              <tr v-for="licenseKey in licenseKeys" :key="licenseKey.id">
                <td class="whitespace-nowrap py-4.5 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                  {{ licenseKey.key }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ getTemplateName(licenseKey.templateId) }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ licenseKey.customerName }}
                  <div class="text-xs text-gray-400 dark:text-gray-500">{{ licenseKey.customerEmail }}</div>
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ licenseKey.productName }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ licenseKey.orderId }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ formatDate(licenseKey.dateCreated) }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ formatDate(licenseKey.expiryDate) }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm">
                  <span
                    class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                    :class="{
                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': licenseKey.status === 'Active',
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300': licenseKey.status === 'Inactive',
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300': licenseKey.status === 'Revoked',
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300': licenseKey.status === 'Unassigned'
                    }"
                  >
                    {{ licenseKey.status }}
                  </span>
                </td>
                <td class="relative whitespace-nowrap py-4.5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" @click="$emit('view', licenseKey)" title="View">
                    <div class="i-hugeicons-view h-5 w-5" />
                  </button>
                  <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" @click="$emit('edit', licenseKey)" title="Edit">
                    <div class="i-hugeicons-edit-01 h-5 w-5" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface LicenseKey {
  id: number
  key: string
  templateId: number
  customerId: number
  customerName: string
  customerEmail: string
  productId: number
  productName: string
  orderId: number
  dateCreated: string
  dateAssigned: string | null
  expiryDate: string | null
  status: string
  notes: string | null
}

interface LicenseKeyTemplate {
  id: number
  name: string
}

const props = defineProps({
  licenseKeys: {
    type: Array as () => LicenseKey[],
    required: true
  },
  templates: {
    type: Array as () => LicenseKeyTemplate[],
    required: true
  }
})

defineEmits(['view', 'edit'])

const getTemplateName = (templateId: number): string => {
  const template = props.templates.find((t: LicenseKeyTemplate) => t.id === templateId)
  return template ? template.name : 'Unknown'
}

const formatDate = (date: string | null | undefined): string => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString()
}
</script>
