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
              Below you may edit the <code class="text-red-400">.env</code> file for your application, which is the default environment file that is loaded by Laravel applications. If the application is uninstalled, the environment file will also be removed.
            </p>
          </div>
        </div>
      </div>
      <div>
        <pre
          v-highlightjs
        >
        <code class="plaintext">
  VITE_API_BASE_URL=https://stacks.test/api/v3
  VITE_API_ROOT_BASE_URL=https://stacks.test
  VITE_MEILISEARCH_HOST=http://127.0.0.1:7700/
  VITE_MEILISEARCH_KEY=
  VITE_FLAREAPP_BASE_URL=https://flareapp.io/api
  VITE_FLAREAPP_KEY=aaaaaa
  VITE_FLAREAPP_REPORTS_KEY=bbbbbb
        </code></pre>
      </div>
      <div>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="rounded bg-indigo-600 px-2 py-1 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Save
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
