<script setup lang="ts">
const { greeting = 'Welcome!' } = defineProps<{
  greeting: string
}>()

// eslint-disable-next-line no-console
console.log(`The greeting is ${greeting}.`)

onMounted(() => {
  // eslint-disable-next-line no-console
  console.log('HelloWorld component mounted.')
})
</script>

<template>
  <div class=":stx: antialiased font-sans">
    <div class=":stx: relative flex items-top justify-center min-h-screen bg-gray-50 dark:bg-gray-900 sm:items-center py-4 sm:pt-0">
      <div class=":stx: max-w-6xl mx-auto sm:px-6 lg:px-8">
        <div class=":stx: flex justify-center items-center pt-8 sm:justify-between sm:pt-0">
          <img
            src="../.github/art/logo.svg"
            class="h-16"
          >

          <Counter />
        </div>

        <div class=":stx: mt-8 bg-white dark:bg-gray-800 overflow-hidden shadow sm:rounded-lg">
          <div class=":stx: grid grid-cols-1 md:grid-cols-2">
            <div class=":stx: p-6">
              <div class=":stx: flex items-center">
                <i
                  class=":stx: i-heroicons-outline-book-open w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />

                <div class=":stx: ml-4 text-lg leading-7 font-semibold">
                  <a
                    href="https://stacks.ow3org.com/docs"
                    class=":stx: underline text-gray-900 dark:text-white"
                  >Documentation</a>
                </div>
              </div>

              <div class=":stx: ml-12">
                <div class=":stx: mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  Stacks has a wonderful, thorough documentation covering every aspect of the framework. Whether you are new to the framework or have previous experience with Stacks, we recommend reading all of the documentation from beginning to end.
                </div>
              </div>
            </div>

            <div class=":stx: p-6 border-t border-gray-200 dark:border-gray-700 md:border-t-0 md:border-l">
              <div class=":stx: flex items-center">
                <i
                  class=":stx: i-heroicons-outline-puzzle w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class=":stx: ml-4 text-lg leading-7 font-semibold">
                  <a
                    href="https://stacks.ow3.org/components"
                    class=":stx: underline text-gray-900 dark:text-white"
                  >Components</a>
                </div>
              </div>

              <div class=":stx: ml-12">
                <div class=":stx: mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  Stacks provides the most simplistic way to automatically build universal, framework agnostic (Web Components, Vue, React integrations, etc.) components—from one codebase! With built-in release & commit flows, it simplifies & automates the distribution process for you via npm.
                </div>
              </div>
            </div>

            <div class=":stx: p-6 border-t border-gray-200 dark:border-gray-700">
              <div class=":stx: flex items-center">
                <i
                  class=":stx: i-heroicons-outline-template w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class=":stx: ml-4 text-lg leading-7 font-semibold">
                  <a
                    href="https://stacks.ow3.org/pages"
                    class=":stx: underline text-gray-900 dark:text-white"
                  >Pages</a>
                </div>
              </div>

              <div class=":stx: ml-12">
                <div class=":stx: mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  Building on top of the “components,” you may easily reuse them to develop your “pages.” SSR & PWA support is built-in, as well as a deployable server. Get more done, more quickly. Vercel & Netlify are supported—and more!
                </div>
              </div>
            </div>

            <div class=":stx: p-6 border-t border-gray-200 dark:border-gray-700 md:border-l">
              <div class=":stx: flex items-center">
                <i
                  class=":stx: i-heroicons-outline-variable w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class=":stx: ml-4 text-lg leading-7 font-semibold text-gray-900 dark:text-white">
                  <a
                    href="https://stacks.ow3.org/functions"
                    class=":stx: underline text-gray-900 dark:text-white"
                  >Functions</a>
                </div>
              </div>

              <div class=":stx: ml-12">
                <div class=":stx: mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  Atomic FX development, at core, is a simple way to create composable functions. These “function libraries” may easily be distributed via npm or served as API endpoints. Because Stacks loves serverless technology, scalability is built-in. <i>Don’t sweat it, it’s simple!</i>
                </div>
              </div>
            </div>

            <div class=":stx: p-6 border-t border-gray-200 dark:border-gray-700">
              <div class=":stx: flex items-center">
                <i
                  class=":stx: i-heroicons-outline-terminal w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class=":stx: ml-4 text-lg leading-7 font-semibold">
                  <a
                    href="https://stacks.ow3.org/"
                    class=":stx: underline text-gray-900 dark:text-white"
                  >Modern Full Stack</a>
                </div>
              </div>

              <div class=":stx: ml-12">
                <div class=":stx: mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  The Stacks framework is a universally usable framework that specializes in building UIs & functions. Whether you are trying to build a highly reusable component library, SSR pages, composable function libraries, or complete APIs including a deployable web server—Stacks enables you to utilize modern & serverless Full Stack capabilities.
                </div>
              </div>
            </div>

            <div class=":stx: p-6 border-t border-gray-200 dark:border-gray-700 md:border-l">
              <div class=":stx: flex items-center">
                <i
                  class=":stx: i-heroicons-outline-globe w-8 h-8 text-gray-500"
                  aria-hidden="true"
                />
                <div class=":stx: ml-4 text-lg leading-7 font-semibold text-gray-900 dark:text-white">
                  Vibrant Ecosystem
                </div>
              </div>

              <div class=":stx: ml-12">
                <div class=":stx: mt-2 text-gray-600 dark:text-gray-400 text-sm leading-6">
                  Stacks’s robust ecosystem of first-party libraries, including headless/unstyled, fully accessible UI component libraries, designed to integrate beautifully with any tech stack of your choice.
                  <a
                    href="https://forge.Stacks.com"
                    class=":stx: underline"
                  >Tables</a>, <a
                    href="https://github.com/ow3org/date-picker"
                    class=":stx: underline"
                  >Date Picker</a>,
                  <a
                    href="https://github.com/ow3org/file-manager"
                    class=":stx: underline"
                  >File Manager</a>,
                  <a
                    href="https://github.com/ow3org/image"
                    class=":stx: underline"
                  >Images</a>,
                  <a
                    href="https://github.com/ow3org/video"
                    class=":stx: underline"
                  >Videos</a>,
                  <a
                    href="https://github.com/ow3org/audio"
                    class=":stx: underline"
                  >Audios</a>,
                  and
                  <a
                    href="https://github.com/ow3org/web3"
                    class=":stx: underline"
                  >Web3</a>
                  libraries, such as <a
                    href="https://github.com/ow3org/daos"
                    class=":stx: underline"
                  >DAO</a>, <a
                    href="https://github.com/ow3org/nfts"
                    class=":stx: underline"
                  >NFTs</a>, <a
                    href="https://github.com/ow3org/defi"
                    class=":stx: underline"
                  >DeFi</a>
                  stacks, and more—we got you covered.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class=":stx: flex justify-center mt-4 sm:items-center sm:justify-between">
          <div class=":stx: text-center text-sm text-gray-500 sm:text-left">
            <div class=":stx: flex items-center">
              <i
                class=":stx: -mt-px w-5 h-5 text-gray-400 i-heroicons-outline-heart"
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
                class=":stx: ml-1 underline"
              >
                Sponsor
              </a>
            </div>
          </div>

          <div class=":stx: ml-4 text-center text-sm text-gray-500 sm:text-right sm:ml-0">
            Stacks Pre-Alpha (Node v18.0)
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
