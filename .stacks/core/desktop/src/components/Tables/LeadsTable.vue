<script setup lang="ts">
import { useWebpageStore } from '~/stores/webpage'

const route = useRoute()
const webpageStore = useWebpageStore()

onMounted(async () => {
  await fetchWebpageLeads(1)
})

async function fetchWebpageLeads(page: number) {
  await webpageStore.fetchWebpageLeads(route.params.id, { page })
}

function goToPage(page: number) {
  fetchWebpageLeads(page)
}
</script>

<template>
  <div>
    <TableList
      v-if="webpageStore.hasWebpageLeads"
      :pagination="webpageStore.pagination"
      @navigate-to-page="goToPage"
    >
      <thead class="dark:bg-gray-800">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Full Name
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Email
          </th>

          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Phone
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Submitted At
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Source
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Status
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Product Sold
          </th>
          <th
            scope="col"
            class="relative px-6 py-3"
          >
            <span class="sr-only">Action</span>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200 dark:divide-gray-600">
        <tr
          v-for="(lead, index) in webpageStore.webpageLeads"
          :key="index"
          class="bg-white dark:bg-gray-800"
        >
          <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
            {{ lead.name }}
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ lead.email }}
          </td>

          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ lead.phone }}
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ lead.created_at }}
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ lead.source }}
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ lead.status }}
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ lead.product_sold || 'N/A' }}
          </td>
          <td class="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
            <div class="relative inline-block text-left" />
          </td>
        </tr>
      </tbody>
    </TableList>
  </div>
</template>
