<script setup lang="ts">

</script>

<template>
  <form>
    <main class="border-b border-gray-900/10">
      <!-- Settings forms -->
      <div class="divide-y divide-gray-900/10">
        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              Default Cloud Settings
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your default cloud settings
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="w-full grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="type" class="block text-sm font-medium leading-6 text-gray-900">Type</label>
                <div class="mt-2">
                  <select id="type" name="type" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6">
                    <option selected>
                      serverless
                    </option>
                    <option disabled>
                      server
                    </option>
                  </select>
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="driver" class="block text-sm font-medium leading-6 text-gray-900">Driver</label>
                <div class="mt-2">
                  <input id="driver" type="text" name="driver" value="aws" disabled class="cursor-not-allowed bg-blue-gray-50 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="default-config" class="block text-sm font-medium leading-6 text-gray-900">Enable AI</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Enable AI</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-0 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="sm:col-span-2">
                <label for="default-config" class="block text-sm font-medium leading-6 text-gray-900">Enable CLI</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Enable CLI</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-0 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="sm:col-span-2">
                <label for="default-config" class="block text-sm font-medium leading-6 text-gray-900">Enable Docs</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Enable Docs</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="sm:col-span-2">
                <label for="default-config" class="block text-sm font-medium leading-6 text-gray-900">Enable File System</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Enable File System</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="env" class="block text-sm font-medium leading-6 text-gray-900">Environments</label>
                <div class="mt-2">
                  <input id="env" type="text" name="env" placeholder="https://test.test" value="production,staging,development" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              Api
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your api settings.
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="col-span-2">
                <label
                  for="api-deploy"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Deploy</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Api Deploy</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="col-span-full">
                <label
                  for="api-description"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Description</label>
                <div class="mt-2">
                  <input
                    id="api-description"
                    type="text"
                    value="My awesome Stacks API"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="col-span-2">
                <label
                  for="api-prefix"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Prefix</label>
                <div class="mt-2">
                  <input
                    id="api-prefix"
                    name="prefix"
                    type="text"
                    value="api"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="col-span-2">
                <label
                  for="api-memory-size"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Memory Size(MB)</label>
                <div class="mt-2">
                  <input
                    id="api-memory-size"
                    name="prefix"
                    type="text"
                    value="512"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="col-span-2">
                <label
                  for="api-memory-size"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Prewarn</label>
                <div class="mt-2">
                  <input
                    id="api-memory-size"
                    name="prewarn"
                    type="text"
                    value="10"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="col-span-2">
                <label
                  for="api-timeout"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Timeout</label>
                <div class="mt-2">
                  <input
                    id="api-timeout"
                    name="prewarn"
                    type="text"
                    value="30"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="col-span-full">
                <fieldset>
                  <legend class="text-sm leading-6 text-gray-900">
                    Available Routes
                  </legend>
                  <div class="mt-2 grid grid-cols-1 gap-y-6 sm:grid-cols-3 sm:gap-x-4">
                    <!-- Active: "border-indigo-600 ring-2 ring-indigo-600", Not Active: "border-gray-300" -->
                    <label aria-label="Newsletter" aria-description="Last message sent an hour ago to 621 users" class="border-indigo-600 ring-2 ring-indigo-600 relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none">
                      <input type="radio" name="project-type" value="Newsletter" class="sr-only">
                      <span class="flex flex-1">
                        <span class="flex flex-col">
                          <span class="block text-sm font-medium text-gray-900">Index</span>
                          <span class="mt-1 flex items-center text-sm text-gray-500">Endpoint to list all resources</span>
                          <span class="mt-6 text-sm font-medium text-gray-900">Available</span>
                        </span>
                      </span>
                      <!-- Not Checked: "invisible" -->
                      <svg class="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
                      </svg>
                      <!--
                        Active: "border", Not Active: "border-2"
                        Checked: "border-indigo-600", Not Checked: "border-transparent"
                      -->
                      <span class="pointer-events-none absolute -inset-px rounded-lg border-2" aria-hidden="true" />
                    </label>

                    <!-- Active: "border-indigo-600 ring-2 ring-indigo-600", Not Active: "border-gray-300" -->
                    <label aria-label="Newsletter" aria-description="Last message sent an hour ago to 621 users" class="border-indigo-600 ring-2 ring-indigo-600 relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none">
                      <input type="radio" name="project-type" value="Newsletter" class="sr-only">
                      <span class="flex flex-1">
                        <span class="flex flex-col">
                          <span class="block text-sm font-medium text-gray-900">Show</span>
                          <span class="mt-1 flex items-center text-sm text-gray-500">Endpoint to get one resource</span>
                          <span class="mt-6 text-sm font-medium text-gray-900">Available</span>
                        </span>
                      </span>
                      <!-- Not Checked: "invisible" -->
                      <svg class="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
                      </svg>
                      <!--
                        Active: "border", Not Active: "border-2"
                        Checked: "border-indigo-600", Not Checked: "border-transparent"
                      -->
                      <span class="pointer-events-none absolute -inset-px rounded-lg border-2" aria-hidden="true" />
                    </label>

                    <!-- Active: "border-indigo-600 ring-2 ring-indigo-600", Not Active: "border-gray-300" -->
                    <label aria-label="Newsletter" aria-description="Last message sent an hour ago to 621 users" class="border-indigo-600 ring-2 ring-indigo-600 relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none">
                      <input type="radio" name="project-type" value="Newsletter" class="sr-only">
                      <span class="flex flex-1">
                        <span class="flex flex-col">
                          <span class="block text-sm font-medium text-gray-900">Store</span>
                          <span class="mt-1 flex items-center text-sm text-gray-500">Endpoint to add resource</span>
                          <span class="mt-6 text-sm font-medium text-gray-900">Available</span>
                        </span>
                      </span>
                      <!-- Not Checked: "invisible" -->
                      <svg class="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
                      </svg>
                      <!--
                        Active: "border", Not Active: "border-2"
                        Checked: "border-indigo-600", Not Checked: "border-transparent"
                      -->
                      <span class="pointer-events-none absolute -inset-px rounded-lg border-2" aria-hidden="true" />
                    </label>

                    <!-- Active: "border-indigo-600 ring-2 ring-indigo-600", Not Active: "border-gray-300" -->
                    <label aria-label="Newsletter" aria-description="Last message sent an hour ago to 621 users" class="border-indigo-600 ring-2 ring-indigo-600 relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none">
                      <input type="radio" name="project-type" value="Newsletter" class="sr-only">
                      <span class="flex flex-1">
                        <span class="flex flex-col">
                          <span class="block text-sm font-medium text-gray-900">Update</span>
                          <span class="mt-1 flex items-center text-sm text-gray-500">Endpoint to update resource</span>
                          <span class="mt-6 text-sm font-medium text-gray-900">Available</span>
                        </span>
                      </span>
                      <!-- Not Checked: "invisible" -->
                      <svg class="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
                      </svg>
                      <!--
                        Active: "border", Not Active: "border-2"
                        Checked: "border-indigo-600", Not Checked: "border-transparent"
                      -->
                      <span class="pointer-events-none absolute -inset-px rounded-lg border-2" aria-hidden="true" />
                    </label>

                    <!-- Active: "border-indigo-600 ring-2 ring-indigo-600", Not Active: "border-gray-300" -->
                    <label aria-label="Newsletter" aria-description="Last message sent an hour ago to 621 users" class="border-gray-300 relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none">
                      <input type="radio" name="project-type" value="Newsletter" class="sr-only">
                      <span class="flex flex-1">
                        <span class="flex flex-col">
                          <span class="block text-sm font-medium text-gray-900">Delete</span>
                          <span class="mt-1 flex items-center text-sm text-gray-500">Endpoint to delete resource</span>
                          <span class="mt-6 text-sm font-medium text-gray-500">Not Available</span>
                        </span>
                      </span>

                    </label>
                  </div>
                </fieldset>
              </div>
            </div>
          </div>
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              Firewall
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your firewall settings.
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="col-span-2">
                <label
                  for="api-deploy"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Enabled</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Api Deploy</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="col-span-2">
                <label
                  for="api-deploy"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Use Ip Reputation Lists</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Use Ip Reputation Lists</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="col-span-2">
                <label
                  for="api-deploy"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Use Known Bad Inputs Rule Set</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Use Ip Reputation Lists</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="col-span-2">
                <label
                  for="api-limit-per-minute"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Rate Limit per minute</label>
                <div class="mt-2">
                  <input
                    id="api-limit-per-minute"
                    name="limit-per-minute"
                    type="text"
                    value="1000"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="col-span-2">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Country Codes</label>
                <div class="mt-2">
                  <input
                    id="api-country-codes"
                    name="limit-per-minute"
                    type="text"
                    value="RU,IN"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="sm:col-span-full">
                <label for="ip-addresses" class="block text-sm font-medium leading-6 text-gray-900">IP Addresses</label>
                <div class="mt-2">
                  <input id="ip-addresses" type="text" name="env" placeholder="https://test.test" value="56.123.456.789" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>
              <div class="sm:col-span-3">
                <label for="query-string" class="block text-sm font-medium leading-6 text-gray-900">Query String</label>
                <div class="mt-2">
                  <input id="query-string" type="text" name="env" placeholder="https://test.test" value="foo,bar" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>
              <div class="sm:col-span-3">
                <label for="http-headers" class="block text-sm font-medium leading-6 text-gray-900">HTTP Headers</label>
                <div class="mt-2">
                  <input id="http-headers" type="text" name="env" placeholder="https://test.test" value="x-foo,x-bar" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              CDN (Content Delivery Network)
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your CDN settings.
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label
                  for="api-deploy"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Compress</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Compress</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="sm:col-span-3">
                <label for="type" class="block text-sm font-medium leading-6 text-gray-900">Allowed Methods</label>
                <div class="mt-2">
                  <select id="type" name="type" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6">
                    <option selected>
                      ALL
                    </option>
                    <option>GET_HEAD</option>
                    <option>GET_HEAD_OPTIONS</option>
                  </select>
                </div>
              </div>
              <div class="sm:col-span-3">
                <label for="type" class="block text-sm font-medium leading-6 text-gray-900">Cached Methods</label>
                <div class="mt-2">
                  <select id="type" name="type" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6">
                    <option selected>
                      GET_HEAD
                    </option>
                    <option>GET_HEAD_OPTIONS</option>
                  </select>
                </div>
              </div>
              <div class="sm:col-span-3">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Origin Shield Region</label>
                <div class="mt-2">
                  <input
                    id="api-country-codes"
                    name="limit-per-minute"
                    type="text"
                    value="us-east-1"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="sm:col-span-3">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Default TTL</label>
                <div class="mt-2">
                  <input
                    id="api-country-codes"
                    name="limit-per-minute"
                    type="text"
                    value="86400"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="sm:col-span-3">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Min TTL</label>
                <div class="mt-2">
                  <input
                    id="api-country-codes"
                    name="limit-per-minute"
                    type="text"
                    value="0"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="sm:col-span-3">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Max TTL</label>
                <div class="mt-2">
                  <input
                    id="api-country-codes"
                    name="limit-per-minute"
                    type="text"
                    value="31536000"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="sm:col-span-3">
                <label for="type" class="block text-sm font-medium leading-6 text-gray-900">Cookie Behavior</label>
                <div class="mt-2">
                  <select id="type" name="type" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6">
                    <option selected>
                      none
                    </option>
                    <option>allowList</option>
                    <option>all</option>
                  </select>
                </div>
              </div>

              <div class="sm:col-span-full">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm fon2t-semibold text-gray-900 dark:text-gray-100"
                >Cookies</label>
              </div>
              <div class="sm:col-span-2">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Cookies</label>
                <div class="mt-2">
                  <input
                    id="api-country-codes"
                    name="limit-per-minute"
                    type="text"
                    value=""
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="sm:col-span-2">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Headers</label>
                <div class="mt-2">
                  <input
                    id="api-country-codes"
                    name="limit-per-minute"
                    type="text"
                    value=""
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="sm:col-span-2">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Query Strings</label>
                <div class="mt-2">
                  <input
                    id="api-country-codes"
                    name="limit-per-minute"
                    type="text"
                    value=""
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="sm:col-span-full">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm font-semibold text-gray-900 dark:text-gray-100"
                >Real Time Logs</label>
              </div>
              <div class="sm:col-span-2">
                <label
                  for="api-deploy"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Enabled</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Enabled</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="sm:col-span-2">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Sampling Rate</label>
                <div class="mt-2">
                  <input
                    id="api-country-codes"
                    name="limit-per-minute"
                    type="text"
                    value="1"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    <div class="mt-6 flex items-center justify-end gap-x-6">
      <button type="button" class="text-sm font-semibold leading-6 text-gray-900">
        Cancel
      </button>
      <Button
        type="submit"
        class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Save
      </Button>
    </div>
  </form>
</template>

<style scoped>

</style>
