<script setup lang="ts">
import BuildingLibraryOutlineIcon from './icons/BuildingLibraryOutlineIcon.vue'
import ClockOutlineIcon from './icons/ClockOutlineIcon.vue'
import CloudOutlineIcon from './icons/CloudOutlineIcon.vue'
import CodeBracketOutlineIcon from './icons/CodeBracketOutlineIcon.vue'
import Cog8ToothOutlineIcon from './icons/Cog8ToothOutlineIcon.vue'
import CubeOutlineIcon from './icons/CubeOutlineIcon.vue'
import HeartOutlineIcon from './icons/HeartOutlineIcon.vue'
import HomeOutlineIcon from './icons/HomeOutlineIcon.vue'
import Cog6ToothOutlineIcon from './icons/Cog6ToothOutlineIcon.vue'
</script>

<template>
  <div>
    <!-- Static sidebar for desktop -->
    <div class="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <!-- Sidebar component, swap this element with another sidebar if you like -->
      <div class="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
        <div class="flex h-16 shrink-0 items-center">
          <img
            class="h-8 w-auto"
            src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600"
            alt="Your Company"
          >
        </div>
        <nav class="flex flex-1 flex-col">
          <ul
            role="list"
            class="flex flex-1 flex-col gap-y-7"
          >
            <li>
              <ul
                role="list"
                class="-mx-2 space-y-1"
              >
                <li>
                  <!-- Current: "bg-gray-50 text-indigo-600", Default: "text-gray-700 hover:text-indigo-600 hover:bg-gray-50" -->
                  <router-link
                    to="/"
                    class="sidebar-links group"
                  >
                    <HomeOutlineIcon icon-class="h-6 w-6 shrink-0" />
                    Dashboard
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/deployments"
                    class="sidebar-links group"
                  >
                    <ClockOutlineIcon icon-class="h-6 w-6 shrink-0" />
                    Deployments
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/commands"
                    class="sidebar-links group"
                  >
                    <CodeBracketOutlineIcon icon-class="h-6 w-6 shrink-0" />
                    Commands
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/dns"
                    class="sidebar-links group"
                  >
                    <CloudOutlineIcon icon-class="h-6 w-6 shrink-0" />
                    DNS
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/environment"
                    class="sidebar-links group"
                  >
                    <CubeOutlineIcon icon-class="h-6 w-6 shrink-0" />
                    Environment
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/dependencies"
                    class="sidebar-links group"
                  >
                    <CubeOutlineIcon icon-class="h-6 w-6 shrink-0" />
                    Dependencies
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/queue"
                    class="sidebar-links group"
                  >
                    <Cog8ToothOutlineIcon icon-class="h-6 w-6 shrink-0 group-hover:text-indigo-600" />
                    Queue
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/library"
                    class="sidebar-links group"
                  >
                    <BuildingLibraryOutlineIcon icon-class="h-6 w-6 shrink-0 group-hover:text-indigo-600" />

                    Library
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/health"
                    class="sidebar-links group"
                  >
                    <HeartOutlineIcon icon-class="h-6 w-6 shrink-0 group-hover:text-indigo-600" />
                    Health
                  </router-link>
                </li>
              </ul>
            </li>
            <li>
              <div class="text-xs font-semibold leading-6 text-gray-400">
                Your Models
              </div>
              <ul
                role="list"
                class="-mx-2 mt-2 space-y-1"
              >
                <li>
                  <!-- Current: "bg-gray-50 text-indigo-600", Default: "text-gray-700 hover:text-indigo-600 hover:bg-gray-50" -->
                  <router-link
                    to="/models/users"
                    class="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 group-hover:border-indigo-600 group-hover:text-indigo-600">U</span>
                    <span class="truncate">Users</span>
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/models/events"
                    class="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 group-hover:border-indigo-600 group-hover:text-indigo-600">E</span>
                    <span class="truncate">Events</span>
                  </router-link>
                </li>
              </ul>
            </li>
            <li>
              <div class="text-xs font-semibold leading-6 text-gray-400">
                Your teams
              </div>
              <ul
                role="list"
                class="-mx-2 mt-2 space-y-1"
              >
                <li>
                  <!-- Current: "bg-gray-50 text-indigo-600", Default: "text-gray-700 hover:text-indigo-600 hover:bg-gray-50" -->
                  <router-link
                    to="/teams/1"
                    class="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 group-hover:border-indigo-600 group-hover:text-indigo-600">H</span>
                    <span class="truncate">Team A</span>
                  </router-link>
                </li>
                <li>
                  <!-- Current: "bg-gray-50 text-indigo-600", Default: "text-gray-700 hover:text-indigo-600 hover:bg-gray-50" -->
                  <router-link
                    to="/teams/2"
                    class="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 group-hover:border-indigo-600 group-hover:text-indigo-600">H</span>
                    <span class="truncate">Team B</span>
                  </router-link>
                </li>
                <li>
                  <!-- Current: "bg-gray-50 text-indigo-600", Default: "text-gray-700 hover:text-indigo-600 hover:bg-gray-50" -->
                  <router-link
                    to="/teams/3"
                    class="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 group-hover:border-indigo-600 group-hover:text-indigo-600">H</span>
                    <span class="truncate">Team C</span>
                  </router-link>
                </li>
              </ul>
            </li>
            <li class="mt-auto">
              <router-link
                to="/settings"
                class="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
              >
                <Cog6ToothOutlineIcon icon-class="h-6 w-6 shrink-0 text-gray-400 group-hover:text-indigo-600" />
                Settings
              </router-link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>

<style>
.sidebar-links {
  @apply text-gray-700 hover:text-indigo-600 hover:bg-gray-50 flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
}

.router-link-active, .router-link-exact-active {
  @apply bg-gray-50 text-indigo-600 p-2 flex items-center text-sm rounded-md !important
}
</style>
