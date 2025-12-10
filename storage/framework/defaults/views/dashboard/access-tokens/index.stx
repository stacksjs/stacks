<script lang="ts" setup>
useHead({
  title: 'Dashboard - Access Tokens',
})

const tokens = [
  {
    name: 'Mobile App Token',
    token: '2|LlNSaUVFmBXoD6OYH5ZxNlxsFxHh4QqGxspKGKdt',
    abilities: ['read', 'write'],
    lastUsed: '2 minutes ago',
    status: 'active',
    createdAt: '2024-01-15 08:23:15',
    expiresAt: '2024-02-14 08:23:15'
  },
  {
    name: 'Dashboard API',
    token: '3|KkMRbTEElBWnC5NXG4YwMkwrEwGg3PpFwroJFJcs',
    abilities: ['read'],
    lastUsed: '1 hour ago',
    status: 'active',
    createdAt: '2024-01-10 15:45:30',
    expiresAt: '2024-01-24 15:45:30'
  },
  {
    name: 'Integration Service',
    token: '4|JjLQaSsDDkVmB4MWF3XvLjvrDvFf2OoEvqnIEIbr',
    abilities: ['read', 'write', 'delete'],
    lastUsed: '3 days ago',
    status: 'revoked',
    createdAt: '2023-12-20 11:30:00',
    expiresAt: '2024-01-19 11:30:00'
  }
]
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 font-semibold leading-6">
          Token Statistics
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-key h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Active Tokens
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                {{ tokens.filter(t => t.status === 'active').length }}
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="px-4 pt-12 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 font-semibold leading-6">
            Access Tokens
          </h1>
          <p class="mt-2 text-sm text-gray-700">
            Manage your API access tokens for authentication
          </p>
        </div>

        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline">
            Generate New Token
          </button>
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
                      Name
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Last Used
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Abilities
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Status
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold sm:text-right">
                      Created At
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold sm:text-right">
                      Expires At
                    </th>

                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>

                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="token in tokens" :key="token.name">
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                      {{ token.name }}
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {{ token.lastUsed }}
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div class="flex gap-1">
                        <span
                          v-for="ability in token.abilities"
                          :key="ability"
                          class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700 font-medium ring-1 ring-blue-600/20 ring-inset"
                        >
                          {{ ability }}
                        </span>
                      </div>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <span
                        :class="[
                          'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset',
                          token.status === 'active'
                            ? 'bg-green-50 text-green-700 ring-green-600/20'
                            : 'bg-red-50 text-red-700 ring-red-600/20'
                        ]"
                      >
                        {{ token.status }}
                      </span>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      {{ token.createdAt }}
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      {{ token.expiresAt }}
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <button
                        class="text-blue-600 hover:text-blue-900 mr-4"
                        :disabled="token.status === 'revoked'"
                      >
                        {{ token.status === 'active' ? 'Revoke' : 'Revoked' }}
                      </button>
                      <button class="text-gray-600 hover:text-gray-900">
                        Copy
                      </button>
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
