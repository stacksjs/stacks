<script setup lang="ts">
const gitStore = useGitStore()
const github = useGithub()
const route = useRoute()

onMounted(async () => {
  await gitStore.fetchWorkflowAction(route.params.id)
})

useHead({
  title: `Deployments - ${route.params.id}`,
})

const flag = ref(false)

function getStatus(conclusion: string) {
  if (conclusion === 'success')
    return 'Ready'

  return 'Failed'
}
</script>

<template>
  <div v-if="gitStore.workflowRun" class="px-4 sm:px-6 lg:px-8 py-8">
    <div class="rounded-lg bg-white px-6 py-8 text-sm dark:bg-blue-gray-800">
      <div class="px-4 sm:px-0">
        <h3 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
          Latest Deployment
        </h3>
      </div>
      <div class="mt-6 border-t border-gray-100 dark:border-gray-600">
        <dl class="divide-y divide-gray-100 dark:divide-gray-600">
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
              Status
            </dt>
            <dd class="mt-1 text-sm leading-6 text-gray-700 flex items-center sm:col-span-2 sm:mt-0 dark:text-gray-200 dark:text-gray-200">
              <span> {{ getStatus(gitStore.workflowRun.conclusion) }} </span>
              <svg fill="none" class="text-green-500 w-5 h-5 ml-2" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </dd>
          </div>

          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
              Duration
            </dt>
            <dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0 dark:text-gray-200 dark:text-gray-200">
              {{ github.getActionRunDuration(gitStore.workflowRun.created_at, gitStore.workflowRun.updated_at) }}
            </dd>
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
              Domain
            </dt>
            <dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0 dark:text-gray-200 dark:text-gray-200">
              www.stacks.com
            </dd>
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
              Source
            </dt>
            <dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0 dark:text-gray-200 dark:text-gray-200">
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
                  v-if="gitStore.workflowRun.head_commit"
                  href="#"
                  class="hover:underline"
                >

                  <code class="text-xs">{{ gitStore.workflowRun.head_commit.id.slice(0, 10) }}</code>
                  <span class="pl-1">{{ gitStore.workflowRun.head_commit.message }}</span>
                </a>
              </div>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="rounded-lg mt-12   bg-white px-6 py-8 text-sm dark:bg-blue-gray-800">
      <h2 class="text-2xl font-bold leading-10 tracking-tight text-gray-900  dark:text-gray-100">
        Deployment Details
      </h2>
      <div>
        <ul
          role="list"
          class="border rounded-md divide-y divide-gray-200 dark:divide-gray-600 mt-8"
        >
          <li
            class="relative flex-col cursor-pointer"
            @click="flag = !flag"
          >
            <div class="flex justify-between px-4 py-5">
              <div class="flex gap-x-4">
                <div class="min-w-0 flex-auto">
                  <div class="text-sm flex items-center font-semibold leading-6 text-gray-900 dark:text-gray-100">
                    <div class="i-heroicons-chevron-right-20-solid h-6 w-6 flex-none text-gray-400" />

                    <span>
                      Building
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-x-4">
                <div
                  class="sm:flex sm:flex-col sm:items-end"
                >
                  <div class="i-heroicons-check-circle-20-solid text-green-500 w-6 h-6" />
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
                  <div class="text-sm flex items-center font-semibold leading-6 text-gray-900 dark:text-gray-100">
                    <div class="i-heroicons-chevron-right-20-solid h-6 w-6 flex-none text-gray-400" />
                    <span>
                      Deployment Summary
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-x-4">
                <div
                  class="sm:flex sm:flex-col sm:items-end"
                >
                  <div class="i-heroicons-check-circle-20-solid text-green-500 w-6 h-6" />
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
                  <div class="text-sm flex items-center font-semibold leading-6 text-gray-900 dark:text-gray-100">
                    <div class="i-heroicons-chevron-right-20-solid h-6 w-6 flex-none text-gray-400" />
                    <span>
                      Running Checks
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-x-4">
                <div
                  class=" sm:flex sm:flex-col sm:items-end"
                >
                  <div class="i-heroicons-x-circle-20-solid text-red-500 w-6 h-6" />
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
