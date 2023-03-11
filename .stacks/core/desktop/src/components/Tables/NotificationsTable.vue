<script setup lang="ts">
import notifications from '../../../public/notifications.json'

const deleteModal = ref(false)

function deleteNotification() {
  deleteModal.value = true
}

function closeDeleteModal() {
  deleteModal.value = false
}
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <TableList>
      <thead class="dark:bg-gray-800">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-300 dark:text-gray-400"
          >
            from
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-300 dark:text-gray-400"
          >
            to
          </th>

          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-300 dark:text-gray-400"
          >
            Content
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase dark:text-gray-300 dark:text-gray-400"
          >
            Type
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase dark:text-gray-300 dark:text-gray-400"
          >
            Date
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase dark:text-gray-300 dark:text-gray-400"
          >
            Action Items
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase dark:text-gray-300 dark:text-gray-400"
          />
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200 dark:divide-gray-600">
        <tr
          v-for="(notification, index) in notifications"
          :key="index"
          class="bg-white dark:bg-gray-800"
        >
          <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
            {{ notification.from }}
          </td>
          <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
            {{ notification.to }}
          </td>
          <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
            {{ notification.content }}
          </td>
          <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
            <span
              class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase"
              :class="{ 'bg-blue-100 text-blue-800': notification.type === 'email', 'bg-orange-100 text-orange-800': notification.type === 'sms', 'bg-yellow-100 text-yellow-800': notification.type === 'chat' }"
            >{{ notification.type }}</span>
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap dark:text-gray-300">
            01/04/2023 -
            01/04/2023
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
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark-hover:bg-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-red-500 focus:ring-2 group"
                @click="deleteNotification()"
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
              <button
                type="button"
                title="Delete"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark-hover:bg-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-red-500 focus:ring-2 group border-l-0"
              >
                <svg
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                >
                  <path
                    d="M15.4306 7.70172C7.55045 7.99826 3.43929 15.232 2.17021 19.3956C2.07701 19.7014 2.31139 20 2.63107 20C2.82491 20 3.0008 19.8828 3.08334 19.7074C6.04179 13.4211 12.7066 12.3152 15.514 12.5639C15.7583 12.5856 15.9333 12.7956 15.9333 13.0409V15.1247C15.9333 15.5667 16.4648 15.7913 16.7818 15.4833L20.6976 11.6784C20.8723 11.5087 20.8993 11.2378 20.7615 11.037L16.8456 5.32965C16.5677 4.92457 15.9333 5.12126 15.9333 5.61253V7.19231C15.9333 7.46845 15.7065 7.69133 15.4306 7.70172Z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                title="Delete"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark-hover:bg-gray-500 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-red-500 focus:ring-2 group border-l-0"
              >
                <svg
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                >
                  <path
                    d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M10.5898 7.67993H14.8298V11.9299"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M14.8299 7.67993L9.16992 13.3399"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M6 16.51C9.89 17.81 14.11 17.81 18 16.51"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </span>
          </td>
        </tr>
      </tbody>
    </TableList>

    <Alert
      v-if="deleteModal"
      type="warning"
      title="Warning!"
      description="Are you sure you want to delete this event?"
      confirmation-text="Confirm"
      abort-text="Cancel"
      @cancel="closeDeleteModal()"
    />
  </div>
</template>
