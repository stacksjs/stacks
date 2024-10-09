<script setup lang="ts">

</script>

<template>
  <form>
    <div class="space-y-12">
      <div class="border-b border-gray-900/10 pb-12">
        <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
          <div class="sm:col-span-3">
            <label for="default-config" class="block text-sm text-gray-900 font-medium leading-6">Deploy AI
              Endpoints</label>
            <div class="mt-2">
              <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
              <button
                type="button"
                class="relative h-6 w-11 inline-flex flex-shrink-0 cursor-pointer border-2 border-transparent rounded-full bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
                role="switch" aria-checked="false"
              >
                <span class="sr-only">Deploy</span>
                <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 translate-x-0 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                />
              </button>
            </div>
          </div>

          <div class="sm:col-span-3" />

          <div class="sm:col-span-3">
            <div>
              <label for="combobox" class="block text-sm text-gray-900 font-medium leading-6">Models</label>
              <div class="relative mt-2">
                <input
                  id="combobox" type="text"
                  class="w-full border-0 rounded-md bg-white py-1.5 pl-3 pr-12 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset"
                  role="combobox" aria-controls="options" aria-expanded="false"
                  value="meta.llama2-70b-chat-v1"
                >
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none"
                >
                  <svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fill-rule="evenodd"
                      d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>

                <ul
                  id="options"
                  class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 sm:text-sm focus:outline-none"
                  role="listbox"
                >
                  <!--
                    Combobox option, manage highlight styles based on mouseenter/mouseleave and keyboard navigation.

                    Active: "text-white bg-indigo-600", Not Active: "text-gray-900"
                  -->
                  <li
                    id="option-2"
                    class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white"
                    role="option" tabindex="-1"
                  >
                    <div class="flex items-center">
                      <!-- Online: "bg-green-400", Not Online: "bg-gray-200" -->
                      <span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-gray-200" aria-hidden="true" />
                      <!-- Selected: "font-semibold" -->
                      <span class="ml-3 truncate">
                        amazon.titan-embed-text-v1
                        <span class="sr-only"> is offline</span>
                      </span>
                    </div>
                  </li>
                  <li
                    id="option-1"
                    class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white"
                    role="option" tabindex="-1"
                  >
                    <div class="flex items-center">
                      <!-- Online: "bg-green-400", Not Online: "bg-gray-200" -->
                      <span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-green-400" aria-hidden="true" />
                      <!-- Selected: "font-semibold" -->
                      <span class="ml-3 truncate">
                        amazon.titan-text-express-v1
                        <span class="sr-only"> is online</span>
                      </span>
                    </div>
                  </li>
                  <li
                    id="option-1"
                    class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white"
                    role="option" tabindex="-1"
                  >
                    <div class="flex items-center">
                      <!-- Online: "bg-green-400", Not Online: "bg-gray-200" -->
                      <span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-green-400" aria-hidden="true" />
                      <!-- Selected: "font-semibold" -->
                      <span class="ml-3 truncate">
                        amazon.titan-text-lite-v1
                        <span class="sr-only"> is online</span>
                      </span>
                    </div>
                  </li>
                  <li
                    id="option-2"
                    class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white"
                    role="option" tabindex="-1"
                  >
                    <div class="flex items-center">
                      <!-- Online: "bg-green-400", Not Online: "bg-gray-200" -->
                      <span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-gray-200" aria-hidden="true" />
                      <!-- Selected: "font-semibold" -->
                      <span class="ml-3 truncate">
                        amazon.titan-embed-image-v1
                        <span class="sr-only"> is offline</span>
                      </span>
                    </div>
                  </li>
                  <li
                    id="option-2"
                    class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white"
                    role="option" tabindex="-1"
                  >
                    <div class="flex items-center">
                      <!-- Online: "bg-green-400", Not Online: "bg-gray-200" -->
                      <span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-gray-200" aria-hidden="true" />
                      <!-- Selected: "font-semibold" -->
                      <span class="ml-3 truncate">
                        amazon.titan-image-generator-v1
                        <span class="sr-only"> is offline</span>
                      </span>
                    </div>
                  </li>
                  <li
                    id="option-2"
                    class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white"
                    role="option" tabindex="-1"
                  >
                    <div class="flex items-center">
                      <!-- Online: "bg-green-400", Not Online: "bg-gray-200" -->
                      <span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-gray-200" aria-hidden="true" />
                      <!-- Selected: "font-semibold" -->
                      <span class="ml-3 truncate">
                        anthropic.claude-v1
                        <span class="sr-only"> is offline</span>
                      </span>
                    </div>
                  </li>
                  <li
                    id="option-2"
                    class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white"
                    role="option" tabindex="-1"
                  >
                    <div class="flex items-center">
                      <!-- Online: "bg-green-400", Not Online: "bg-gray-200" -->
                      <span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-gray-200" aria-hidden="true" />
                      <!-- Selected: "font-semibold" -->
                      <span class="ml-3 truncate">
                        anthropic.claude-v2
                        <span class="sr-only"> is offline</span>
                      </span>
                    </div>
                  </li>
                  <li
                    id="option-2"
                    class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white"
                    role="option" tabindex="-1"
                  >
                    <div class="flex items-center">
                      <!-- Online: "bg-green-400", Not Online: "bg-gray-200" -->
                      <span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-gray-200" aria-hidden="true" />
                      <!-- Selected: "font-semibold" -->
                      <span class="ml-3 truncate">
                        anthropic.claude-v2:1
                        <span class="sr-only"> is offline</span>
                      </span>
                    </div>
                  </li>
                  <li
                    id="option-2"
                    class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white"
                    role="option" tabindex="-1"
                  >
                    <div class="flex items-center">
                      <!-- Online: "bg-green-400", Not Online: "bg-gray-200" -->
                      <span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-gray-200" aria-hidden="true" />
                      <!-- Selected: "font-semibold" -->
                      <span class="ml-3 truncate">
                        anthropic.claude-instant-v1
                        <span class="sr-only"> is offline</span>
                      </span>
                    </div>
                  </li>
                  <li
                    id="option-2"
                    class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white"
                    role="option" tabindex="-1"
                  >
                    <div class="flex items-center">
                      <!-- Online: "bg-green-400", Not Online: "bg-gray-200" -->
                      <span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-gray-200" aria-hidden="true" />
                      <!-- Selected: "font-semibold" -->
                      <span class="ml-3 truncate">
                        meta.llama2-13b-chat-v1
                        <span class="sr-only"> is offline</span>
                      </span>
                    </div>
                  </li>
                  <li
                    id="option-0"
                    class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white"
                    role="option" tabindex="-1"
                  >
                    <div class="flex items-center">
                      <!-- Online: "bg-green-400", Not Online: "bg-gray-200" -->
                      <span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-green-400" aria-hidden="true" />
                      <!-- Selected: "font-semibold" -->
                      <span class="ml-3 truncate">
                        amazon.titan-text-express-v1
                        <span class="sr-only"> is online</span>
                      </span>
                    </div>

                    <!--
                      Checkmark, only display for selected option.

                      Active: "text-white", Not Active: "text-indigo-600"
                    -->
                    <span class="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600">
                      <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path
                          fill-rule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </span>
                  </li>

                  <!-- More items... -->
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 flex items-center justify-end gap-x-6">
      <button type="button" class="text-sm text-gray-900 font-semibold leading-6">
        Cancel
      </button>
      <Button
        type="submit"
        class="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white font-semibold shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 focus-visible:outline"
      >
        Save
      </Button>
    </div>
  </form>
</template>

<style scoped>

</style>
