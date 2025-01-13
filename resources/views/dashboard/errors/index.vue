<script lang="ts" setup>
import { ref } from 'vue'
import { useHead } from '@vueuse/head' // Make sure this is installed

// Set page title
useHead({
  title: 'Dashboard - Error Tracking',
})

interface Error {
  id: number
  message: string
  type: string
  typeColor: string
  environment: string
  location: string
  filePath: string
  line: number
  lastSeen: string
  resolved: boolean
}

// Mock data - replace with actual API call in production
const recentErrors = ref<Error[]>([
  {
    id: 1,
    message: 'Undefined variable $user',
    type: 'PHP Exception',
    typeColor: 'text-red-500',
    environment: 'production',
    location: 'UserController.php:42',
    filePath: '/app/Http/Controllers/UserController.php',
    line: 42,
    lastSeen: '2 minutes ago',
    resolved: false
  },
  {
    id: 2,
    message: 'Cannot read property \'length\' of undefined',
    type: 'JavaScript Error',
    typeColor: 'text-orange-500',
    environment: 'staging',
    location: 'main.js:156',
    filePath: '/resources/js/main.js',
    line: 156,
    lastSeen: '15 minutes ago',
    resolved: false
  },
  {
    id: 3,
    message: 'Database connection failed',
    type: 'Fatal Error',
    typeColor: 'text-red-500',
    environment: 'production',
    location: 'DatabaseService.php:89',
    filePath: '/app/Services/DatabaseService.php',
    line: 89,
    lastSeen: '1 hour ago',
    resolved: false
  }
])

// Opens file in VS Code at specific line
const openInVSCode = (filePath: string, line: number) => {
  window.location.href = `vscode://file${filePath}:${line}`
}

// Marks an error as resolved
const resolveError = (errorId: number) => {
  const error = recentErrors.value.find(e => e.id === errorId)
  if (error) {
    error.resolved = true
  }
}

// Copies error details to clipboard
const shareError = (error: Error) => {
  const shareText = `Error: ${error.message}\nType: ${error.type}\nLocation: ${error.location}\nEnvironment: ${error.environment}`
  navigator.clipboard.writeText(shareText)
    .then(() => {
      alert('Error details copied to clipboard!')
    })
    .catch(() => {
      alert('Failed to copy to clipboard')
    })
}
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <!-- Stats Section -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 font-semibold leading-6">
          Last 30 days
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <!-- Total Errors Card -->
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-red-500 p-3">
                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Total Unresolved Errors
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                2,847
              </p>
              <p class="ml-2 flex items-baseline text-sm text-red-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only">Increased by</span>
                24%
              </p>
            </dd>
          </div>

          <!-- Resolved Issues Card -->
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-green-500 p-3">
                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Resolved Issues
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                1,624
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only">Increased by</span>
                12%
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Error Table Section -->
    <div class="px-4 pt-12 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 font-semibold leading-6">
            Recent Errors
          </h1>
          <p class="mt-2 text-sm text-gray-700">
            A list of all recent errors tracked in your application.
          </p>
        </div>
      </div>

      <div class="mt-8 flow-root">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 font-semibold sm:pl-6">
                      Error
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Type
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Environment
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Location
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-right text-sm text-gray-900 font-semibold">
                      Last Seen
                    </th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="error in recentErrors"
                      :key="error.id"
                      :class="{ 'bg-green-50': error.resolved }">
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                      {{ error.message }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm" :class="error.typeColor">
                      {{ error.type }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {{ error.environment }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                      <button
                        @click="openInVSCode(error.filePath, error.line)"
                        class="text-blue-600 hover:text-blue-900 hover:underline"
                      >
                        {{ error.location }}
                      </button>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      {{ error.lastSeen }}
                    </td>
                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div class="flex items-center justify-end space-x-3">
                        <button
                          v-if="!error.resolved"
                          @click="resolveError(error.id)"
                          class="text-green-600 hover:text-green-900"
                        >
                          Resolve
                        </button>
                        <button
                          @click="shareError(error)"
                          class="text-blue-600 hover:text-blue-900"
                        >
                          Share
                        </button>
                        <a
                          href="#"
                          class="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </a>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
