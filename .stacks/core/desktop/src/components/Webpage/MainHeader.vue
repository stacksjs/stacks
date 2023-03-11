<script setup lang="ts">
const {
  activeStatus,
  webpage,
} = defineProps<Props>()

const emit = defineEmits(['activeMenu'])

function changeActive(menu: string) {
  emit('activeMenu', menu)
}

interface Props {
  activeStatus: string
  webpage: object | any
}

const webpageStatus = computed(() => {
  let status = ''

  switch (webpage.status) {
    case 'DEACTIVATE':
      status = 'Deactivated'
      break
    case 'LIVE':
      status = 'Live'
      break
    case 'REVIEW':
      status = 'In Review'
      break
    default:
      status = 'Break'
  }

  return status
})
</script>

<template>
  <div class="grid grid-cols-1 gap-5 mt-8 sm:grid-cols-2 lg:grid-cols-4">
    <div
      :class="{ 'ring-teal-500 ring-2 ring-offset-2 dark:ring-teal-400': activeStatus === 'leads', 'dark:border-gray-600': activeStatus !== 'leads' }"
      class="overflow-hidden transition ease-in-out delay-100 bg-white border rounded-lg shadow cursor-pointer dark:bg-gray-700 hover:border-teal-400"
      @click="changeActive('leads')"
    >
      <div class="p-5 pt-8">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg
              class="flex-shrink-0 w-8 h-8 mr-2 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            /></svg>
          </div>
          <div class="flex-1 w-0 ml-5">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate dark:text-gray-400">
                Leads This Week
              </dt>
              <dd>
                <div class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  0
                  <span class="text-sm italic text-gray-600 dark:text-gray-300">
                    All Time Leads
                  </span>
                </div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
    <div
      class="overflow-hidden transition ease-in-out delay-100 bg-white border rounded-lg shadow cursor-pointer dark:bg-gray-700 hover:border-teal-400"
      :class="{ 'ring-teal-500 ring-2 ring-offset-2 dark:ring-teal-400': activeStatus === 'status', 'dark:border-gray-600': activeStatus !== 'status' }"
      @click="changeActive('status')"
    >
      <div class="p-5 pt-8">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg
              class="flex-shrink-0 w-8 h-8 mr-2 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            /></svg>
          </div>
          <div class="flex-1 w-0 ml-5">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate dark:text-gray-400">
                The site is {{ webpageStatus }}
              </dt>
              <dd v-if="webpageStatus === 'Live'">
                <div class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Congratulations!
                </div>
              </dd>

              <dd v-else>
                <div class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Please review
                </div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
    <div
      class="overflow-hidden transition ease-in-out delay-100 bg-white border rounded-lg shadow cursor-pointer dark:bg-gray-700 hover:border-teal-400"
      :class="{ 'ring-teal-500 ring-2 ring-offset-2 dark:ring-teal-400': activeStatus === 'site', 'dark:border-gray-600': activeStatus !== 'site' }"
      @click="changeActive('site')"
    >
      <div class="p-5 pt-8">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg
              class="flex-shrink-0 w-8 h-8 mr-2 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            /></svg>
          </div>
          <div class="flex-1 w-0 ml-5">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate dark:text-gray-400">
                Edit your site
              </dt>
              <dd>
                <div class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Any changes?
                </div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
    <div
      class="overflow-hidden transition ease-in-out delay-100 bg-white rounded-lg shadow cursor-pointer dark:bg-gray-700 hover:border-teal-400"
      :class="{ 'ring-teal-500 ring-2 ring-offset-2 dark:ring-teal-400 border': activeStatus === 'card', 'dark:border-gray-600': activeStatus !== 'card' }"
      @click="changeActive('card')"
    >
      <div class="p-5 pt-8">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg
              class="flex-shrink-0 w-8 h-8 mr-2 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            /></svg>
          </div>
          <div class="flex-1 w-0 ml-5">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate dark:text-gray-400">
                Business Cards
              </dt>
              <dd>
                <div class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Cards
                </div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
