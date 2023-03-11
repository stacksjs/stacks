<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { useFilter } from '~/stores/filters'

const router = useRouter()
const userStore = useUserStore()
const toast = useToast()
const filterStore = useFilter()

const deleteModal = ref(false)
const activeUserId = ref(0)
const loading = ref(true)

const baseUrl = import.meta.env.VITE_API_ROOT_BASE_URL
async function deleteUser(): Promise<void> {
  await userStore.deleteUser(activeUserId.value)

  toast.success({ text: 'Successfully deleted user!' })

  closeDeleteModal()
  fetchUsers(1)
}

function closeDeleteModal(): void {
  deleteModal.value = false
}

function viewUser(id: number): void {
  router.push({ name: 'users-id', params: { id } })
}

function editUser(id: number) {
  router.push({ name: 'users-edit-id', params: { id } })
}

async function syncUser(id: number) {
  toast.info({ text: 'Syncing User', duration: 3000 })

  try {
    await userStore.syncUser(id)

    toast.success({ text: 'Successfully synced user!' })
  }
  catch (err: any) {
    toast.error({ text: 'Failed to sync user!' })
  }
}

function deleteUserPrompt(id: number) {
  activeUserId.value = id

  deleteModal.value = true
}

onMounted(async () => {
  await userStore.getFilterableAttributes('users')
  await fetchUsers(1)

  loading.value = false
})

async function fetchUsers(page: number) {
  await userStore.fetchUsers({ page })
}

async function goToPage(page: number) {
  await userStore.fetchUsers({
    page,
    filters: filterStore.filterVal,
    search: filterStore.search,
    sort: filterStore.sort,
  })
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

  const params: any = {
    page: 1,
    filters: filterStore.filterVal,
    search: filterStore.search,
  }

  if (filterStore.sortType[col])
    params.sort = filterStore.sort
  else filterStore.setSort([])

  await userStore.fetchUsers(params)
}

function loginAs(id: number) {
  openWindow(`${baseUrl}/impersonate-as/${id}`)
}
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <TableList
      v-if="userStore.hasUsers && !loading"
      :results="userStore.results"
      @navigate-to-page="goToPage"
    >
      <thead class="dark:bg-gray-800">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300"
            @click="sort('full_name')"
          >
            <div class="flex items-center">
              <span>Name</span>
              <SortIcon :type="filterStore.sortType.full_name" />
            </div>
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer whitespace-nowrap dark:text-gray-400 dark:text-gray-300"
            @click="sort('id')"
          >
            <div class="flex items-center">
              <span>Web ID</span>
              <SortIcon :type="filterStore.sortType.id" />
            </div>
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300"
            @click="sort('npn')"
          >
            <div class="flex items-center">
              <span>NPN</span>
              <SortIcon :type="filterStore.sortType.npn" />
            </div>
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
            Disposition
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Recruitment Status
          </th>

          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300"
            @click="sort('created_timestamp')"
          >
            <div class="flex items-center justify-end">
              <span>Created</span>
              <SortIcon :type="filterStore.sortType.created_timestamp" />
            </div>
          </th>

          <th
            scope="col"
            class="relative px-6 py-3"
          >
            <span class="sr-only">Action</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(user, index) in userStore.users"
          :key="index"
          class="bg-white dark:bg-gray-800"
        >
          <td
            class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap"
          >
            <div class="flex items-center">
              <div class="flex-shrink-0 w-10 h-10">
                <img
                  src="https://carefreeagency-eliinova.s3.amazonaws.com/images/avatar/default.svg"
                  alt=""
                  class="w-10 h-10 rounded-full"
                >
              </div>
              <div class="ml-4">
                <div
                  class="flex items-center text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {{ user.full_name }}
                  <!---->
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">
                  {{ user.email }}
                </div>
              </div>
            </div>
          </td>
          <td
            class="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap"
          >
            {{ user.id }}
          </td>
          <td
            class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap"
          >
            {{ user.npn }}
          </td>
          <td
            class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap"
          >
            {{ user.phone }}
          </td>
          <td
            class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap"
          >
            {{ user.disposition || "N/A" }}
          </td>
          <td
            class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap"
          >
            {{ user.recruitment_status || "N/A" }}
          </td>
          <td
            class="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap"
          >
            {{ user.created_at }}
          </td>

          <td class="px-6 py-4 text-sm font-semibold text-right whitespace-nowrap">
            <span class="inline-flex rounded-md shadow-sm isolate">
              <button
                type="button"
                title="Edit User"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 rounded-l-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="editUser(user.id)"
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
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                href="#"
                title="View User"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="viewUser(user.id)"
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
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
              <button
                href="#"
                title="Login As"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="loginAs(user.id)"
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
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                  />
                </svg>
              </button>
              <button
                type="button"
                title="Sync User"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="syncUser(user.id)"
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
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <button
                type="button"
                title="Delete"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="deleteUserPrompt(user.id)"
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
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </span>
          </td>
        </tr>
      </tbody>
    </TableList>

    <EmptyState v-if="!userStore.hasUsers && !loading" />

    <Alert
      v-if="deleteModal"
      type="warning"
      title="Warning!"
      description="Are you sure you want to delete this user?"
      confirmation-text="Confirm"
      abort-text="Cancel"
      @cancel="closeDeleteModal()"
      @confirm="deleteUser()"
    />
  </div>
</template>
