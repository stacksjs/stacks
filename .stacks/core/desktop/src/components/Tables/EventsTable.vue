<script setup lang="ts">
import type { RouteParamValueRaw } from 'vue-router'
import { useEventStore } from '~/stores/event'
import { useFilter } from '~/stores/filters'

const router = useRouter()
const filterStore = useFilter()

const eventsStore = useEventStore()
const loading = ref(true)

onMounted(async () => {
  await eventsStore.getFilterableAttributes('events')
  await fetchEvents(1)

  loading.value = false
})

function updateEvent(id: RouteParamValueRaw): void {
  router.push({ name: 'events-edit-id', params: { id } })
}

const deleteModal = ref(false)
const activeEventId = ref(0)

async function deleteEvents() {
  deleteModal.value = true

  await eventsStore.deleteEvent(activeEventId.value)

  deleteModal.value = false
  activeEventId.value = 0

  fetchEvents(1)
}

function deleteEventPrompt(id: number) {
  deleteModal.value = true
  activeEventId.value = id
}

function closeDeleteModal() {
  deleteModal.value = false
}

async function fetchEvents(page: number) {
  await eventsStore.fetchEvents({ page })
}

function goToPage(page: number) {
  eventsStore.fetchEvents({ page, filters: filterStore.filterVal, search: filterStore.search, sort: filterStore.sort })
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

  await eventsStore.fetchEvents(params)
}

function getDate(event: any) {
  if (event.date)
    return event.date.date

  return 'N/A'
}

function getTime(event: any) {
  if (event.time)
    return `${event.time.start_time}-${event.time.end_time} ${event.time.timezone}`

  return 'N/A'
}
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <TableList
      v-if="eventsStore.hasEvents && !loading"
      :results="eventsStore.results"
      @navigate-to-page="goToPage"
    >
      <thead class="dark:bg-gray-800">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-300 dark:text-gray-400"
            @click="sort('name')"
          >
            <div class="flex items-center">
              <span>Name</span>
              <SortIcon :type="filterStore.sortType.name" />
            </div>
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-300 dark:text-gray-400"
            @click="sort('date_start')"
          >
            <div class="flex items-center">
              <span> Start &amp; End</span>
              <SortIcon :type="filterStore.sortType.date_start" />
            </div>
          </th>

          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-300 dark:text-gray-400"
            @click="sort('category')"
          >
            <div class="flex items-center">
              <span>Category</span>
              <SortIcon :type="filterStore.sortType.category" />
            </div>
          </th>

          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-300 dark:text-gray-400"
          >
            Status
          </th>

          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-300 dark:text-gray-400"
          >
            RSVPs
          </th>

          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase cursor-pointer dark:text-gray-300 dark:text-gray-400"
            @click="sort('created_timestamp')"
          >
            <div class="flex items-center">
              <span>Created</span>
              <SortIcon :type="filterStore.sortType.created_timestamp" />
            </div>
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase dark:text-gray-300 dark:text-gray-400"
          />
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200 dark:divide-gray-600">
        <tr
          v-for="(event, index) in eventsStore.events"
          :key="index"
          class="bg-white dark:bg-gray-800"
        >
          <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
            {{ event.name }}
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            <p class="font-semibold">
              {{ getDate(event) }}
            </p>

            <p>
              {{ getTime(event) }}
            </p>
          </td>

          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ event.category || 'N/A' }}
          </td>

          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ event.is_active ? 'Active' : 'Inactive' }}
          </td>

          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            <router-link
              class="text-blue-500"
              :to="`/events/${event.id}/rsvps`"
            >
              {{ event.rsvp_count }}
            </router-link>
          </td>
          <td class="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ event.created_at }}
          </td>
          <td
            class="px-6 py-4 text-sm font-semibold text-right whitespace-nowrap"
          >
            <span
              class="inline-flex rounded-md shadow-sm isolate"
            ><button
               type="button"
               href="#"
               title="Edit"
               class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark-hover:bg-gray-500 rounded-l-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
               @click="updateEvent(event.id)"
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
                title="Delete"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark-hover:bg-gray-500 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-red-500 focus:ring-2 group"
                @click="deleteEventPrompt(event.id)"
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

    <EmptyState v-if="!eventsStore.hasEvents && !loading" />

    <Alert
      v-if="deleteModal"
      type="warning"
      title="Warning!"
      description="Are you sure you want to delete this event?"
      confirmation-text="Confirm"
      abort-text="Cancel"
      @cancel="closeDeleteModal()"
      @confirm="deleteEvents()"
    />
  </div>
</template>
