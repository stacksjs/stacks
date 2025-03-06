<script setup lang="ts">
// which properties does your component accept?
const { greeting = 'Welcome!' } = defineProps<{
  showButtons: boolean
  greeting: string
}>()

// easily use any of the lifecycle hooks without needing to import them
onMounted(() => {
  // eslint-disable-next-line no-console
  console.log('HelloWorld component mounted & the greeting is', greeting)
})
</script>

<template>
  <div class="font-sans antialiased">
    <div class="items-top relative min-h-screen flex justify-center bg-gray-50 py-4 sm:items-center dark:bg-blue-gray-900 sm:pt-0">
      <div class="mx-auto max-w-6xl lg:px-8 sm:px-6">
        <div class="flex items-center justify-center pt-8 sm:justify-between sm:pt-0">
          <Logo />

          <div
            v-if="showButtons"
            class="flex items-end"
          >
            <Counter />

            <ToggleDark />
          </div>
        </div>

        <div class="mt-8 overflow-hidden bg-white shadow sm:rounded-lg dark:bg-blue-gray-800">
          <div class="grid grid-cols-1 md:grid-cols-2">
            <div class="p-6">
              <div class="flex items-center">
                <i
                  class="i-hugeicons-outline-book-open h-8 w-8 text-gray-500"
                  aria-hidden="true"
                />

                <div class="ml-4 text-lg font-semibold leading-7">
                  <a
                    href="https://stacksjs.org/docs"
                    class="text-gray-900 underline dark:text-white"
                  >
                    Documentation
                  </a>
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-sm text-gray-600 leading-6 dark:text-gray-400">
                  Stacks has a wonderful, thorough documentation covering every aspect of the framework. Whether you are new to the framework or have previous experience with Stacks, we recommend reading all of the documentation from beginning to end.
                </div>
              </div>
            </div>

            <div class="border-t border-gray-200 p-6 md:border-l md:border-t-0 dark:border-gray-700">
              <div class="flex items-center">
                <i
                  class="i-hugeicons-outline-puzzle h-8 w-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class="ml-4 text-lg font-semibold leading-7">
                  <a
                    href="https://stacksjs.org/components"
                    class="text-gray-900 underline dark:text-white"
                  >
                    UI Engine
                  </a>
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-sm text-gray-600 leading-6 dark:text-gray-400">
                  The easiest way to build component libraries and distribute them on npm. Stacks automatically imports all of your components & makes them available to you in your templates.
                  And it automatically builds framework agnostic (e.g. Web & Vue Components) component libraries out of those.
                </div>
              </div>
            </div>

            <div class="border-t border-gray-200 p-6 dark:border-gray-700">
              <div class="flex items-center">
                <i
                  class="i-hugeicons-outline-template h-8 w-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class="ml-4 text-lg font-semibold leading-7">
                  <a
                    href="https://stacksjs.org/functions"
                    class="text-gray-900 underline dark:text-white"
                  >
                    FX Engine
                  </a>
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-sm text-gray-600 leading-6 dark:text-gray-400">
                  Stacks provides a toolkit to easily develop functions. These “function libraries” may easily be distributed via npm or be served as API endpoints. Because Stacks loves serverless technology, scalability is built-in. <i>Don’t sweat it, it’s simple!</i>
                </div>
              </div>
            </div>

            <div class="border-t border-gray-200 p-6 md:border-l dark:border-gray-700">
              <div class="flex items-center">
                <i
                  class="i-hugeicons-outline-variable h-8 w-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class="ml-4 text-lg text-gray-900 font-semibold leading-7 dark:text-white">
                  <a
                    href="https://stacksjs.org/pages"
                    class="text-gray-900 underline dark:text-white"
                  >
                    Stacks Engine
                  </a>
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-sm text-gray-600 leading-6 dark:text-gray-400">
                  A well-designed CI/CD pipeline. Automatic component & function library npm distributions.
                  Linting & formatting enabled by default, without the need of prettier. Semver version
                  control enabled, automatic versioning & changelog generation. Access to a powerful
                  Stacks CLI. And much more.

                  <!-- The Stacks Engine is the layer that connects the UI & FX engine.
                  No need to worry about the server infrastructure anymore.
                  AWS, Vercel & Netlify and more supported. -->

                  <!--
                  - 🚀 **Built-in production deployments** _choose server, serverless, or service_<br>
                  - 🍀 **Auto-imported goodies** _Components, Functions, String & Array helpers, Collections, VueUse, etc._<br>
                  - 💡 **First-class IDE integration** _Efficient VS Code set up & fully-typed_<br> -->
                </div>
              </div>
            </div>

            <div class="border-t border-gray-200 p-6 dark:border-gray-700">
              <div class="flex items-center">
                <i
                  class="i-hugeicons-outline-terminal h-8 w-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class="ml-4 text-lg font-semibold leading-7">
                  <a
                    href="https://stacksjs.org/"
                    class="text-gray-900 underline dark:text-white"
                  >
                    Modern DX
                  </a>
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-sm text-gray-600 leading-6 dark:text-gray-400">
                  Simplistic setup, maintenance & collaboration. Deep IDE integration,
                  auto-formatting, access to powerful APIs, modern git commit conventions, npm
                  package releases, semver powered, pretty changelog generations, PR dependency updates,
                  documentation tooling, and more.

                  <i>A well-defined set of best practices & automations with an approachable design.</i>
                </div>
              </div>
            </div>

            <div class="border-t border-gray-200 p-6 md:border-l dark:border-gray-700">
              <div class="flex items-center">
                <i
                  class="i-hugeicons-outline-globe h-8 w-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class="ml-4 text-lg text-gray-900 font-semibold leading-7 dark:text-white">
                  Vibrant Ecosystem
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-sm text-gray-600 leading-6 dark:text-gray-400">
                  Stacks has a deep ecosystem of integrations & first-party libraries, including headless/unstyled, fully
                  accessible UI component libraries, designed to integrate beautifully with any tech stack of your choice.
                  <a
                    href="https://github.com/stacksjs/calendar"
                    class="text-blue-600 underline dark:text-blue-200"
                  >Calendar</a>,
                  <a
                    href="https://github.com/stacksjs/table"
                    class="text-blue-600 underline dark:text-blue-200"
                  >Tables</a>,
                  <a
                    href="https://github.com/stacksjs/date-picker"
                    class="text-blue-600 underline dark:text-blue-200"
                  >Command Palettes</a>,
                  <a
                    href="https://github.com/stacksjs/date-picker"
                    class="text-blue-600 underline dark:text-blue-200"
                  >Date Pickers</a>,
                  <a
                    href="https://github.com/stacksjs/file-manager"
                    class="text-blue-600 underline dark:text-blue-200"
                  >File Manager</a>,
                  <a
                    href="https://github.com/stacksjs/image"
                    class="text-blue-600 underline dark:text-blue-200"
                  >Images</a>,
                  <a
                    href="https://github.com/stacksjs/video"
                    class="text-blue-600 underline dark:text-blue-200"
                  >Videos</a>,
                  <a
                    href="https://github.com/stacksjs/audio"
                    class="text-blue-600 underline dark:text-blue-200"
                  >Audio</a>,
                  and
                  <a
                    href="https://github.com/stacksjs/web"
                    class="text-blue-600 underline dark:text-blue-200"
                  >Web</a>
                  libraries.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 flex justify-center sm:items-center sm:justify-between">
          <div class="text-center text-sm text-gray-500 sm:text-left">
            <div class="flex items-center">
              <i
                class="i-hugeicons-outline-heart h-5 w-5 text-gray-400 -mt-px"
                aria-hidden="true"
              />
              <svg
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                viewBox="0 0 24 24"
                class=""
              >
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>

              <a
                href="https://github.com/sponsors/chrisbbreuer"
                class="ml-1 text-blue-600 underline dark:text-blue-200"
              >
                Sponsor
              </a>
            </div>
          </div>

          <div class="ml-4 text-center text-sm text-gray-500 sm:ml-0 sm:text-right">
            Stacks Alpha (Bun v1.0.21)
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  body {
    /* reset browser styles */
    margin: 0;
  }
</style>
