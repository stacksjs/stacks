<script setup lang="ts">

</script>

<template>
  <form>
    <main class="border-b border-gray-900/10">
      <!-- Settings forms -->
      <div class="divide-y divide-gray-900/10">
        <div class="grid grid-cols-1 max-w-7xl gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              Library Base Configurations
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your Library Configuration
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 w-full gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-2">
                <label for="local-driver" class="block text-sm text-gray-900 font-medium leading-6">Name</label>
                <div class="mt-2">
                  <input id="local-driver" type="text" name="local-driver" value="hello-world" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Owner</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="@stacksjs" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Repository</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="stacksjs/stacks" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">License</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="MIT" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Author</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="Chris Breuer" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="type" class="block text-sm text-gray-900 font-medium leading-6">Default Language</label>
                <div class="mt-2">
                  <select id="type" name="type" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:max-w-xs sm:text-sm sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                    <option selected>
                      en
                    </option>
                  </select>
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Contributors</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="Chris Breuer <chris@stacksjs.org>" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="default-config" class="block text-sm text-gray-900 font-medium leading-6">Releaseable</label>
                <div class="flex items-center gap-x-4">
                  <div class="mt-2">
                    <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                    <button
                      type="button"
                      class="relative h-6 w-11 inline-flex flex-shrink-0 cursor-pointer border-2 border-transparent rounded-full bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
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

        <div class="grid grid-cols-1 max-w-7xl gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              Library Functions
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your Library Funtions Configuration
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 w-full gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-2">
                <label for="local-driver" class="block text-sm text-gray-900 font-medium leading-6">Name</label>
                <div class="mt-2">
                  <input id="local-driver" type="text" name="local-driver" value="hello-world-fx" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Description</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="Your function library description." class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Keywords</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="functions,composables,library,typescript,javascript" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="default-config" class="block text-sm text-gray-900 font-medium leading-6">Should Generate Sourcemap</label>
                <div class="flex items-center gap-x-4">
                  <div class="mt-2">
                    <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                    <button
                      type="button"
                      class="relative h-6 w-11 inline-flex flex-shrink-0 cursor-pointer border-2 border-transparent rounded-full bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
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
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Files</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="counter,dark" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 max-w-7xl gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              Vue Components Configurations
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your Vue Components Configuration
            </p>
          </div>

          <div class="md:col-span-full">
            <div class="grid grid-cols-1 w-full gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-2">
                <label for="local-driver" class="block text-sm text-gray-900 font-medium leading-6">Name</label>
                <div class="mt-2">
                  <input id="local-driver" type="text" name="local-driver" value="hello-world-vue" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Keywords</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="component,library,vue,vite,typescript,javascript" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Description</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="Your Vue component library description" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-full">
                <div class="mb-4 flex justify-between">
                  <div>
                    <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
                      Vue Components Tags
                    </h2>
                    <p class="mt-1 text-sm text-gray-600 leading-6">
                      Update Vue Components Tags, click on the button to show modal to add new tag
                    </p>
                  </div>

                  <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                    <button type="button" class="block rounded-md bg-gray-600 px-3 py-2 text-center text-sm text-white font-semibold shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 focus-visible:outline">
                      Add Tag
                    </button>
                  </div>
                </div>

                <div class="mt-8 flow-root">
                  <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
                    <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
                      <table class="min-w-full divide-y divide-gray-300">
                        <thead>
                          <tr>
                            <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 font-semibold sm:pl-0">
                              Name(s)
                            </th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                              Attributes
                            </th>
                            <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                              <span class="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          <tr>
                            <td class="whitespace-nowrap py-5 text-sm sm:pl-0">
                              <div class="flex items-center">
                                <div class="ml-4">
                                  <div class="text-gray-900 font-semibold">
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
                                {<span class="text-gray-900 font-semibold">name :</span><span class="text-gray-500 font-semibold">greeting</span>},
                              </div>
                            </td>

                            <td class="py-4 pl-3 pr-4 text-right text-sm font-medium space-x-6 sm:pr-0">
                              <a href="#" class="text-gray-400 font-semibold hover:text-gray-600">Delete<span class="sr-only">, localhost</span></a>
                              <a href="#" class="text-indigo-600 font-semibold hover:text-indigo-900">Edit<span class="sr-only">, localhost</span></a>
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

        <div class="grid grid-cols-1 max-w-7xl gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              Web Components Configurations
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your Web Components Configuration
            </p>
          </div>

          <div class="md:col-span-full">
            <div class="grid grid-cols-1 w-full gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-2">
                <label for="local-driver" class="block text-sm text-gray-900 font-medium leading-6">Name</label>
                <div class="mt-2">
                  <input id="local-driver" type="text" name="local-driver" value="hello-world-elements" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Keywords</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="custom-elements,web-components,library,framework-agnostic,typescript,javascript" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Description</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="Your framework agnostic web component library description." class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-full">
                <div class="mb-4 flex justify-between">
                  <div>
                    <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
                      Web Components Tags
                    </h2>
                    <p class="mt-1 text-sm text-gray-600 leading-6">
                      Update Web Components Tags, click on the button to show modal to add new tag
                    </p>
                  </div>

                  <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                    <button type="button" class="block rounded-md bg-gray-600 px-3 py-2 text-center text-sm text-white font-semibold shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 focus-visible:outline">
                      Add Tag
                    </button>
                  </div>
                </div>

                <div class="mt-8 flow-root">
                  <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
                    <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
                      <table class="min-w-full divide-y divide-gray-300">
                        <thead>
                          <tr>
                            <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 font-semibold sm:pl-0">
                              Name(s)
                            </th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                              Attributes
                            </th>
                            <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                              <span class="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          <tr>
                            <td class="whitespace-nowrap py-5 text-sm sm:pl-0">
                              <div class="flex items-center">
                                <div class="ml-4">
                                  <div class="text-gray-900 font-semibold">
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
                                {<span class="text-gray-900 font-semibold">name :</span><span class="text-gray-500 font-semibold">greeting</span>},
                              </div>
                            </td>

                            <td class="py-4 pl-3 pr-4 text-right text-sm font-medium space-x-6 sm:pr-0">
                              <a href="#" class="text-gray-400 font-semibold hover:text-gray-600">Delete<span class="sr-only">, localhost</span></a>
                              <a href="#" class="text-indigo-600 font-semibold hover:text-indigo-900">Edit<span class="sr-only">, localhost</span></a>
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
