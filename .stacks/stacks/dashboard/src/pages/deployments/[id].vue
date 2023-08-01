<script setup lang="ts">
import { ref } from 'vue'

const flag = ref(false)
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <div class="rounded-lg bg-white px-6 py-8 text-sm dark:bg-gray-800">
      <div class="px-4 sm:px-0">
        <h3 class="text-base font-semibold leading-7 text-gray-900">
          Latest Deployment
        </h3>
      </div>
      <div class="mt-6 border-t border-gray-100">
        <dl class="divide-y divide-gray-100">
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900">
              Status
            </dt>
            <dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
              Ready
            </dd>
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900">
              Environment
            </dt>
            <dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
              Production
            </dd>
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900">
              Duration
            </dt>
            <dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
              50s
            </dd>
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900">
              Domain
            </dt>
            <dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
              www.stacks.com
            </dd>
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900">
              Source
            </dt>
            <dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
              <div class="flex items-center">
                <svg
                  class="with-icon_icon__MHUeb"
                  data-testid="geist-icon"
                  fill="none"
                  height="24"
                  shape-rendering="geometricPrecision"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  width="24"
                  style="color: currentcolor; width: 16px; height: 16px;"
                ><path d="M6 3v12" /><circle
                  cx="18"
                  cy="6"
                  r="3"
                /><circle
                  cx="6"
                  cy="18"
                  r="3"
                /><path d="M18 9a9 9 0 01-9 9" /></svg>

                <a
                  href="#"
                  class="hover:underline"
                ><code class="pl-1 text-xs">main</code></a>
              </div>
              <div class="flex items-center">
                <svg
                  class="with-icon_icon__MHUeb"
                  data-testid="geist-icon"
                  fill="none"
                  height="24"
                  shape-rendering="geometricPrecision"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  width="24"
                  style="color: currentcolor; width: 16px; height: 16px;"
                ><circle
                  cx="12"
                  cy="12"
                  r="4"
                /><path d="M1.05 12H7" /><path d="M17.01 12h5.95" /></svg>

                <a
                  href="#"
                  class="hover:underline"
                >

                  <code class="text-xs">b0f6755</code>
                  <span class="pl-1">chore: readme</span>
                </a>
              </div>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="rounded-lg mt-12   bg-white px-6 py-8 text-sm dark:bg-gray-800">
      <h2 class="text-2xl font-bold leading-10 tracking-tight text-gray-900">
        Deployment Details
      </h2>
      <div>
        <ul
          role="list"
          class="border rounded-md divide-y divide-gray-200 mt-8"
        >
          <li
            class="relative flex-col cursor-pointer"
            @click="flag = !flag"
          >
            <div class="flex justify-between px-4 py-5">
              <div class="flex gap-x-4">
                <div class="min-w-0 flex-auto">
                  <p class="text-sm flex items-center font-semibold leading-6 text-gray-900">
                    <svg
                      class="h-6 w-6 flex-none text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <span>
                      Building
                    </span>
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-x-4">
                <div
                  class="sm:flex sm:flex-col sm:items-end"
                >
                  <svg
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    class="h-6 w-6 text-green-500"
                  >
                    <path
                      clip-rule="evenodd"
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div
              v-if="flag"
              class="border-t"
            >
              <pre
                v-highlightjs
                class="-mt-5 -mb-10"
              >
                <code class="bash">
  Running build in Cleveland, USA (East) – cle1
  Cloning github.com/chrisbbreuer/chrisbbreuer (Branch: main, Commit: b0f6755)
  Previous build cache not available
  Cloning completed: 529.499ms
  Running "vercel build"
  Vercel CLI 28.18.5
  Installing dependencies...
  added 770 packages in 12s
  228 packages are looking for funding
  run `npm fund` for details
  Detected Next.js version: 13.0.2
  Detected `package-lock.json` generated by npm 7+...
  Running "npm run build"
                </code>
              </pre>
            </div>
          </li>
          <li
            class="relative flex-col cursor-pointer"
            @click="flag = !flag"
          >
            <div class="flex justify-between px-4 py-5">
              <div class="flex gap-x-4">
                <div class="min-w-0 flex-auto">
                  <p class="text-sm flex items-center font-semibold leading-6 text-gray-900">
                    <svg
                      class="h-6 w-6 flex-none text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <span>
                      Deployment Summary
                    </span>
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-x-4">
                <div
                  class="sm:flex sm:flex-col sm:items-end"
                >
                  <svg
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    class="h-6 w-6 text-green-500"
                  >
                    <path
                      clip-rule="evenodd"
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div
              v-if="flag"
              class="border-t"
            >
              <pre
                v-highlightjs
                class="-mt-5 -mb-10"
              >
                <code class="bash">
  Running build in Cleveland, USA (East) – cle1
  Cloning github.com/chrisbbreuer/chrisbbreuer (Branch: main, Commit: b0f6755)
  Previous build cache not available
  Cloning completed: 529.499ms
  Running "vercel build"
  Vercel CLI 28.18.5
  Installing dependencies...
  added 770 packages in 12s
  228 packages are looking for funding
  run `npm fund` for details
  Detected Next.js version: 13.0.2
  Detected `package-lock.json` generated by npm 7+...
  Running "npm run build"
                </code>
              </pre>
            </div>
          </li>
          <li
            class="relative flex-col cursor-pointer"
            @click="flag = !flag"
          >
            <div class="flex justify-between px-4 py-5">
              <div class="flex gap-x-4">
                <div class="min-w-0 flex-auto">
                  <p class="text-sm flex items-center font-semibold leading-6 text-gray-900">
                    <svg
                      class="h-6 w-6 flex-none text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <span>
                      Running Checks
                    </span>
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-x-4">
                <div
                  class=" sm:flex sm:flex-col sm:items-end"
                >
                  <svg
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    class="text-red-500 w-6 h-6"
                  >
                    <path
                      clip-rule="evenodd"
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div
              v-if="flag"
              class="border-t"
            >
              <pre
                v-highlightjs
                class="-mt-5 -mb-10"
              >
                <code class="bash">
  Running build in Cleveland, USA (East) – cle1
  Cloning github.com/chrisbbreuer/chrisbbreuer (Branch: main, Commit: b0f6755)
  Previous build cache not available
  Cloning completed: 529.499ms
  Running "vercel build"
  Vercel CLI 28.18.5
  Installing dependencies...
  added 770 packages in 12s
  228 packages are looking for funding
  run `npm fund` for details
  Detected Next.js version: 13.0.2
  Detected `package-lock.json` generated by npm 7+...
  Running "npm run build"
                </code>
              </pre>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
