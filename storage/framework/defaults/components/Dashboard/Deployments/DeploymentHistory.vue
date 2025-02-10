<template>
  <div class="px-4 pt-12 lg:px-8 sm:px-6">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base text-gray-900 font-semibold leading-6">
          Deployment History
        </h1>
        <p class="mt-2 text-sm text-gray-700">
          A list of all the <em>(zero-downtime)</em> deployments relating your project.
        </p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline">
          Deploy
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
                    When
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                    Triggered By
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                    Commit
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                    Status
                  </th>

                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>

              <tbody class="bg-white divide-y divide-gray-200">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                    Moments ago
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div class="flex items-center">
                      <div class="h-10 w-10 flex-shrink-0">
                        <img
                          src="https://avatars.githubusercontent.com/u/6228425?v=4"
                          alt=""
                          class="h-10 w-10 rounded-full"
                        >
                      </div>
                      <div class="ml-4">
                        <div class="flex items-center text-sm text-gray-900 font-medium dark:text-gray-100">
                          Chris Breuer
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-300 dark:text-gray-400">
                          chris@stacksjs.org
                        </div>
                      </div>
                    </div>
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                    <div class="flex gap-x-3">
                      <div class="font-mono text-sm/6 text-gray-700">
                        <a href="github.com/stacksjs/stacks/commit/342afe5a" class="hover:text-gray-800 transition ease-in-out duration-150">342afe5a</a>
                      </div>

                      <div class="rounded-md bg-gray-300/40 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-white/10">main</div>
                    </div>
                  </td>

                  <td class="py-4 pr-4 pl-0 text-sm/6 sm:pr-8 lg:pr-20">
                    <div class="flex items-center justify-end gap-x-2 sm:justify-start">
                      <time class="text-gray-400 sm:hidden" datetime="2023-01-23T11:00">45 minutes ago</time>
                      <div class="flex-none rounded-full bg-green-400/10 p-1 text-green-400">
                        <div class="size-1.5 rounded-full bg-current"></div>
                      </div>
                      <div class="hidden text-gray-900 sm:block">Completed</div>
                    </div>
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
