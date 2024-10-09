<script lang="ts" setup>
useHead({
  title: 'Dashboard - Home',
})
</script>

<template>
  <main>
    <div class="relative isolate overflow-hidden">
      <!-- Stats -->
      <div class="border-b border-b-gray-900/10 lg:border-t lg:border-t-gray-900/5">
        <dl class="grid grid-cols-1 mx-auto lg:grid-cols-4 sm:grid-cols-2 lg:px-2 xl:px-0">
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-gray-900/5 px-4 py-6 lg:border-t-0 sm:px-6 xl:px-8">
            <dt class="text-sm text-gray-500 font-medium leading-6 dark:text-gray-300">
              Total Users
            </dt>

            <dd class="w-full flex-none text-xl text-gray-900 font-medium leading-10 tracking-tight dark:text-gray-100">
              12,345
            </dd>
          </div>

          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-gray-900/5 px-4 py-6 lg:border-l lg:border-t-0 sm:px-6 xl:px-8">
            <dt class="text-sm text-gray-500 font-medium leading-6 dark:text-gray-300">
              Total Deployments
            </dt>

            <dd class="w-full flex-none text-xl text-gray-900 font-medium leading-10 tracking-tight dark:text-gray-100">
              # 206
            </dd>
          </div>

          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-gray-900/5 px-4 py-6 lg:border-t-0 sm:border-l sm:px-6 xl:px-8">
            <dt class="text-sm text-gray-500 font-medium leading-6 dark:text-gray-300">
              Total Downloads
            </dt>

            <dd class="w-full flex-none text-xl text-gray-900 font-medium leading-10 tracking-tight dark:text-gray-100">
              345,678
            </dd>
          </div>

          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-gray-900/5 px-4 py-6 lg:border-t-0 sm:border-l sm:px-6 xl:px-8">
            <dt class="text-sm text-gray-500 font-medium leading-6 dark:text-gray-300">
              Subscribers
            </dt>

            <dd class="w-full flex-none text-xl text-gray-900 font-medium leading-10 tracking-tight dark:text-gray-100">
              45,678
            </dd>
          </div>
        </dl>
      </div>

      <div
        class="absolute left-0 top-full mt-96 origin-top-left translate-y-40 transform-gpu opacity-20 blur-3xl sm:left-1/2 -z-10 sm:translate-y-0 -rotate-90 sm:rotate-0 sm:transform-gpu sm:opacity-50 sm:-ml-96 sm:-mt-10"
        aria-hidden="true"
      >
        <div
          class="aspect-[1154/678] w-[72.125rem] from-[#FF80B5] to-[#9089FC] bg-gradient-to-br"
          style="clip-path: polygon(100% 38.5%, 82.6% 100%, 60.2% 37.7%, 52.4% 32.1%, 47.5% 41.8%, 45.2% 65.6%, 27.5% 23.4%, 0.1% 35.3%, 17.9% 0%, 27.7% 23.4%, 76.2% 2.5%, 74.2% 56%, 100% 38.5%)"
        />
      </div>
    </div>

    <div class="px-12">
      <div class="mx-auto max-w-7xl pt-12">
        <div class="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
          <div class="flex items-center justify-between">
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              Models
            </h2>
          </div>

          <ul
            role="list"
            class="grid grid-cols-1 mt-6 gap-x-6 gap-y-8 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-8"
          >
            <router-link to="/models/users">
              <li class="overflow-hidden border border-gray-200 rounded-xl dark:border-gray-600">
                <div class="flex transform items-center gap-x-4 border-b border-gray-900/5 bg-gray-50 p-6 duration-250 ease-in-out dark:bg-blue-gray-700 hover:bg-white">
                  <div class="h-12 w-12 flex flex-none items-center justify-center rounded-lg bg-white object-cover ring-1 ring-gray-900/10">
                    U
                  </div>

                  <div class="text-sm text-gray-900 font-medium leading-6 dark:text-gray-100">
                    Users
                  </div>

                  <div class="text-sm text-gray-900 font-medium leading-6 dark:text-gray-100">
                    <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 font-medium ring-1 ring-slate-600/20 ring-inset">123.5k</span>
                  </div>
                </div>
              </li>
            </router-link>

            <router-link to="/models/teams">
              <li class="overflow-hidden border border-gray-200 rounded-xl dark:border-gray-600">
                <div class="flex transform items-center gap-x-4 border-b border-gray-900/5 bg-gray-50 p-6 duration-250 ease-in-out dark:bg-blue-gray-700 hover:bg-white">
                  <div class="h-12 w-12 flex flex-none items-center justify-center rounded-lg bg-white object-cover ring-1 ring-gray-900/10">
                    T
                  </div>

                  <div class="text-sm text-gray-900 font-medium leading-6 dark:text-gray-100">
                    Teams
                  </div>

                  <div class="text-sm text-gray-900 font-medium leading-6 dark:text-gray-100">
                    <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 font-medium ring-1 ring-slate-600/20 ring-inset">912</span>
                  </div>
                </div>
              </li>
            </router-link>

            <router-link to="/models/subscribers">
              <li class="overflow-hidden border border-gray-200 rounded-xl dark:border-gray-600">
                <div class="flex transform items-center gap-x-4 border-b border-gray-900/5 bg-gray-50 p-6 duration-250 ease-in-out dark:bg-blue-gray-700 hover:bg-white">
                  <div class="h-12 w-12 flex flex-none items-center justify-center rounded-lg bg-white object-cover ring-1 ring-gray-900/10">
                    S
                  </div>

                  <div class="text-sm text-gray-900 font-medium leading-6 dark:text-gray-100">
                    Subscribers
                  </div>

                  <div class="text-sm text-gray-900 font-medium leading-6 dark:text-gray-100">
                    <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 font-medium ring-1 ring-slate-600/20 ring-inset">4.6k</span>
                  </div>
                </div>
              </li>
            </router-link>
          </ul>
        </div>
      </div>

      <div class="mx-auto max-w-7xl flex flex-col py-16 lg:flex-row">
        <!-- Recent Deployments -->
        <div class="mx-auto flex-auto pr-24 lg:flex-1">
          <div>
            <h2 class="mx-auto max-w-2xl text-base text-gray-900 font-semibold leading-6 lg:mx-0 lg:max-w-none dark:text-gray-100 dark:text-gray-100">
              Recent Deployments
            </h2>
          </div>
          <ul
            role="list"
            class="pt-2 divide-y divide-gray-200 dark:divide-gray-600"
          >
            <li class="relative flex items-center py-4 space-x-4">
              <div class="min-w-0 flex-auto">
                <div class="flex items-center gap-x-3">
                  <div class="flex-none rounded-full bg-green-400/10 p-1 text-green-400">
                    <div class="h-2 w-2 animate-pulse rounded-full bg-current" />
                  </div>
                  <h2 class="min-w-0 text-sm text-gray-900 font-semibold leading-6 dark:text-gray-100">
                    <a
                      href="#"
                      class="flex gap-x-2"
                    >
                      <span class="truncate">stacksjs</span>
                      <span class="text-gray-400">/</span>
                      <span class="whitespace-nowrap">stacks</span>
                      <span class="absolute inset-0" />
                    </a>
                  </h2>
                </div>
                <div class="mt-3 flex items-center gap-x-2.5 text-xs text-gray-400 leading-5">
                  <p class="truncate">
                    Deploys from GitHub
                  </p>
                  <svg
                    viewBox="0 0 2 2"
                    class="h-0.5 w-0.5 flex-none fill-gray-300"
                  >
                    <circle
                      cx="1"
                      cy="1"
                      r="1"
                    />
                  </svg>
                  <p class="whitespace-nowrap">
                    Initiated 1m 32s ago
                  </p>
                </div>
              </div>
              <div class="flex-none rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-600 font-medium ring-1 ring-blue-600/30 ring-inset dark:bg-blue-gray-600 dark:text-blue-300">
                Production
              </div>

              <div class="i-heroicons-chevron-right-20-solid h-5 w-5 flex-none text-gray-400" />
            </li>

            <li class="relative flex items-center py-4 space-x-4">
              <div class="min-w-0 flex-auto">
                <div class="flex items-center gap-x-3">
                  <div class="flex-none rounded-full bg-red-300/10 p-1 text-red-500">
                    <div class="h-2 w-2 rounded-full bg-current" />
                  </div>
                  <h2 class="min-w-0 text-sm text-gray-900 font-semibold leading-6 dark:text-gray-100">
                    <a
                      href="#"
                      class="flex gap-x-2"
                    >
                      <span class="truncate">stacksjs</span>
                      <span class="text-gray-400">/</span>
                      <span class="whitespace-nowrap">stacks</span>
                      <span class="absolute inset-0" />
                    </a>
                  </h2>
                </div>
                <div class="mt-3 flex items-center gap-x-2.5 text-xs text-gray-400 leading-5">
                  <p class="truncate">
                    Deployed from GitHub
                  </p>
                  <svg
                    viewBox="0 0 2 2"
                    class="h-0.5 w-0.5 flex-none fill-gray-300"
                  >
                    <circle
                      cx="1"
                      cy="1"
                      r="1"
                    />
                  </svg>
                  <p class="whitespace-nowrap">
                    Failed 9m ago
                  </p>
                </div>
              </div>
              <div class="flex-none rounded-full bg-gray-400/10 px-2 py-1 text-xs text-gray-600 font-medium ring-1 ring-gray-400/20 ring-inset dark:bg-blue-gray-600 dark:text-gray-300">
                Staging
              </div>

              <div class="i-heroicons-chevron-right-20-solid h-5 w-5 flex-none text-gray-400" />
            </li>

            <li class="relative flex items-center py-4 space-x-4">
              <div class="min-w-0 flex-auto">
                <div class="flex items-center gap-x-3">
                  <div class="flex-none rounded-full bg-gray-100/10 p-1 text-gray-500">
                    <div class="h-2 w-2 rounded-full bg-current" />
                  </div>
                  <h2 class="min-w-0 text-sm text-gray-900 font-semibold leading-6 dark:text-gray-100">
                    <a
                      href="#"
                      class="flex gap-x-2"
                    >
                      <span class="truncate">stacksjs</span>
                      <span class="text-gray-400">/</span>
                      <span class="whitespace-nowrap">ow3.org</span>
                      <span class="absolute inset-0" />
                    </a>
                  </h2>
                </div>
                <div class="mt-3 flex items-center gap-x-2.5 text-xs text-gray-400 leading-5">
                  <p class="truncate">
                    Deploys from GitHub
                  </p>
                  <svg
                    viewBox="0 0 2 2"
                    class="h-0.5 w-0.5 flex-none fill-gray-300"
                  >
                    <circle
                      cx="1"
                      cy="1"
                      r="1"
                    />
                  </svg>
                  <p class="whitespace-nowrap">
                    Deployed 3h ago
                  </p>
                </div>
              </div>
              <div class="flex-none rounded-full bg-gray-500/10 px-2 py-1 text-xs text-gray-600 font-medium ring-1 ring-gray-600/20 ring-inset dark:bg-blue-gray-600 dark:text-gray-300">
                Development
              </div>

              <div class="i-heroicons-chevron-right-20-solid h-5 w-5 flex-none text-gray-400" />
            </li>
          </ul>
        </div>

        <!-- Recent Commits -->
        <div class="mx-auto flex-auto lg:flex-1">
          <div>
            <h2 class="mx-auto max-w-2xl text-base text-gray-900 font-semibold leading-6 lg:mx-0 lg:max-w-none dark:text-gray-100 dark:text-gray-100">
              Recent Commits
            </h2>
          </div>
          <ul
            role="list"
            class="pt-2 divide-y divide-white/5"
          >
            <li class="py-4">
              <div class="flex items-center gap-x-3">
                <img
                  src="https://avatars.githubusercontent.com/u/6228425"
                  alt=""
                  class="h-6 w-6 flex-none rounded-full bg-gray-200"
                >
                <h3 class="flex-auto truncate text-sm text-gray-900 font-semibold leading-6 dark:text-gray-100">
                  Chris Breuer
                </h3>
                <time
                  datetime="2023-01-23T11:00"
                  class="flex-none text-xs text-gray-600 dark:text-gray-300"
                >1h</time>
              </div>
              <p class="mt-3 truncate text-sm text-gray-500">
                Pushed to <span class="text-gray-400">stacks</span> (<span class="text-gray-400 font-mono">2d89f0c8</span> on <span class="text-gray-400">main</span>)
              </p>
            </li>
            <li class="py-4">
              <div class="flex items-center gap-x-3">
                <img
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=facearea&amp;facepad=2&amp;w=256&amp;h=256&amp;q=80"
                  alt=""
                  class="h-6 w-6 flex-none rounded-full bg-gray-800"
                >
                <h3 class="flex-auto truncate text-sm text-gray-900 font-semibold leading-6 dark:text-gray-100">
                  Zoltan
                </h3>
                <time
                  datetime="2023-01-23T09:00"
                  class="flex-none text-xs text-gray-600 dark:text-gray-300"
                >3h</time>
              </div>
              <p class="mt-3 truncate text-sm text-gray-500">
                Pushed to <span class="text-gray-400">stacks</span> (<span class="text-gray-400 font-mono">249df660</span> on <span class="text-gray-400">main</span>)
              </p>
            </li>
            <li class="py-4">
              <div class="flex items-center gap-x-3">
                <img
                  src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=facearea&amp;facepad=2&amp;w=256&amp;h=256&amp;q=80"
                  alt=""
                  class="h-6 w-6 flex-none rounded-full bg-gray-800"
                >
                <h3 class="flex-auto truncate text-sm text-gray-900 font-semibold leading-6 dark:text-gray-100">
                  Freddy
                </h3>
                <time
                  datetime="2023-01-23T00:00"
                  class="flex-none text-xs text-gray-600 dark:text-gray-300"
                >12h</time>
              </div>
              <p class="mt-3 truncate text-sm text-gray-500">
                Pushed to <span class="text-gray-400">stacks</span> (<span class="text-gray-400 font-mono">11464223</span> on <span class="text-gray-400">main</span>)
              </p>
            </li>
          </ul>
        </div>
      </div>

      <!-- Other Stacks -->
      <div class="mx-auto max-w-7xl">
        <div class="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
          <div class="flex items-center justify-between">
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              Other Projects
            </h2>
          </div>
          <ul
            role="list"
            class="grid grid-cols-1 mt-6 gap-x-6 gap-y-8 lg:grid-cols-3 xl:gap-x-8"
          >
            <li class="overflow-hidden border border-gray-200 rounded-xl dark:border-gray-600">
              <div class="flex items-center gap-x-4 border-b border-gray-900/5 bg-gray-50 p-6 dark:bg-blue-gray-700">
                <img
                  src="https://tailwindui.com/img/logos/48x48/tuple.svg"
                  alt="Tuple"
                  class="h-12 w-12 flex-none rounded-lg bg-white object-cover ring-1 ring-gray-900/10"
                >
                <div class="text-sm text-gray-900 font-medium leading-6 dark:text-gray-100">
                  X App
                </div>

                <div class="text-sm text-gray-900 font-medium leading-6 dark:text-gray-100">
                  <span class="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs text-green-700 font-medium ring-1 ring-green-600/20 ring-inset">Active</span>
                </div>

                <div class="relative ml-auto">
                  <button
                    id="options-menu-0-button"
                    type="button"
                    class="block p-2.5 text-gray-400 -m-2.5 hover:text-blue-gray-500"
                    aria-expanded="false"
                    aria-haspopup="true"
                  >
                    <span class="sr-only">Open options</span>

                    <div class="i-heroicons-ellipsis-horizontal h-5 w-5" />
                  </button>

                  <!--
                  Dropdown menu, show/hide based on menu state.

                  Entering: "transition ease-out duration-100"
                    From: "transform opacity-0 scale-95"
                    To: "transform opacity-100 scale-100"
                  Leaving: "transition ease-in duration-75"
                    From: "transform opacity-100 scale-100"
                    To: "transform opacity-0 scale-95"
                -->
                  <div
                    class="absolute right-0 z-10 mt-0.5 hidden w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="options-menu-0-button"
                    tabindex="-1"
                  >
                    <!-- Active: "bg-gray-50", Not Active: "" -->
                    <a
                      id="options-menu-0-item-0"
                      href="#"
                      class="block px-3 py-1 text-sm text-gray-900 leading-6"
                      role="menuitem"
                      tabindex="-1"
                    >View<span class="sr-only">, Tuple</span></a>
                    <a
                      id="options-menu-0-item-1"
                      href="#"
                      class="block px-3 py-1 text-sm text-gray-900 leading-6"
                      role="menuitem"
                      tabindex="-1"
                    >Edit<span class="sr-only">, Tuple</span></a>
                  </div>
                </div>
              </div>
            </li>
            <li class="overflow-hidden border border-gray-200 rounded-xl dark:border-gray-600">
              <div class="flex items-center gap-x-4 border-b border-gray-900/5 bg-gray-50 p-6 dark:bg-blue-gray-700">
                <img
                  src="https://tailwindui.com/img/logos/48x48/savvycal.svg"
                  alt="SavvyCal"
                  class="h-12 w-12 flex-none rounded-lg bg-white object-cover ring-1 ring-gray-900/10"
                >
                <div class="text-sm text-gray-900 font-medium leading-6 dark:text-gray-100">
                  Y App
                </div>
                <div class="relative ml-auto">
                  <button
                    id="options-menu-1-button"
                    type="button"
                    class="block p-2.5 text-gray-400 -m-2.5 hover:text-blue-gray-500"
                    aria-expanded="false"
                    aria-haspopup="true"
                  >
                    <span class="sr-only">Open options</span>
                    <div class="i-heroicons-ellipsis-horizontal h-5 w-5" />
                  </button>

                  <!--
                  Dropdown menu, show/hide based on menu state.

                  Entering: "transition ease-out duration-100"
                    From: "transform opacity-0 scale-95"
                    To: "transform opacity-100 scale-100"
                  Leaving: "transition ease-in duration-75"
                    From: "transform opacity-100 scale-100"
                    To: "transform opacity-0 scale-95"
                -->
                  <div
                    class="absolute right-0 z-10 mt-0.5 hidden w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="options-menu-1-button"
                    tabindex="-1"
                  >
                    <!-- Active: "bg-gray-50", Not Active: "" -->
                    <a
                      id="options-menu-1-item-0"
                      href="#"
                      class="block px-3 py-1 text-sm text-gray-900 leading-6"
                      role="menuitem"
                      tabindex="-1"
                    >View<span class="sr-only">, SavvyCal</span></a>
                    <a
                      id="options-menu-1-item-1"
                      href="#"
                      class="block px-3 py-1 text-sm text-gray-900 leading-6"
                      role="menuitem"
                      tabindex="-1"
                    >Edit<span class="sr-only">, SavvyCal</span></a>
                  </div>
                </div>
              </div>
            </li>
            <li class="overflow-hidden border border-gray-200 rounded-xl dark:border-gray-600">
              <div class="flex items-center gap-x-4 border-b border-gray-900/5 bg-gray-50 p-6 dark:bg-blue-gray-700">
                <img
                  src="https://tailwindui.com/img/logos/48x48/reform.svg"
                  alt="Reform"
                  class="h-12 w-12 flex-none rounded-lg bg-white object-cover ring-1 ring-gray-900/10"
                >
                <div class="text-sm text-gray-900 font-medium leading-6 dark:text-gray-100">
                  Z App
                </div>
                <div class="relative ml-auto">
                  <button
                    id="options-menu-2-button"
                    type="button"
                    class="block p-2.5 text-gray-400 -m-2.5 hover:text-blue-gray-500"
                    aria-expanded="false"
                    aria-haspopup="true"
                  >
                    <span class="sr-only">Open options</span>
                    <div class="i-heroicons-ellipsis-horizontal h-5 w-5" />
                  </button>

                  <!--
                  Dropdown menu, show/hide based on menu state.

                  Entering: "transition ease-out duration-100"
                    From: "transform opacity-0 scale-95"
                    To: "transform opacity-100 scale-100"
                  Leaving: "transition ease-in duration-75"
                    From: "transform opacity-100 scale-100"
                    To: "transform opacity-0 scale-95"
                -->
                  <div
                    class="absolute right-0 z-10 mt-0.5 hidden w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="options-menu-2-button"
                    tabindex="-1"
                  >
                    <!-- Active: "bg-gray-50", Not Active: "" -->
                    <a
                      id="options-menu-2-item-0"
                      href="#"
                      class="block px-3 py-1 text-sm text-gray-900 leading-6"
                      role="menuitem"
                      tabindex="-1"
                    >View<span class="sr-only">, Reform</span></a>
                    <a
                      id="options-menu-2-item-1"
                      href="#"
                      class="block px-3 py-1 text-sm text-gray-900 leading-6"
                      role="menuitem"
                      tabindex="-1"
                    >Edit<span class="sr-only">, Reform</span></a>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <Alert
      v-if="false"
      type="warning"
      title="Warning!"
      description="Are you sure you want to delete this event?"
      confirmation-text="Confirm"
      abort-text="Cancel"
    />

    <BaseModal
      v-if="false"
    >
      <template #modal-body>
        <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
          <button
            type="button"
            class="rounded-md text-gray-400 dark:text-gray-200 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 dark-hover:text-gray-100"
          >
            <span class="sr-only">Close</span>
            <!-- Heroicon name: outline/x-mark -->
            <svg
              class="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="sm:flex sm:items-start">
          <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
            <h3
              id="modal-title"
              class="text-lg text-gray-900 font-medium leading-6 dark:text-gray-100"
            >
              Search Engine Instance
            </h3>
            <div class="mt-2">
              <p
                id="subtitle"
                class="mb-2 text-xs text-green-800 dark:text-green-600"
              >
                baseUrl
              </p>

              <a
                id="title"
                target="_new"
                href="#"
                class="text-lg text-blue-800 dark:text-blue-400"
              >

                test title
              </a>

              <p
                id="title"
                class="mt-2 text-sm text-gray-800 dark:text-gray-200"
              >
                test desc
              </p>
            </div>
          </div>
        </div>
      </template>

      <template #modal-actions>
        <button
          type="button"
          class="secondary-button"
        >
          Close
        </button>
      </template>
    </BaseModal>
  </main>
</template>
