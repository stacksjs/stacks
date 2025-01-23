<template>
  <div class="px-4 pt-12 lg:px-8 sm:px-6">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base text-gray-900 font-semibold leading-6">
          Deploy Script
        </h1>

        <p class="mt-2 text-sm text-gray-700">
          If you need a custom deploy script, you may specify it here.
        </p>
      </div>

      <!-- <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline">
          Save
        </button>
      </div> -->
    </div>

    <div class="mt-8 flow-root">
      <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
        <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
          <div class="overflow-hidden">
            <CodeEditor />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
