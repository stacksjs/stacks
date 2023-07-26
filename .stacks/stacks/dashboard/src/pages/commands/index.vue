<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <form class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-gray-800">
      <div class="flex items-center justify-between">
        <h5 class="forge-h5">
          Commands
        </h5>
      </div>
      <div class="py-2">
        <div class="bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400 flex flex-row rounded-lg p-4 text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="text-gray-400 h-6 flex-shrink-0"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          /></svg><div class="ml-4 mt-0.5 flex flex-grow">
            <p class="">
              Stacks allows you to easily execute arbitrary commands on your server. All commands are executed from within the site's root directory <br> Commands will be executed as the <code class="text-red-400">stacks</code> user and may run for two minutes before timing out.
            </p>
          </div>
        </div>
        <div class="mt-4 flex flex-col">
          <label>Command</label><div class="mt-1 flex flex-col">
            <input
              type="text"
              class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              list="artisanCommands"
              placeholder="ls -la"
              autocorrect="off"
            >
          </div>
        </div>
      </div>
      <div>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="rounded bg-indigo-600 px-2 py-1 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Submit
          </button>
        </div>
      </div>
    </form>

    <div class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-gray-800 mt-16">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 text-gray-900">
            History
          </h1>
        </div>
      </div>
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0"
                  >
                    User
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Command
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Time
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Duration
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    class="relative py-3 pl-3 pr-4 sm:pr-0"
                  >
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                    Chris Breuer
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <pre
                      v-highlightjs
                    ><code class="bash"> buddy dev:components </code></pre>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    3 hours ago
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    30s
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    Finished
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-indigo-600 hover:text-indigo-900"
                    >Edit<span class="sr-only">, Lindsay Walton</span></a>
                  </td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                    Chris Breuer
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <pre
                      v-highlightjs
                    ><code class="bash"> buddy dev:desktop </code></pre>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    3 hours ago
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    30s
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    Finished
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-indigo-600 hover:text-indigo-900"
                    >Edit<span class="sr-only">, Lindsay Walton</span></a>
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

<style>
code {
  @apply rounded-lg !important
}
</style>
