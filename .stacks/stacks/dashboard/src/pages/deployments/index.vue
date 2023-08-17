<script lang="ts" setup>
import AppButton from '../../components/Buttons/AppButton.vue'
</script>

<template>
  <div class="px-4 mb-4 sm:px-6 lg:px-8 mt-8">
    <div>
      <div class="flex items-center justify-between">
        <div class="flex items-start text-xl font-medium text-gray-900 sm:mx-none sm:mr-auto dark:text-gray-100">
          <h1 class="font-semibold text-2xl dark:text-gray-200 text-gray-700">
            stacks.dev
          </h1>
        </div>
        <div class="flex items-center">
          <AppButton passed-class="primary-button" loading-text="Deploying..." button-text="Deploy">

            <template #icon>
              <div class="i-heroicons-cloud-arrow-up w-6 h-6 mr-2"></div>
            </template>
          </AppButton>
        </div>
      </div>
    </div>
  </div>

  <main>
    <header class="flex items-center justify-between border-b border-gray-300 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 dark:border-gray-600">
      <h1 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
        Deployments
      </h1>

      <!-- Sort dropdown -->
      <div
        x-data="Components.menu({ open: false })"
        x-init="init()"
        class="relative"
      >
        <!-- <div
        x-data="Components.menu({ open: false })"
        x-init="init()"
        class="relative"
        @keydown.escape.stop="open = false; focusButton()"
        @click.away="onClickAway($event)"
      > -->
        <button
          id="sort-menu-button"
          type="button"
          class="flex items-center gap-x-1 text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
          x-ref="button"
          aria-expanded="false"
          aria-haspopup="true"
          x-bind:aria-expanded="open.toString()"
        >
          <!-- <button
          id="sort-menu-button"
          type="button"
          class="flex items-center gap-x-1 text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
          x-ref="button"
          aria-expanded="false"
          aria-haspopup="true"
          x-bind:aria-expanded="open.toString()"
          @click="onButtonClick()"
          @keyup.space.prevent="onButtonEnter()"
          @keydown.enter.prevent="onButtonEnter()"
          @keydown.arrow-up.prevent="onArrowUp()"
          @keydown.arrow-down.prevent="onArrowDown()"
        > -->
          Sort by

          <div class="i-heroicons-chevron-up-down h-5 w-5 text-gray-500" />
        </button>

        <!-- <div
          x-show="open"
          x-transition:enter="transition ease-out duration-100"
          x-transition:enter-start="transform opacity-0 scale-95"
          x-transition:enter-end="transform opacity-100 scale-100"
          x-transition:leave="transition ease-in duration-75"
          x-transition:leave-start="transform opacity-100 scale-100"
          x-transition:leave-end="transform opacity-0 scale-95"
          class="absolute right-0 z-10 mt-2.5 w-40 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none"
          x-ref="menu-items"
          x-description="Dropdown menu, show/hide based on menu state."
          x-bind:aria-activedescendant="activeDescendant"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="sort-menu-button"
          tabindex="-1"
          style="display: none;"
          @keydown.arrow-up.prevent="onArrowUp()"
          @keydown.arrow-down.prevent="onArrowDown()"
          @keydown.tab="open = false"
          @keydown.enter.prevent="open = false; focusButton()"
          @keyup.space.prevent="open = false; focusButton()"
        > -->
        <div
          x-show="open"
          x-transition:enter="transition ease-out duration-100"
          x-transition:enter-start="transform opacity-0 scale-95"
          x-transition:enter-end="transform opacity-100 scale-100"
          x-transition:leave="transition ease-in duration-75"
          x-transition:leave-start="transform opacity-100 scale-100"
          x-transition:leave-end="transform opacity-0 scale-95"
          class="absolute right-0 z-10 mt-2.5 w-40 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none"
          x-ref="menu-items"
          x-description="Dropdown menu, show/hide based on menu state."
          x-bind:aria-activedescendant="activeDescendant"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="sort-menu-button"
          tabindex="-1"
          style="display: none;"
        >
          <a
            id="sort-menu-item-0"
            href="#"
            class="block px-3 py-1 text-sm leading-6 text-gray-900"
            x-state:on="Active"
            x-state:off="Not Active"
            role="menuitem"
            tabindex="-1"
          >Name</a>
          <!-- <a
            id="sort-menu-item-0"
            href="#"
            class="block px-3 py-1 text-sm leading-6 text-gray-900"
            x-state:on="Active"
            x-state:off="Not Active"
            :class="{ 'bg-gray-50': activeIndex === 0 }"
            role="menuitem"
            tabindex="-1"
            @mouseenter="onMouseEnter($event)"
            @mousemove="onMouseMove($event, 0)"
            @mouseleave="onMouseLeave($event)"
            @click="open = false; focusButton()"
          >Name</a> -->
          <a
            id="sort-menu-item-1"
            href="#"
            class="block px-3 py-1 text-sm leading-6 text-gray-900"
            role="menuitem"
            tabindex="-1"
          >Date updated</a>
          <a
            id="sort-menu-item-2"
            href="#"
            class="block px-3 py-1 text-sm leading-6 text-gray-900"
            role="menuitem"
            tabindex="-1"
          >Environment</a>
          <!-- <a
            id="sort-menu-item-1"
            href="#"
            class="block px-3 py-1 text-sm leading-6 text-gray-900"
            :class="{ 'bg-gray-50': activeIndex === 1 }"
            role="menuitem"
            tabindex="-1"
            @mouseenter="onMouseEnter($event)"
            @mousemove="onMouseMove($event, 1)"
            @mouseleave="onMouseLeave($event)"
            @click="open = false; focusButton()"
          >Date updated</a>
          <a
            id="sort-menu-item-2"
            href="#"
            class="block px-3 py-1 text-sm leading-6 text-gray-900"
            :class="{ 'bg-gray-50': activeIndex === 2 }"
            role="menuitem"
            tabindex="-1"
            @mouseenter="onMouseEnter($event)"
            @mousemove="onMouseMove($event, 2)"
            @mouseleave="onMouseLeave($event)"
            @click="open = false; focusButton()"
          >Environment</a> -->
        </div>
      </div>
    </header>

    <!-- Deployment list -->
    <ul
      role="list"
      class="divide-y divide-gray-200 dark:divide-gray-600"
    >
      <li class="relative flex items-center space-x-4 px-4 py-4 sm:px-6 lg:px-8">
        <div class="min-w-0 flex-auto">
          <div class="flex items-center gap-x-3">
            <div class="flex-none rounded-full p-1 text-gray-500 bg-gray-100/10">
              <div class="h-2 w-2 rounded-full bg-current" />
            </div>
            <h2 class="min-w-0 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
              <router-link
                to="/deployments/1"
                href="#"
                class="flex gap-x-2"
              >
                <span class="truncate">Planetaria</span>
                <span class="text-gray-400">/</span>
                <span class="whitespace-nowrap">ios-app</span>
                <span class="absolute inset-0" />
              </router-link>
            </h2>
          </div>
          <div class="mt-3 flex items-center gap-x-2.5 text-xs leading-5 text-gray-400">
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
        <div class="rounded-full flex-none py-1 px-2 text-xs font-medium ring-1 ring-inset text-gray-600 bg-gray-400/10 ring-gray-400/20 dark:bg-blue-gray-600 dark:text-gray-300">
          Preview
        </div>
        <div class="i-heroicons-chevron-right-20-solid w-5 h-5 text-gray-400" />
      </li>
      <li class="relative flex items-center space-x-4 px-4 py-4 sm:px-6 lg:px-8">
        <div class="min-w-0 flex-auto">
          <div class="flex items-center gap-x-3">
            <div class="flex-none rounded-full p-1 text-green-400 bg-green-400/10">
              <div class="h-2 w-2 rounded-full bg-current" />
            </div>
            <h2 class="min-w-0 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
              <router-link
                to="/deployments/1"
                href="#"
                class="flex gap-x-2"
              >
                <span class="truncate">Planetaria</span>
                <span class="text-gray-400">/</span>
                <span class="whitespace-nowrap">mobile-api</span>
                <span class="absolute inset-0" />
              </router-link>
            </h2>
          </div>
          <div class="mt-3 flex items-center gap-x-2.5 text-xs leading-5 text-gray-400">
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
              Deployed 3m ago
            </p>
          </div>
        </div>
        <div class="rounded-full flex-none py-1 px-2 text-xs font-medium ring-1 ring-inset text-blue-600 bg-blue-500/10 ring-blue-600/30 dark:bg-blue-gray-600 dark:text-blue-300">
          Production
        </div>
        <div class="i-heroicons-chevron-right-20-solid w-5 h-5 text-gray-400" />
      </li>
      <li class="relative flex items-center space-x-4 px-4 py-4 sm:px-6 lg:px-8">
        <div class="min-w-0 flex-auto">
          <div class="flex items-center gap-x-3">
            <div class="flex-none rounded-full p-1 text-gray-500 bg-gray-100/10">
              <div class="h-2 w-2 rounded-full bg-current" />
            </div>
            <h2 class="min-w-0 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
              <router-link
                to="/deployments/1"
                href="#"
                class="flex gap-x-2"
              >
                <span class="truncate">Tailwind Labs</span>
                <span class="text-gray-400">/</span>
                <span class="whitespace-nowrap">tailwindcss.com</span>
                <span class="absolute inset-0" />
              </router-link>
            </h2>
          </div>
          <div class="mt-3 flex items-center gap-x-2.5 text-xs leading-5 text-gray-400">
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
        <div class="rounded-full flex-none py-1 px-2 text-xs font-medium ring-1 ring-inset text-gray-600 bg-gray-500/10 ring-gray-600/20 dark:bg-blue-gray-600 dark:text-gray-300">
          Preview
        </div>
        <div class="i-heroicons-chevron-right-20-solid w-5 h-5 text-gray-400" />
      </li>
      <li class="relative flex items-center space-x-4 px-4 py-4 sm:px-6 lg:px-8">
        <div class="min-w-0 flex-auto">
          <div class="flex items-center gap-x-3">
            <div class="flex-none rounded-full p-1 text-green-400 bg-green-400/10">
              <div class="h-2 w-2 rounded-full bg-current" />
            </div>
            <h2 class="min-w-0 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
              <router-link
                to="/deployments/1"
                href="#"
                class="flex gap-x-2"
              >
                <span class="truncate">Tailwind Labs</span>
                <span class="text-gray-400">/</span>
                <span class="whitespace-nowrap">tailwindui.com</span>
                <span class="absolute inset-0" />
              </router-link>
            </h2>
          </div>
          <div class="mt-3 flex items-center gap-x-2.5 text-xs leading-5 text-gray-400">
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
              Deployed 1d ago
            </p>
          </div>
        </div>
        <div class="rounded-full flex-none py-1 px-2 text-xs font-medium ring-1 ring-inset text-gray-600 bg-gray-400/10 ring-gray-400/20 dark:bg-blue-gray-600 dark:text-gray-300">
          Preview
        </div>
        <div class="i-heroicons-chevron-right-20-solid w-5 h-5 text-gray-400" />
      </li>
      <li class="relative flex items-center space-x-4 px-4 py-4 sm:px-6 lg:px-8">
        <div class="min-w-0 flex-auto">
          <div class="flex items-center gap-x-3">
            <div class="flex-none rounded-full p-1 text-green-400 bg-green-400/10">
              <div class="h-2 w-2 rounded-full bg-current" />
            </div>
            <h2 class="min-w-0 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
              <router-link
                to="/deployments/1"
                href="#"
                class="flex gap-x-2"
              >
                <span class="truncate">Protocol</span>
                <span class="text-gray-400">/</span>
                <span class="whitespace-nowrap">relay-service</span>
                <span class="absolute inset-0" />
              </router-link>
            </h2>
          </div>
          <div class="mt-3 flex items-center gap-x-2.5 text-xs leading-5 text-gray-400">
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
              Deployed 1d ago
            </p>
          </div>
        </div>
        <div class="rounded-full flex-none py-1 px-2 text-xs font-medium ring-1 ring-inset text-blue-600 bg-blue-500/10 ring-blue-600/30 dark:bg-blue-gray-600 dark:text-blue-300">
          Production
        </div>
        <div class="i-heroicons-chevron-right-20-solid w-5 h-5 text-gray-400" />
      </li>
      <li class="relative flex items-center space-x-4 px-4 py-4 sm:px-6 lg:px-8">
        <div class="min-w-0 flex-auto">
          <div class="flex items-center gap-x-3">
            <div class="flex-none rounded-full p-1 text-green-400 bg-green-400/10">
              <div class="h-2 w-2 rounded-full bg-current" />
            </div>
            <h2 class="min-w-0 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
              <router-link
                to="/deployments/1"
                href="#"
                class="flex gap-x-2"
              >
                <span class="truncate">Planetaria</span>
                <span class="text-gray-400">/</span>
                <span class="whitespace-nowrap">android-app</span>
                <span class="absolute inset-0" />
              </router-link>
            </h2>
          </div>
          <div class="mt-3 flex items-center gap-x-2.5 text-xs leading-5 text-gray-400">
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
              Deployed 5d ago
            </p>
          </div>
        </div>
        <div class="rounded-full flex-none py-1 px-2 text-xs font-medium ring-1 ring-inset text-gray-600 bg-gray-400/10 ring-gray-400/20 dark:bg-blue-gray-600 dark:text-gray-300">
          Preview
        </div>
        <div class="i-heroicons-chevron-right-20-solid w-5 h-5 text-gray-400" />
      </li>
      <li class="relative flex items-center space-x-4 px-4 py-4 sm:px-6 lg:px-8">
        <div class="min-w-0 flex-auto">
          <div class="flex items-center gap-x-3">
            <div class="flex-none rounded-full p-1 text-rose-400 bg-rose-400/10">
              <div class="h-2 w-2 rounded-full bg-current" />
            </div>
            <h2 class="min-w-0 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
              <router-link
                to="/deployments/1"
                href="#"
                class="flex gap-x-2"
              >
                <span class="truncate">Protocol</span>
                <span class="text-gray-400">/</span>
                <span class="whitespace-nowrap">api.protocol.chat</span>
                <span class="absolute inset-0" />
              </router-link>
            </h2>
          </div>
          <div class="mt-3 flex items-center gap-x-2.5 text-xs leading-5 text-gray-400">
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
              Failed to deploy 6d ago
            </p>
          </div>
        </div>
        <div class="rounded-full flex-none py-1 px-2 text-xs font-medium ring-1 ring-inset text-gray-600 bg-gray-400/10 ring-gray-400/20 dark:bg-blue-gray-600 dark:text-gray-300">
          Preview
        </div>
        <div class="i-heroicons-chevron-right-20-solid w-5 h-5 text-gray-400" />
      </li>
      <li class="relative flex items-center space-x-4 px-4 py-4 sm:px-6 lg:px-8">
        <div class="min-w-0 flex-auto">
          <div class="flex items-center gap-x-3">
            <div class="flex-none rounded-full p-1 text-green-400 bg-green-400/10">
              <div class="h-2 w-2 rounded-full bg-current" />
            </div>
            <h2 class="min-w-0 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
              <router-link
                to="/deployments/1"
                href="#"
                class="flex gap-x-2"
              >
                <span class="truncate">Planetaria</span>
                <span class="text-gray-400">/</span>
                <span class="whitespace-nowrap">planetaria.tech</span>
                <span class="absolute inset-0" />
              </router-link>
            </h2>
          </div>
          <div class="mt-3 flex items-center gap-x-2.5 text-xs leading-5 text-gray-400">
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
              Deployed 6d ago
            </p>
          </div>
        </div>
        <div class="rounded-full flex-none py-1 px-2 text-xs font-medium ring-1 ring-inset text-gray-600 bg-gray-400/10 ring-gray-400/20 dark:bg-blue-gray-600 dark:text-gray-300">
          Preview
        </div>
        <div class="i-heroicons-chevron-right-20-solid w-5 h-5 text-gray-400" />
      </li>
    </ul>
  </main>
</template>
