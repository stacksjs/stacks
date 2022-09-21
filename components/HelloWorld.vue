<script setup lang="ts">
// which properties does your component accept?
const { greeting = 'Welcome!' } = defineProps<{
  greeting: string
  showButtons: boolean
}>()

// easily use any of the lifecycle hooks without needing to import them
onMounted(() => {
  // eslint-disable-next-line no-console
  console.log('HelloWorld component mounted & the greeting is', greeting)
})
</script>

<template>
  <div class="antialiased font-sans">
    <div class="relative flex items-top justify-center min-h-screen bg-gray-50 dark:bg-gray-900 sm:items-center py-4 sm:pt-0">
      <div class="max-w-6xl mx-auto sm:px-6 lg:px-8">
        <div class="flex justify-center items-center pt-8 sm:justify-between sm:pt-0">
          <Logo />

          <div
            v-if="showButtons"
            class="flex items-end"
          >
            <Counter />

            <ToggleDark />
          </div>
        </div>

        <div class="mt-8 bg-white dark:bg-gray-800 overflow-hidden shadow sm:rounded-lg">
          <div class="grid grid-cols-1 md:grid-cols-2">
            <div class="p-6">
              <div class="flex items-center">
                <i
                  class="i-heroicons-outline-book-open w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />

                <div class="ml-4 text-lg leading-7 font-semibold">
                  <a
                    href="https://stacks.ow3org.com/docs"
                    class="underline text-gray-900 dark:text-white"
                  >
                    Documentation
                  </a>
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  Stacks will have (wip) a wonderful, thorough documentation covering every aspect of the framework. Whether you are new to the framework or have previous experience with Stacks, we recommend reading all of the documentation from beginning to end.
                </div>
              </div>
            </div>

            <div class="p-6 border-t border-gray-200 dark:border-gray-700 md:border-t-0 md:border-l">
              <div class="flex items-center">
                <i
                  class="i-heroicons-outline-puzzle w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class="ml-4 text-lg leading-7 font-semibold">
                  <a
                    href="https://stacks.ow3.org/components"
                    class="underline text-gray-900 dark:text-white"
                  >
                    Components
                  </a>
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  The easiest way to build component libraries and distribute them on npm. Stacks automatically imports all of your components & makes them available to you in your templates.
                  And it automatically builds framework agnostic (e.g. Web & Vue Components) component libraries out of those.
                </div>
              </div>
            </div>

            <div class="p-6 border-t border-gray-200 dark:border-gray-700">
              <div class="flex items-center">
                <i
                  class="i-heroicons-outline-template w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class="ml-4 text-lg leading-7 font-semibold">
                  <a
                    href="https://stacks.ow3.org/functions"
                    class="underline text-gray-900 dark:text-white"
                  >
                    Functions
                  </a>
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  Atomic FX development, at core, is a simple way to create composable functions. These “function libraries” may easily be distributed via npm or served as API endpoints. Because Stacks loves serverless technology, scalability is built-in. <i>Don’t sweat it, it’s simple!</i>
                </div>
              </div>
            </div>

            <div class="p-6 border-t border-gray-200 dark:border-gray-700 md:border-l">
              <div class="flex items-center">
                <i
                  class="i-heroicons-outline-variable w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class="ml-4 text-lg leading-7 font-semibold text-gray-900 dark:text-white">
                  <a
                    href="https://stacks.ow3.org/pages"
                    class="underline text-gray-900 dark:text-white"
                  >
                    Pages
                  </a>
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  Building on top of “components,” you may easily reuse them to develop your “pages.”
                  SSR & PWA support is built-in, as well as a deployable server. Get more done, more quickly.
                  Vercel & Netlify are supported, including many other cloud providers.
                </div>
              </div>
            </div>

            <div class="p-6 border-t border-gray-200 dark:border-gray-700">
              <div class="flex items-center">
                <i
                  class="i-heroicons-outline-terminal w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class="ml-4 text-lg leading-7 font-semibold">
                  <a
                    href="https://stacks.ow3.org/"
                    class="underline text-gray-900 dark:text-white"
                  >
                    Modern DX
                  </a>
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  Approachable artisan design; simplistic setup, maintenance & collaboration. Deep IDE integration,
                  auto-formatting, access to powerful utility APIs, modern git commit conventions, npm package releases, semver powered,
                  pretty changelog generations, PR dependency updates, documentation tooling, and more.
                  <i>A well-defined set of best practices & automations.</i>
                </div>
              </div>
            </div>

            <div class="p-6 border-t border-gray-200 dark:border-gray-700 md:border-l">
              <div class="flex items-center">
                <i
                  class="i-heroicons-outline-globe w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class="ml-4 text-lg leading-7 font-semibold text-gray-900 dark:text-white">
                  Vibrant Ecosystem
                </div>
              </div>

              <div class="ml-12">
                <div class="mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  Stacks’s robust ecosystem of first-party libraries, including headless/unstyled, fully accessible UI component libraries, designed to integrate beautifully with any tech stack of your choice.
                  <a
                    href="https://github.com/ow3org/table"
                    class="underline text-blue-600 dark:text-blue-200"
                  >Tables</a>, <a
                    href="https://github.com/ow3org/date-picker"
                    class="underline text-blue-600 dark:text-blue-200"
                  >Date Picker</a>,
                  <a
                    href="https://github.com/ow3org/file-manager"
                    class="underline text-blue-600 dark:text-blue-200"
                  >File Manager</a>,
                  <a
                    href="https://github.com/ow3org/image"
                    class="underline text-blue-600 dark:text-blue-200"
                  >Images</a>,
                  <a
                    href="https://github.com/ow3org/video"
                    class="underline text-blue-600 dark:text-blue-200"
                  >Videos</a>,
                  <a
                    href="https://github.com/ow3org/audio"
                    class="underline text-blue-600 dark:text-blue-200"
                  >Audios</a>,
                  and
                  <a
                    href="https://github.com/ow3org/web3"
                    class="underline text-blue-600 dark:text-blue-200"
                  >Web3</a>
                  libraries, such as <a
                    href="https://github.com/ow3org/daos"
                    class="underline text-blue-600 dark:text-blue-200"
                  >DAO</a>, <a
                    href="https://github.com/ow3org/nfts"
                    class="underline text-blue-600 dark:text-blue-200"
                  >NFTs</a>, <a
                    href="https://github.com/ow3org/defi"
                    class="underline text-blue-600 dark:text-blue-200"
                  >DeFi</a>
                  stacks, and more—we got you covered.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-center mt-4 sm:items-center sm:justify-between">
          <div class="text-center text-sm text-gray-500 sm:text-left">
            <div class="flex items-center">
              <i
                class="-mt-px w-5 h-5 text-gray-400 i-heroicons-outline-heart"
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
                class="ml-1 underline text-blue-600 dark:text-blue-200"
              >
                Sponsor
              </a>
            </div>
          </div>

          <div class="ml-4 text-center text-sm text-gray-500 sm:text-right sm:ml-0">
            Stacks Pre-Alpha (Node v18.8)
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
