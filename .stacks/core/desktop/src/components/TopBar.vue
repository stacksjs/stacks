<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { useUserStore } from '~/stores/user'
import { useSidebarStore } from '~/stores/sidebar'

const emit = defineEmits(['search'])
const userStore = useUserStore()
const sidebarStore = useSidebarStore()
const route = useRoute()

const search = ref('')
const dropdown = ref(false)
const searchModal = ref(false)
const searchModalClicked = ref(false)

function doSearch(query: string) {
  emit('search', query)
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

function onKeyDown(event: any) {
  if (event.metaKey && event.key === 'k')
    showSearchModal(true)

  if (event.key === 'Escape' || event.key === 'Esc')
    closeSearchModal()
}

function showSearchModal(isKeyboard = false) {
  if (!isKeyboard) {
    searchModalClicked.value = true

    setTimeout(() => {
      searchModalClicked.value = false
    }, 250)
  }

  searchModal.value = true
}

function closeSearchModal() {
  if (!searchModalClicked.value)
    searchModal.value = false
}

async function logout() {
  await userStore.logout()

  location.replace('/login')
}

const isPageTable = computed(() => {
  const currentRoute = String(route.name)
  return ['users', 'webpages', 'events', 'pages', 'events-id-rsvps', 'reports-center', 'team-members'].includes(currentRoute)
})

const searchPlaceholder = computed(() => {
  if (isPageTable.value)
    return 'Quick search...'

  return 'Quick search... ⌘K'
})

function showSidebar() {
  if (!isPageTable.value)
    showSearchModal(false)
}

const searchAction = useDebounceFn((query: string) => {
  doSearch(query)
}, 500)

watch(search, (current) => {
  if (!current)
    emit('search', '')

  if (current)
    searchAction(current)
})
</script>

<template>
  <div class="relative flex flex-shrink-0 h-16 bg-white shadow-md">
    <div class="flex items-center justify-end flex-1 p-2 sm:px-4 lg:py-2 dark:bg-gray-800 lg:mx-auto lg:px-8 dark:border-b dark:border-gray-600">
      <div class="flex-1">
        <div
          class="flex items-center"
        >
          <button
            class="mr-2 lg:hidden"
            @click="sidebarStore.showSidebar()"
          >
            <svg
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
              class="w-6 h-6 text-gray-500"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>

          <div
            class="flex w-full md:ml-0"
          >
            <label
              for="search-field"
              class="sr-only"
            >Search</label>
            <div class="relative w-full text-gray-400 dark:text-gray-200 focus-within:text-gray-600 dark:focus-within:text-gray-200">
              <div
                aria-hidden="true"
                class="absolute inset-y-0 left-0 flex items-center pointer-events-none "
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                ><path
                  fill-rule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clip-rule="evenodd"
                /></svg>
              </div>
              <input
                id="search-field"
                v-model="search"
                name="search-field"
                :placeholder="searchPlaceholder"
                type="search"
                class="block w-full h-full py-2 pl-8 pr-3 text-gray-900 placeholder-gray-500 border-transparent dark:placeholder-gray-300 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-0 focus:border-transparent sm:text-sm dark:text-gray-300"
                @click="showSidebar"
              >
            </div>
          </div>
        </div>

        <!-- <div
          v-if="!isPageTable"
          class="relative flex items-center w-full text-gray-400 dark:text-gray-200 focus-within:text-gray-600 dark:focus-within:text-gray-200"
        >
          <button
            class="mr-2 lg:hidden"
            @click="sidebarStore.showSidebar()"
          >
            <svg
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
              class="w-6 h-6 text-gray-500"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>

          <div class="relative bg-white pointer-events-auto dark:bg-slate-900">
            <button
              type="button"
              class="hidden w-full lg:flex items-center text-sm leading-6 text-slate-400 rounded-md ring-1 ring-slate-900/10 shadow-sm py-1.5 pl-2 pr-3 hover:ring-slate-300 dark:bg-slate-700 dark:highlight-white/5 dark:hover:bg-slate-700"
              @click="showSearchModal(false)"
            >
              <svg
                width="24"
                height="24"
                fill="none"
                aria-hidden="true"
                class="flex-none mr-3"
              ><path
                d="m19 19-3.5-3.5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><circle
                cx="11"
                cy="11"
                r="6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg>Quick search...<span class="flex-none pl-3 ml-auto text-xs font-semibold">⌘K</span>
            </button>
          </div>
        </div> -->
      </div>

      <div class="relative">
        <div class="flex items-center ml-4 md:ml-6">
          <button
            type="button"
            :class="{ 'bg-teal-600': isDark, 'bg-gray-200': !isDark }"
            class="relative inline-flex flex-shrink-0 h-6 ml-3 transition-colors duration-200 ease-in-out border-2 border-transparent rounded-full cursor-pointer w-11 focus:outline-none focus:ring-2 focus:ring-offset-2"
            role="switch"
            aria-checked="false"
            @click="toggleDark()"
          >
            <span class="sr-only">Use setting</span>
            <span
              :class="{ 'translate-x-5': isDark, 'translate-x-0': !isDark }"
              class="relative inline-block w-5 h-5 transition duration-200 ease-in-out transform bg-white rounded-full shadow pointer-events-none ring-0"
            >
              <span
                class="absolute inset-0 flex items-center justify-center w-full h-full transition-opacity"
                aria-hidden="true"
                :class="{ 'opacity-0 ease-out duration-100': isDark, 'opacity-100 ease-in duration-200': !isDark }"
              >
                <svg
                  class="w-3 h-3 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                /></svg>
              </span>
              <span
                class="absolute inset-0 flex items-center justify-center w-full h-full transition-opacity duration-100 ease-out opacity-0"
                aria-hidden="true"
                :class="{ 'opacity-100 ease-in duration-200': isDark, 'opacity-0 ease-out duration-100': !isDark }"
              >
                <svg
                  class="w-3 h-3 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                /></svg>
              </span>
            </span>
          </button>

          <div
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="menu-button"
            tabindex="-1"
            class="absolute right-0 hidden w-56 mt-2 origin-top-right bg-white rounded-md shadow-lg top-10 ring-1 ring-black ring-opacity-5 focus:outline-none"
          >
            <div
              role="none"
              class="py-1"
            >
              <ul
                role="list"
                class="divide-y divide-gray-200 dark:divide-gray-600"
              >
                <li class="relative px-4 py-5 bg-white hover:bg-gray-50 focus-within:ring-2 focus-within:ring-inset focus-within:ring-teal-600">
                  <div class="flex justify-between space-x-3">
                    <div class="flex-1 min-w-0">
                      <a
                        href="#"
                        class="block focus:outline-none"
                      ><span
                        aria-hidden="true"
                        class="absolute inset-0"
                      /> <p class="text-sm font-medium text-gray-900 truncate dark:text-gray-100">
                        Password reset
                      </p></a>
                    </div>
                    <time
                      datetime="2021-01-27T16:35"
                      class="flex-shrink-0 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap"
                    >1d ago</time>
                  </div>
                  <div class="mt-1">
                    <p class="text-sm text-gray-600 line-clamp-2">
                      Please reset your password
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div class="relative ml-3">
        <div>
          <button
            id="user-menu-button"
            type="button"
            aria-expanded="false"
            aria-haspopup="true"
            class="flex items-center max-w-xs text-sm bg-white rounded-full dark:bg-gray-800 dark-hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 lg:p-2 lg:rounded-md lg:hover:bg-gray-50"
            @click="dropdown = !dropdown"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-500">
              <span className="font-medium leading-none text-xs text-white">CA</span>
            </span>

            <span class="hidden ml-3 text-sm font-medium text-gray-700 dark:text-gray-200 lg:block"><span class="sr-only">Open user menu for </span>
              CareFree Admin
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              class="flex-shrink-0 hidden w-5 h-5 ml-1 text-gray-400 lg:block dark:text-gray-200"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              /></svg>
          </button>
        </div>
        <div
          v-if="dropdown"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu-button"
          tabindex="-1"
          class="absolute right-0 z-20 w-48 py-1 mt-2 origin-top-right bg-white rounded-md shadow-lg dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none"
        >
          <button
            role="menuitem"
            tabindex="-1"
            class="block w-full px-4 py-2 text-sm text-left text-gray-700 dark-hover:bg-gray-600 hover:bg-gray-100 dark:text-gray-200"
            @click="logout"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </div>

  <SearchModal
    v-if="searchModal"
    @close-search-modal="closeSearchModal()"
  />
</template>
