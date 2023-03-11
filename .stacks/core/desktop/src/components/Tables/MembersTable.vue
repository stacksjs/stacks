<script setup lang="ts">
import type { RouteParamValue } from 'vue-router'
import { useUserStore } from '~/stores/user'
import { useFilter } from '~/stores/filters'

const userStore = useUserStore()
const filterStore = useFilter()
const router = useRouter()

const toast = useToast()
const loading = ref(true)

function memberAvatar(member: any) {
  return `${member.image}`
}

const activeMemberId = ref(0)
const deleteModal = ref(false)

function deleteMemberPrompt(id: number): void {
  activeMemberId.value = id
  deleteModal.value = true
}

async function deleteMember() {
  await userStore.deleteTeamMember(activeMemberId.value)

  activeMemberId.value = 0

  deleteModal.value = false

  toast.success({ text: 'Successfully deleted team member!' })
  fetchMembers(1)
}

function closeDeleteModal(): void {
  deleteModal.value = false
}

onMounted(async () => {
  await userStore.getFilterableAttributes('team_members')
  await fetchMembers(1)

  loading.value = false
})

async function fetchMembers(page: number) {
  await userStore.fetchTeamMembers({ page })
}

async function goToPage(page: number) {
  await userStore.fetchTeamMembers({ page, filters: filterStore.filterVal, search: filterStore.search, sort: filterStore.sort })
}
function editMember(id: RouteParamValue): void {
  router.push({ name: 'team-members-edit-id', params: { id } })
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

  await userStore.fetchTeamMembers(params)
}
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <TableList
      v-if="userStore.hasTeamMembers && !loading"
      :results="userStore.results"
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
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Bio
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
          v-for="(member, index) in userStore.teamMembers"
          :key="index"
          class="bg-white dark:bg-gray-800"
        >
          <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
            <div class="flex items-center">
              <div class="circular--portrait">
                <img
                  :src="memberAvatar(member)"
                >
              </div>

              <div class="ml-4">
                <div class="flex items-center text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ member.name }}
                  <a
                    :href="member.linkedin"
                    target="_blank"
                  ><svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    width="24px"
                    height="24px"
                  ><path
                    fill="#0288D1"
                    d="M42,37c0,2.762-2.238,5-5,5H11c-2.761,0-5-2.238-5-5V11c0-2.762,2.239-5,5-5h26c2.762,0,5,2.238,5,5V37z"
                  /> <path
                    fill="#FFF"
                    d="M12 19H17V36H12zM14.485 17h-.028C12.965 17 12 15.888 12 14.499 12 13.08 12.995 12 14.514 12c1.521 0 2.458 1.08 2.486 2.499C17 15.887 16.035 17 14.485 17zM36 36h-5v-9.099c0-2.198-1.225-3.698-3.192-3.698-1.501 0-2.313 1.012-2.707 1.99C24.957 25.543 25 26.511 25 27v9h-5V19h5v2.616C25.721 20.5 26.85 19 29.738 19c3.578 0 6.261 2.25 6.261 7.274L36 36 36 36z"
                  /></svg></a>
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">
                  {{ member.title }}
                </div>
              </div>
            </div>
          </td>

          <td class="px-6 py-4 text-sm text-gray-500 break-words dark:text-gray-400 dark:text-gray-300">
            {{ member.bio }}
          </td>
          <td class="px-6 py-4 text-sm font-semibold text-right">
            <span class="inline-flex rounded-md shadow-sm isolate">
              <button
                type="button"
                title="Edit Team Member"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark-hover:bg-gray-500 dark:border-gray-500 rounded-l-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="editMember(member.id)"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5 text-gray-500 dark:text-gray-300 group-hover:text-gray-700"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                /></svg>
              </button>
              <button
                type="button"
                title="Delete Website"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark-hover:bg-gray-500 dark:border-gray-500 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="deleteMemberPrompt(member.id)"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5 text-gray-500 dark:text-gray-300 group-hover:text-gray-700"
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

    <EmptyState v-if="!userStore.hasTeamMembers && !loading" />

    <Alert
      v-if="deleteModal"
      type="warning"
      title="Warning!"
      description="Are you sure you want to delete this member?"
      confirmation-text="Confirm"
      abort-text="Cancel"
      @cancel="$event => closeDeleteModal()"
      @confirm="$event => deleteMember()"
    />
  </div>
</template>

<style>
.circular--portrait { position: relative; width: 50px; height: 50px; overflow: hidden; border-radius: 50%; } .circular--portrait img { width: 100%; height: auto; }
</style>
