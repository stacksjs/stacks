<script setup lang="ts">
import { useAgencyStore } from '~/stores/agency'
import { useFilter } from '~/stores/filters'

const router = useRouter()
const toast = useToast()
const filterStore = useFilter()
const loading = ref(true)
const baseUrl = import.meta.env.VITE_API_ROOT_BASE_URL

onMounted(async () => {
  await fetchAgencies(1)

  loading.value = false
})

const agencyStore = useAgencyStore()
const deleteModal = ref(false)

const activeAgencyId = ref(0)

async function fetchAgencies(page: number) {
  await agencyStore.fetchAgencies({ page })
}

function viewAgency(id: number) {
  router.push({ name: 'reports-center-id', params: { id } })
}

function viewReportsCenterFiles(id: number) {
  openWindow(`${baseUrl}/reportscenter/impersonate/${id}`)
}

function editAgency(id: number): void {
  router.push({ name: 'reports-center-edit-id', params: { id } })
}

function goToPage(page: number) {
  fetchAgencies(page)
}

async function deleteAgency() {
  await agencyStore.deleteAgency(activeAgencyId.value)

  closeDeleteModal()
  toast.success({ text: 'Successfully deleted agency!' })

  fetchAgencies(1)
}

function deleteAgencyPrompt(id: number) {
  activeAgencyId.value = id
  deleteModal.value = true
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

  const params: any = { page: 1 }

  if (filterStore.sortType[col])
    params.sort = filterStore.sort
  else
    filterStore.setSort([])

  await agencyStore.fetchAgencies(params)
}

function closeDeleteModal() {
  deleteModal.value = false
}
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <TableList
      v-if="agencyStore.hasAgencies && !loading"
      :results="agencyStore.results"
      @navigate-to-page="goToPage"
    >
      <thead class="dark:bg-gray-800">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300 "
            @click="sort('name')"
          >
            <div class="flex items-center">
              <span>  Agency Name</span>
              <SortIcon :type="filterStore.sortType.name" />
            </div>
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300 "
            @click="sort('email')"
          >
            <div class="flex items-center">
              <span>Primary Email</span>
              <SortIcon :type="filterStore.sortType.email" />
            </div>
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300 "
          >
            # of Users
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300 "
          >
            # of Files
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
          v-for="(agency, index) in agencyStore.agencies"
          :key="index"
          class="bg-white dark:bg-gray-800"
        >
          <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
            <a
              href="https://carefree.eliinova.com/v2/admin/broker/18/dashboard"
              class="transition duration-150 ease-in-out hover:text-teal-500 dark-hover:text-teal-300"
            >
              {{ agency.name }}
            </a>
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ agency.email }}
          </td>
          <td class="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ agency.total_users }}
          </td>
          <td class="px-6 py-4 text-sm text-right text-gray-500 break-words dark:text-gray-300 dark:text-gray-400">
            {{ agency.total_files }}
          </td>
          <td
            class="px-6 py-4 text-sm font-semibold text-right whitespace-nowrap"
          >
            <span
              class="inline-flex rounded-md shadow-sm isolate"
            >
              <button
                type="button"
                title="Edit Agency"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark-hover:bg-gray-500 dark:border-gray-500 rounded-l-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="editAgency(agency.id)"
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
                type="button"
                title="View agency"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark-hover:bg-gray-500 dark:border-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="viewAgency(agency.id)"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                >
                  <path
                    stroke-linecap="round"
                    stroke-width="2"
                    stroke-linejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-width="2"
                    stroke-linejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
              <button
                type="button"
                title="View Reports Center"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark-hover:bg-gray-500 dark:border-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="viewReportsCenterFiles(agency.id)"
              >

                <svg
                  class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                  />
                </svg>
              </button>
              <button
                type="button"
                title="Delete Agency"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark-hover:bg-gray-500 dark:border-gray-500 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="deleteAgencyPrompt(agency.id)"
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

    <EmptyState v-if="!agencyStore.hasAgencies && !loading" />

    <Alert
      v-if="deleteModal"
      type="warning"
      title="Warning!"
      description="Are you sure you want to delete this agency?"
      confirmation-text="Confirm"
      abort-text="Cancel"
      @confirm="deleteAgency()"
      @cancel="closeDeleteModal()"
    />
  </div>
</template>
