<script setup lang="ts">
import { useWebpageStore } from '~/stores/webpage'

interface Props {
  webpage: object | any
}

const { webpage } = defineProps<Props>()

const webpageStore = useWebpageStore()
const toast = useToast()
const changesModalPrompt = ref(false)
const activeChangeId = ref(0)
const changeStatus = ref('')

const declineSection = ref(false)

const declineReason = ref('')

function previewChange(id: number) {
  window.open(`${webpage.link}?previewId=${id}`)
}

function approveChangesPrompt(changeId: number) {
  changesModalPrompt.value = true
  activeChangeId.value = changeId
  changeStatus.value = 'approve'
}

function declineChangesSection(changeId: number) {
  declineSection.value = true
  activeChangeId.value = changeId
  changeStatus.value = 'decline'
}

function declineChangesPrompt() {
  changesModalPrompt.value = true
  changeStatus.value = 'decline'
}

function closeChangeModal() {
  changesModalPrompt.value = false

  changeStatus.value = ''
}

async function makeChange() {
  let status = ''

  if (changeStatus.value === 'approve')
    status = 'APPROVED'
  else if (changeStatus.value === 'decline')
    status = 'DECLINED'

  try {
    await webpageStore.updateWebpageChanges(activeChangeId.value, {
      reason: declineReason.value,
      status,
    })

    toast.success({ text: `Successfully ${changeStatus.value} webpage change!` })

    await webpageStore.fetchWebpage(webpage.id)
  }
  catch (err: any) {
    toast.success({ text: 'Something went wrong!' })
  }

  closeChangeModal()
  declineSection.value = false
}
</script>

<template>
  <div class="w-full">
    <div class="px-4 rounded-md shadow-md bg-gray-50 dark:bg-gray-700 lg:px-6">
      <div class="flow-root">
        <div class="overflow-x-auto">
          <div class="inline-block min-w-full py-2 align-middle">
            <table
              v-if="webpage.changes.length"
              class="min-w-full divide-y divide-gray-300"
            >
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-0"
                  >
                    Before
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    After
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Type
                  </th>

                  <th
                    scope="col"
                    class="relative py-3.5 pl-3 pr-6 sm:pr-0"
                  >
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr
                  v-for="(change, index) in webpage.changes"
                  :key="index"
                >
                  <td
                    class="py-4 pl-6 pr-3 text-sm font-medium text-gray-900 whitespace-nowrap sm:pl-0"
                  >
                    <img
                      v-if="
                        (change.type === 'profile_picture'
                          || change.type === 'secondary_logo')
                          && change.after
                      "
                      :src="change.after"
                      class="w-10 h-10 rounded-full shadow bg-grey-light"
                      :alt="change.type"
                    >
                    <span
                      v-else
                      class="ml-4 font-semibold text-gray-500"
                    >{{
                      change.after
                    }}</span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">
                    <img
                      v-if="
                        (change.type === 'profile_picture'
                          || change.type === 'secondary_logo')
                          && change.before
                      "
                      :src="change.before"
                      class="w-10 h-10 rounded-full shadow bg-grey-light"
                      :alt="change.type"
                    >
                    <span
                      v-else
                      class="ml-4 font-semibold text-gray-500"
                    >{{
                      change.before
                    }}</span>
                  </td>
                  <td
                    class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300 whitespace-nowrap"
                  >
                    {{ change.label }}
                  </td>

                  <td
                    class="relative py-4 pl-3 pr-6 text-sm font-medium text-right whitespace-nowrap sm:pr-0"
                  >
                    <span class="inline-flex rounded-md shadow-sm isolate">
                      <button
                        type="button"
                        title="Edit Website"
                        class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark-hover:bg-gray-500 dark:border-gray-500 rounded-l-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                        @click="approveChangesPrompt(change.id)"
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
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                      </button>
                      <button
                        href="#"
                        title="View Webpage"
                        class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                        @click="declineChangesSection(change.id)"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>

                      <button
                        type="button"
                        title="Delete Website"
                        class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark-hover:bg-gray-500 dark:border-gray-500 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                        @click="previewChange(webpage.id)"
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
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div
              v-else
              class="px-4 py-2"
            >
              <EmptyState
                title="No changes"
                description="This agent webpage has no changes yet."
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="declineSection"
      class="px-4 py-4 mt-8 bg-white rounded-md shadow-md dark:bg-gray-700 lg:px-6"
    >
      <h3 class="pb-2 text-gray-700 dark:text-gray-400">
        Decline Reason
      </h3>

      <textarea
        v-model="declineReason"
        rows="5"
        class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
      />

      <button
        class="mt-4 text-sm primary-button"
        @click="declineChangesPrompt"
      >
        Submit Decline Reason
      </button>
    </div>
  </div>

  <Alert
    v-if="changesModalPrompt"
    type="info"
    title="Confirmation"
    :description="`Are you sure you want to ${changeStatus} this change?`"
    confirmation-text="Confirm"
    abort-text="Cancel"
    @confirm="makeChange()"
    @cancel="closeChangeModal()"
  />
</template>
