<template>
  <div class="px-4 sm:px-6 lg:px-8 pt-12">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold leading-6 text-gray-900">
          Deployment History
        </h1>
        <p class="mt-2 text-sm text-gray-700">
          A list of all the <em>(zero-downtime)</em> deployments relating your project.
        </p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          Deploy
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
                    When
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Triggered By
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Commit
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Branch
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>

                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>

              <tbody class="divide-y divide-gray-200 bg-white">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                    Moments ago
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
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

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                    <a href="github.com/stacksjs/stacks/commit/342afe5a" class="text-blue-600 hover:text-blue-900">342afe5a</a>
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                    <a href="github.com/stacksjs/stacks" class="text-blue-600 hover:text-blue-900">main</a>
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    Deployed
                  </td>

                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <a href="#" class="text-blue-600 hover:text-blue-900" @click="showModal = true">View<span class="sr-only">, Deployment</span></a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
