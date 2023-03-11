<script setup lang="ts">
import type { RouteParamValueRaw } from 'vue-router'
import { useEventStore } from '~/stores/event'
import { useFilter } from '~/stores/filters'

const router = useRouter()
const route = useRoute()
const filterStore = useFilter()

const eventsStore = useEventStore()
const loading = ref(true)

onMounted(async () => {
  await eventsStore.getFilterableAttributes('event_rsvps')
  await fetchEventRsvps(1)

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

  fetchEventRsvps(1)
}

function deleteEventPrompt(id: number) {
  deleteModal.value = true
  activeEventId.value = id
}

function closeDeleteModal() {
  deleteModal.value = false
}

async function fetchEventRsvps(page: number) {
  await eventsStore.fetchEventRsvps(route.params.id, { page })
}

function goToPage(page: number) {
  eventsStore.fetchEventRsvps(route.params.id, { page, filters: filterStore.filterVal, search: filterStore.search, sort: filterStore.sort })
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

  await eventsStore.fetchEventRsvps(route.params.id, params)
}
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <TableList
      v-if="eventsStore.hasEventRsvps && !loading"
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
            @click="sort('event_name')"
          >
            <div class="flex items-center">
              <span>Event Name</span>
              <SortIcon :type="filterStore.sortType.event_name" />
            </div>
          </th>

          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-300 dark:text-gray-400"
          >
            Email
          </th>

          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-300 dark:text-gray-400"
          >
            Attendees
          </th>

          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase cursor-pointer whitespace-nowrap dark:text-gray-300 dark:text-gray-400"
            @click="sort('created_timestamp')"
          >
            <div class="flex items-center">
              <span>RSVP Date</span>
              <SortIcon :type="filterStore.sortType.created_timestamp" />
            </div>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200 dark:divide-gray-600">
        <tr
          v-for="(event, index) in eventsStore.eventRsvps"
          :key="index"
          class="bg-white dark:bg-gray-800"
        >
          <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
            {{ event.name }}
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ event.event_name }}
          </td>

          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ event.email }}
          </td>

          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ event.number_of_attendees }}
          </td>

          <td class="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            {{ event.created_at }}
          </td>
        </tr>
      </tbody>
    </TableList>

    <EmptyState v-if="!eventsStore.hasEventRsvps && !loading" />

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
