<script setup lang="ts">
import { useWebpageStore } from '~/stores/webpage'

interface Props {
  webpage: object | any
}

const { webpage } = defineProps<Props>()

const webpageStore = useWebpageStore()
const toast = useToast()

const deleteModal = ref(false)
const deactivateModal = ref(false)

const message = ref('')
const router = useRouter()

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

function changeWebsiteStatus(status: string) {
  webpageStore.updateWebpageStatus(webpage.id, status)
}

function deleteWebpagePrompt() {
  deleteModal.value = true
}

function deactivateWebpagePrompt() {
  deactivateModal.value = true
}

function closeDeleteModal() {
  deleteModal.value = false
}

function closeDeactivateModal() {
  deactivateModal.value = false
}

function deactivateWebpage() {
  changeWebsiteStatus('DEACTIVATE')

  closeDeactivateModal()
  toast.success({ text: 'Successfully changed webpage status!' })
}

function deleteWebpage() {
  webpageStore.deleteWebpage(webpage.id)

  toast.success({ text: 'Successfully deleted webpage!' })
  router.push({ name: 'webpages' })
}

async function sendChat() {
  await webpageStore.sendWebpageChat(webpage.id, {
    to: 'user',
    from: 'admin',
    message: message.value,
  })

  message.value = ''

  webpageStore.fetchWebpage(webpage.id)
}
</script>

<template>
  <div class="mt-8">
    <h2 class="text-xl font-semibold text-gray-700 dark:text-gray-200">
      Webpage Changes
    </h2>
    <div
      class="items-start px-4 py-4 mt-4 bg-white rounded-md shadow-md dark:bg-gray-600 lg:px-6 lg:space-x-4 lg:flex"
    >
      <WebpageChangesTable :webpage="webpage" />

      <div class="flex flex-col w-full mt-8 lg:mt-0">
        <div
          class="flex items-center justify-between px-6 py-3 rounded-t-lg bg-carefree-blue-1"
        >
          <p class="font-semibold text-white">
            Chat with {{ webpage.first_name }}
            {{ webpage.last_name }}
          </p>
          <p class="text-xs font-semibold text-white">
            {{ webpage.email_address }}
          </p>
        </div>
        <div
          ref="chat"
          class="relative flex flex-col px-6 py-4 overflow-y-auto bg-gray-50 dark:bg-gray-700 min-h-xs max-h-xs"
        >
          <div
            v-for="chat in webpage.chat"
            :key="chat.id"
            class="px-2 py-1 mb-3 border border-teal-500 rounded-lg min-w-1/2 max-w-3/4"
            :class="{
              'self-end bg-carefree-blue-1': chat.from === 'user',
              'bg-teal-600': chat.from !== 'user',
            }"
          >
            <p
              class="mt-2 text-sm font-semibold leading-normal text-white"
              v-html="chat.message"
            />
            <p class="text-xs text-right text-white">
              {{ chat.created_at }}
            </p>
          </div>
        </div>
        <div class="p-5 bg-gray-100 rounded-b-lg shadow dark:bg-gray-500">
          <div>
            <textarea
              v-model="message"
              class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              rows="3"
              placeholder="Enter a response here"
            />
          </div>
          <div class="flex justify-end mt-4 mb-1">
            <button
              class="primary-button"
              @click="sendChat"
            >
              <svg
                style="transform: rotate(-45deg)"
                class="w-4 h-4 mr-3 -mt-1 text-white fill-current"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
              >
                <path d="M0 0l20 10L0 20V0zm0 8v4l10-2L0 8z" />
              </svg>
              Send Reply
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mx-auto mt-8 max-w-none">
      <div class="overflow-hidden bg-white dark:bg-gray-700 sm:rounded-lg sm:shadow">
        <div class="px-4 py-5 border-b border-gray-200 dark:border-gray-600 sm:px-6">
          <div class="flex items-center justify-center">
            <svg
              class="flex-shrink-0 w-8 h-8 mr-2 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
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
            <h3
              class="text-lg font-medium leading-6 text-center text-gray-900 dark:text-gray-100"
            >
              Your Website is {{ webpageStatus }}!
            </h3>
          </div>
        </div>

        <ul
          role="list"
          class="divide-y divide-gray-200 dark:divide-gray-600"
        >
          <li>
            <div class="block">
              <div class="px-4 py-4 sm:px-6">
                <div class="flex items-center justify-between">
                  <div
                    class="text-sm font-medium text-gray-600 truncate dark:text-gray-300"
                  >
                    Preview website
                  </div>
                  <div class="flex flex-shrink-0 ml-2">
                    <a
                      type="button"
                      class="inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-teal-700 transition ease-in-out delay-150 bg-teal-100 border border-transparent rounded-md hover:bg-teal-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                      :href="`https://${webpage.subdomain}.agentmedicareplans.com`"
                      target="_new"
                    >
                      <svg
                        class="flex-shrink-0 w-4 h-4 mr-2 text-teal-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
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
                      Preview
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </li>

          <li>
            <div class="block">
              <div class="px-4 py-4 sm:px-6">
                <div class="flex items-center justify-between">
                  <div
                    class="text-sm font-medium text-gray-600 truncate dark:text-gray-300"
                  >
                    Make the website under review
                  </div>
                  <div class="flex flex-shrink-0 ml-2">
                    <button
                      type="button"
                      class="inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-yellow-700 transition ease-in-out delay-150 bg-yellow-100 border border-transparent rounded-md hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                      @click="changeWebsiteStatus('REVIEW')"
                    >
                      Under Review
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </li>

          <li>
            <div class="block">
              <div class="px-4 py-4 sm:px-6">
                <div class="flex items-center justify-between">
                  <div
                    class="text-sm font-medium text-gray-600 truncate dark:text-gray-300"
                  >
                    Deactivate Website
                  </div>
                  <div class="flex flex-shrink-0 ml-2">
                    <button
                      type="button"
                      class="inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-pink-700 transition ease-in-out delay-150 bg-pink-100 border border-transparent rounded-md hover:bg-pink-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                      @click="deactivateWebpagePrompt()"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </li>

          <li>
            <div class="block">
              <div class="px-4 py-4 sm:px-6">
                <div class="flex items-center justify-between">
                  <div
                    class="text-sm font-medium text-gray-600 truncate dark:text-gray-300"
                  >
                    Delete Website
                  </div>
                  <div class="flex flex-shrink-0 ml-2">
                    <button
                      type="button"
                      class="inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-red-700 transition ease-in-out delay-150 bg-red-100 border border-transparent rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      @click="deleteWebpagePrompt()"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>

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
