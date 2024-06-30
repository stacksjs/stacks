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
              Library Base Configurations
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your Library Configuration
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="w-full grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-2">
                <label for="local-driver" class="block text-sm font-medium leading-6 text-gray-900">Name</label>
                <div class="mt-2">
                  <input id="local-driver" type="text" name="local-driver" value="hello-world" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Owner</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="@stacksjs" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Repository</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="stacksjs/stacks" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">License</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="MIT" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Author</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="Chris Breuer" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="type" class="block text-sm font-medium leading-6 text-gray-900">Default Language</label>
                <div class="mt-2">
                  <select id="type" name="type" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6">
                    <option selected>
                      en
                    </option>
                  </select>
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Contributors</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="Chris Breuer <chris@stacksjs.org>" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="default-config" class="block text-sm font-medium leading-6 text-gray-900">Releaseable</label>
                <div class="flex items-center gap-x-4">
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
              </div>
            </div>
          </div>
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              Library Functions
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your Library Funtions Configuration
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="w-full grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-2">
                <label for="local-driver" class="block text-sm font-medium leading-6 text-gray-900">Name</label>
                <div class="mt-2">
                  <input id="local-driver" type="text" name="local-driver" value="hello-world-fx" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Description</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="Your function library description." class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Keywords</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="functions,composables,library,typescript,javascript" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="default-config" class="block text-sm font-medium leading-6 text-gray-900">Should Generate Sourcemap</label>
                <div class="flex items-center gap-x-4">
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
              </div>

              <div class="sm:col-span-full">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Files</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="counter,dark" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              Vue Components Configurations
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your Vue Components Configuration
            </p>
          </div>

          <div class="md:col-span-full">
            <div class="w-full grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-2">
                <label for="local-driver" class="block text-sm font-medium leading-6 text-gray-900">Name</label>
                <div class="mt-2">
                  <input id="local-driver" type="text" name="local-driver" value="hello-world-vue" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Keywords</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="component,library,vue,vite,typescript,javascript" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Description</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="Your Vue component library description" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-full">
                <div class="flex mb-4 justify-between">
                  <div>
                    <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
                      Vue Components Tags
                    </h2>
                    <p class="mt-1 text-sm leading-6 text-gray-600">
                      Update Vue Components Tags, click on the button to show modal to add new tag
                    </p>
                  </div>

                  <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                    <button type="button" class="block rounded-md bg-gray-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                      Add Tag
                    </button>
                  </div>
                </div>

                <div class="mt-8 flow-root">
                  <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                      <table class="min-w-full divide-y divide-gray-300">
                        <thead>
                          <tr>
                            <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                              Name(s)
                            </th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              Attributes
                            </th>
                            <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                              <span class="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                          <tr>
                            <td class="whitespace-nowrap py-5 text-sm sm:pl-0">
                              <div class="flex items-center">
                                <div class="ml-4">
                                  <div class="font-semibold text-gray-900">
                                    HelloWorld, AppHelloWorld
                                  </div>
                                  <div class="mt-4 text-gray-500">
                                    The Hello World custom element, built via this framework.
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td class="whitespace-nowrap px-3 py-5 text-sm text-gray-500">
                              <div class="flex items-center gap-x-4">
                                {<span class="font-semibold text-gray-900">name :</span><span class="font-semibold text-gray-500">greeting</span>},
                              </div>
                            </td>

                            <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0 space-x-6">
                              <a href="#" class="font-semibold text-gray-400 hover:text-gray-600">Delete<span class="sr-only">, localhost</span></a>
                              <a href="#" class="font-semibold text-indigo-600 hover:text-indigo-900">Edit<span class="sr-only">, localhost</span></a>
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
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              Web Components Configurations
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your Web Components Configuration
            </p>
          </div>

          <div class="md:col-span-full">
            <div class="w-full grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-2">
                <label for="local-driver" class="block text-sm font-medium leading-6 text-gray-900">Name</label>
                <div class="mt-2">
                  <input id="local-driver" type="text" name="local-driver" value="hello-world-elements" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Keywords</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="custom-elements,web-components,library,framework-agnostic,typescript,javascript" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Description</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="Your framework agnostic web component library description." class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-full">
                <div class="flex mb-4 justify-between">
                  <div>
                    <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
                      Web Components Tags
                    </h2>
                    <p class="mt-1 text-sm leading-6 text-gray-600">
                      Update Web Components Tags, click on the button to show modal to add new tag
                    </p>
                  </div>

                  <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                    <button type="button" class="block rounded-md bg-gray-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                      Add Tag
                    </button>
                  </div>
                </div>

                <div class="mt-8 flow-root">
                  <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                      <table class="min-w-full divide-y divide-gray-300">
                        <thead>
                          <tr>
                            <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                              Name(s)
                            </th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              Attributes
                            </th>
                            <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                              <span class="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                          <tr>
                            <td class="whitespace-nowrap py-5 text-sm sm:pl-0">
                              <div class="flex items-center">
                                <div class="ml-4">
                                  <div class="font-semibold text-gray-900">
                                    HelloWorld, AppHelloWorld
                                  </div>
                                  <div class="mt-4 text-gray-500">
                                    The Hello World custom element, built via this framework.
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td class="whitespace-nowrap px-3 py-5 text-sm text-gray-500">
                              <div class="flex items-center gap-x-4">
                                {<span class="font-semibold text-gray-900">name :</span><span class="font-semibold text-gray-500">greeting</span>},
                              </div>
                            </td>

                            <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0 space-x-6">
                              <a href="#" class="font-semibold text-gray-400 hover:text-gray-600">Delete<span class="sr-only">, localhost</span></a>
                              <a href="#" class="font-semibold text-indigo-600 hover:text-indigo-900">Edit<span class="sr-only">, localhost</span></a>
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
