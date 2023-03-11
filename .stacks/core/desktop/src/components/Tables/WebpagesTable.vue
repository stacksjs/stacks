<script setup lang="ts">
import type { RouteParamValueRaw } from 'vue-router'
import { useWebpageStore } from '~/stores/webpage'
import { useFilter } from '~/stores/filters'

const router = useRouter()
const toast = useToast()
const filterStore = useFilter()

const webpageStore = useWebpageStore()
const loading = ref(true)

onMounted(async () => {
  await webpageStore.getFilterableAttributes('webpages')
  await fetchWebpages(1)

  loading.value = false
})

function editSite(id: RouteParamValueRaw): void {
  router.push({ name: 'webpages-edit-id', params: { id } })
}

function getSubdomainLink(subdomain: string) {
  return `https://${subdomain}.agentmedicareplans.com`
}

function fullName(webpage: any): string {
  return `${webpage.first_name} ${webpage.last_name}`
}

const deleteModal = ref(false)
const deactivateModal = ref(false)
const activeWebpageId = ref(0)

function deleteWebpagePrompt(id: number) {
  activeWebpageId.value = id
  deleteModal.value = true
}

function getInitials(name: string | any) {
  return name.match(/(\b\S)?/g).join('').match(/(^\S|\S$)?/g).join('').toUpperCase()
}

function deactivateWebpagePrompt(id: number) {
  activeWebpageId.value = id
  deactivateModal.value = true
}

async function deleteWebpage() {
  try {
    await webpageStore.deleteWebpage(activeWebpageId.value)

    toast.success({ text: 'Successfully deleted webpage!' })
  }
  catch (err: any) {
    toast.error({ text: 'Something went wrong!' })
  }

  deleteModal.value = false
  activeWebpageId.value = 0

  await fetchWebpages(1)
}

async function deactivateWebpage() {
  try {
    await webpageStore.deactivateWebpage(activeWebpageId.value)

    toast.success({ text: 'Successfully deactivated webpage!' })
  }
  catch (err: any) {
    toast.error({ text: 'Something went wrong!' })
  }

  deactivateModal.value = false

  await fetchWebpages(1)
}

function closeDeleteModal() {
  deleteModal.value = false
}

function closeDeactivateModal() {
  deactivateModal.value = false
}

async function fetchWebpages(page: number) {
  await webpageStore.fetchWebpages({ page })
}

function replaceByDefault(event: HTMLElement) {
  event.target.src = 'https://carefreeagency.com/uploads/webpages/blankimage.png'
}

function viewWebpage(webpage: any) {
  openWindow(getSubdomainLink(webpage.subdomain))
}

async function goToPage(page: number) {
  await webpageStore.fetchWebpages({ page, filters: filterStore.filterVal, search: filterStore.search, sort: filterStore.sort })
}

async function sort(col: string) {
  switch (filterStore.sortType[col]) {
    case '':
      filterStore.setSortType(col, 'asc')
      break
    case undefined:
      filterStore.setSortType(col, 'asc')
      break
    case 'asc':
      filterStore.setSortType(col, 'desc')
      break
    case 'desc':
      filterStore.setSortType(col, '')
      break
    default:
      filterStore.setSortType(col, '')
      break
  }

  const sort = [`${col}:${filterStore.sortType[col]}`]

  filterStore.setSort(sort)
  filterStore.setSortVal(col)

  const params: any = { page: 1, filters: filterStore.filterVal, search: filterStore.search }

  if (filterStore.sortType[col])
    params.sort = filterStore.sort
  else
    filterStore.setSort([])

  await webpageStore.fetchWebpages(params)
}
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <TableList
      v-if="webpageStore.hasWebpages && !loading"
      :results="webpageStore.results"
      @navigate-to-page="goToPage"
    >
      <thead class="dark:bg-gray-800">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300"
            @click="sort('name')"
          >
            <div class="flex items-center">
              <span>Name</span>
              <SortIcon :type="filterStore.sortType.name" />
            </div>
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300"
            @click="sort('subdomain')"
          >
            <div class="flex items-center">
              <span>Subdomain</span>
              <SortIcon :type="filterStore.sortType.subdomain" />
            </div>
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Leads
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300"
            @click="sort('created_timestamp')"
          >
            <div class="flex items-center justify-end">
              <span>  Created At</span>
              <SortIcon :type="filterStore.sortType.created_timestamp" />
            </div>
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          />
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200 dark:divide-gray-600">
        <tr
          v-for="(webpage, index) in webpageStore.webpages"
          :key="index"
          class="bg-white dark:bg-gray-800"
        >
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
              <div class="h-full rounded-full">
                <div
                  v-if="!webpage.profile_picture"
                  class="initials-avatar"
                >
                  {{ getInitials(fullName(webpage)) }}
                </div>
                <img
                  v-else
                  :src="webpage.profile_picture"
                  class="object-cover w-12 h-12 rounded-full"
                  @error="replaceByDefault($event)"
                >
              </div>
              <div class="ml-4">
                <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ fullName(webpage) }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">
                  {{ webpage.email_address }}
                </div>
              </div>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-900 dark:text-gray-100">
              <a
                target="_blank"
                :href="getSubdomainLink(webpage.subdomain)"
                class="flex items-center text-teal-400"
              >
                {{ webpage.subdomain }}
                <svg
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  class="w-4 h-4 ml-1"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
              </a>
            </div>
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
            {{ webpage.leads.length }}
          </td>
          <td class="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
            {{ webpage.created_at }}
          </td>
          <td
            class="px-6 py-4 text-sm font-semibold text-right whitespace-nowrap"
          >
            <span
              class="inline-flex rounded-md shadow-sm isolate"
            >
              <button
                type="button"
                title="Edit Website"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark-hover:bg-gray-500 dark:border-gray-500 rounded-l-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="editSite(webpage.id)"
              ><svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              /></svg>
              </button>
              <button
                href="#"
                title="View Webpage"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="viewWebpage(webpage)"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                /><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                /></svg>
              </button>
              <button
                href="#"
                title="Deactivate Website"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark-hover:bg-gray-500 dark:border-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="deactivateWebpagePrompt(webpage.id)"
              >
                <svg
                  class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              </button>
              <button
                type="button"
                title="Delete Website"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark-hover:bg-gray-500 dark:border-gray-500 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="deleteWebpagePrompt(webpage.id)"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                /></svg>
              </button>
            </span>
          </td>
        </tr>
      </tbody>
    </TableList>

    <EmptyState v-if="!webpageStore.hasWebpages && !loading" />

    <Alert
      v-if="deleteModal"
      type="warning"
      title="Warning!"
      description="Are you sure you want to delete this webpage?"
      confirmation-text="Confirm"
      abort-text="Cancel"
      @confirm="deleteWebpage()"
      @cancel="closeDeleteModal()"
    />

    <Alert
      v-if="deactivateModal"
      type="warning"
      title="Warning!"
      description="Are you sure you want to deactivate this webpage?"
      confirmation-text="Confirm"
      abort-text="Cancel"
      @confirm="deactivateWebpage()"
      @cancel="closeDeactivateModal()"
    />
  </div>
</template>

<style>
/* .circular--landscape { display: inline-block; position: relative; width: 50px; height: 50px; overflow: hidden; border-radius: 50%; } .circular--landscape img { width: auto; height: 100%; margin-left: -50px; } */
</style>
