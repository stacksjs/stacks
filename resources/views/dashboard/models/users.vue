<template>
  <div class="min-h-screen py-4 lg:py-8 dark:bg-blue-gray-800">
    <div class="px-4 mb-8 sm:px-6 lg:px-8">
      <div>
        <h3 class="text-base font-semibold leading-6 text-gray-900">
          Last 30 days
        </h3>

        <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <p class="ml-16 truncate text-sm font-medium text-gray-500">
                Total Users
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl font-semibold text-gray-900">
                12,345
              </p>
              <p class="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                678
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="px-4 sm:px-6 lg:px-8 pt-12">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 text-gray-900">
            Users
          </h1>
          <p class="mt-2 text-sm text-gray-700">
            A list of all your project users.
          </p>
        </div>

        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            Add User
          </button>
        </div>
      </div>

      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      ID
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Updated At
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Created At
                    </th>

                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-gray-200 bg-white">
                  <tr>
                    <td class="whitespace-nowrap pl-4 pr-3 py-4 text-sm font-medium text-gray-900 sm:pl-6">
                      1
                    </td>

                    <td class="whitespace-nowrap text-right px-3 py-4 text-sm text-gray-500">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 w-10 h-10">
                          <img
                            src="https://carefreeagency-eliinova.s3.amazonaws.com/images/avatar/default.svg"
                            alt=""
                            class="w-10 h-10 rounded-full"
                          >
                        </div>

                        <div class="ml-4">
                          <div class="flex items-center text-sm font-medium text-gray-900 dark:text-gray-100">
                            Chris Breuer
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">
                            chris@stacksjs.org
                          </div>
                        </div>
                      </div>
                    </td>

                    <td class="whitespace-nowrap text-right px-3 py-4 text-sm text-gray-500">
                      2024/01/22 11:00am
                    </td>

                    <td class="whitespace-nowrap text-right px-3 py-4 text-sm text-gray-500">
                      2024/01/02 4:20pm
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900">Edit<span class="sr-only">, User</span></a>
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
