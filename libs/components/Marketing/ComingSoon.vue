<script setup>
import { ref } from 'vue'
import { Fetch } from '@stacksjs/api'

// Reactive state for the email input
const email = ref('')

// Method to handle email submission
function submitEmail() {
  console.log(fetch)
  console.log(email.value) // Log the email to the console

  email.value = '' // Clear the input field after submission
}
</script>

<template>
  <div class="relative isolate overflow-hidden bg-white">
    <svg class="absolute inset-0 -z-10 h-full w-full stroke-gray-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]" aria-hidden="true">
      <defs>
        <pattern id="0787a7c5-978c-4f66-83c7-11c213f99cb7" width="200" height="200" x="50%" y="-1" patternUnits="userSpaceOnUse">
          <path d="M.5 200V.5H200" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" stroke-width="0" fill="url(#0787a7c5-978c-4f66-83c7-11c213f99cb7)" />
    </svg>

    <div class="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:px-8 lg:py-40">
      <div class="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:flex-shrink-0 lg:pt-8">
        <!-- <img class="h-11" src="https://tailwindui.com/img/logos/mark.svg?color=blue&amp;shade=600" alt="Your Company"> -->
        <Logo class="h-11 w-auto" />

        <div class="mt-24 sm:mt-32 lg:mt-16">
          <a href="#" class="inline-flex space-x-6">
            <span class="rounded-full bg-blue-600/10 px-3 py-1 text-sm font-semibold leading-6 text-blue-600 ring-1 ring-inset ring-blue-600/10">Coming soon</span>
            <span class="inline-flex items-center space-x-2 text-sm font-medium leading-6 text-gray-600">
              <!-- <span>Just shipped v1.0</span> -->
              <ChevronRightIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
            </span>
          </a>
        </div>

        <h1 class="mt-10 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Develop modern apps, clouds & libraries.
          Faster.
        </h1>

        <p class="mt-6 text-lg leading-8 text-gray-600">
          Stacks is a type-safe full-stack framework for Web Artisans. Rapid development, for the best full-stack teams, and individuals.
        </p>

        <p class="mt-3 leading-8 text-gray-600 italic">
          Enter your email below to stay in the loop.
        </p>

        <div class="mt-10 flex items-center gap-x-6">
          <!-- <a href="#" class="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Get started</a> -->
          <div>
            <div class="flex rounded-md shadow-sm">
              <div class="relative flex flex-grow items-stretch focus-within:z-10">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <div class="i-heroicons-envelope h-5 w-5 text-gray-400" />
                </div>

                <input id="email" v-model="email" type="email" name="email" class="block w-full rounded-none rounded-l-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="enter-your@email.com">
              </div>

              <button type="button" class="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50" @click="submitEmail">
                Submit
              </button>
            </div>
          </div>

          <a href="https://stacksjs.org/docs" class="text-sm font-semibold leading-6 text-gray-900">Learn more <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <div class="mx-auto mt-16 flex max-w-2xl sm:mt-24 lg:ml-10 lg:mr-0 lg:mt-0 lg:max-w-none lg:flex-none xl:ml-32">
        <div class="max-w-3xl flex-none sm:max-w-5xl lg:max-w-none">
          <div class="-m-2 rounded-xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:-m-4 lg:rounded-2xl lg:p-4">
            <img src="https://tailwindui.com/img/component-images/project-app-screenshot.png" alt="App screenshot" width="2432" height="1442" class="w-[76rem] rounded-md shadow-2xl ring-1 ring-gray-900/10">
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
