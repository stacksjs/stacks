<script setup lang="ts">
import { useEventStore } from '~/stores/event'

const eventsStore = useEventStore()

onMounted(async () => {
  await fetchEvents(1)
})

async function fetchEvents(page: number) {
  await eventsStore.fetchUpcomingEvents({ page })
}

function getDate(event: any) {
  if (event.date)
    return event.date.date

  return 'N/A'
}
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <!-- Search header -->
      <main class="flex-1">
        <TopBar />

        <div class="px-4 py-8 mx-auto sm:px-6 lg:px-8 lg:py-10">
          <section>
            <h2 class="mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 dark:text-gray-50">
              Overview
            </h2>

            <DashboardCards />
          </section>

          <section class="mt-8">
            <div>
              <h2 class="mt-8 mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 dark:text-gray-50">
                Upcoming Events
              </h2>
              <div class="mt-2 overflow-hidden bg-white shadow-lg sm:rounded-md dark:bg-gray-800 dark:border dark:border-gray-600">
                <ul
                  role="list"
                  class="divide-y divide-gray-200 dark:divide-gray-600"
                >
                  <li
                    v-for="(upcomingEvent, index) in eventsStore.upcomingEvents"
                    :key="index"
                  >
                    <router-link
                      :to="`/events/edit/${upcomingEvent.id}`"
                      class="block hover:bg-gray-50 dark-hover:bg-gray-600"
                    >
                      <div class="px-4 py-4 sm:px-6">
                        <div class="flex items-center justify-between">
                          <p class="text-sm font-medium text-teal-600 truncate dark:text-teal-400">
                            {{ upcomingEvent.name }}
                          </p>
                        </div>
                        <div class="mt-2 sm:flex sm:justify-between">
                          <div class="flex items-center mt-2 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 sm:mt-0">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                              class="
                                flex-shrink-0
                                mr-1.5
                                h-5
                                w-5
                                text-gray-400"
                            >
                              <path
                                fill-rule="evenodd"
                                d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                                clip-rule="evenodd"
                              />
                            </svg>
                            <p>
                              <time :datetime="upcomingEvent.date">
                                {{ getDate(upcomingEvent) }}
                              </time>
                            </p>
                          </div>
                        </div>
                      </div>
                    </router-link>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <NotificationsSection />
        </div>
      </main>
    </div>
  </div>
</template>
