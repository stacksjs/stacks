<script setup lang="ts">
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <div class="sticky top-0 z-10 flex h-16 flex-shrink-0 border-b border-gray-200 dark:border-gray-600 bg-white lg:hidden">
        <!-- Sidebar toggle, controls the 'sidebarOpen' sidebar state. -->
        <button
          type="button"
          class="border-r border-gray-200 px-4 text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500 lg:hidden"
        >
          <span class="sr-only">Open sidebar</span>
          <!-- Heroicon name: outline/bars-3-center-left -->
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
              d="M3.75 6.75h16.5M3.75 12H12m-8.25 5.25h16.5"
            />
          </svg>
        </button>
        <div class="flex flex-1 justify-between px-4 sm:px-6 lg:px-8">
          <div class="flex flex-1">
            <form
              class="flex w-full md:ml-0"
              action="#"
              method="GET"
            >
              <label
                for="search-field"
                class="sr-only"
              >Search</label>
              <div class="relative w-full text-gray-400 focus-within:text-gray-600">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center">
                  <!-- Heroicon name: mini/magnifying-glass -->
                  <svg
                    class="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <input
                  id="search-field"
                  name="search-field"
                  class="block h-full w-full border-transparent py-2 pl-8 pr-3 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:border-transparent focus:placeholder-gray-400 focus:outline-none focus:ring-0 sm:text-sm"
                  placeholder="Search"
                  type="search"
                >
              </div>
            </form>
          </div>
          <div class="flex items-center">
            <!-- Profile dropdown -->
            <div class="relative ml-3">
              <div>
                <button
                  id="user-menu-button"
                  type="button"
                  class="flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  aria-expanded="false"
                  aria-haspopup="true"
                >
                  <span class="sr-only">Open user menu</span>
                  <img
                    class="h-8 w-8 rounded-full"
                    src="https://images.unsplash.com/photo-1502685104226-ee32379fefbe?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    alt=""
                  >
                </button>
              </div>

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
                class="absolute right-0 z-10 mt-2 w-48 origin-top-right divide-y divide-gray-200 dark:divide-gray-600 dark:divide-gray-600 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="user-menu-button"
                tabindex="-1"
              >
                <div
                  class="py-1"
                  role="none"
                >
                  <!-- Active: "bg-gray-100 text-gray-900 dark:text-gray-100", Not Active: "text-gray-700 dark:text-gray-200" -->
                  <a
                    id="user-menu-item-0"
                    href="#"
                    class="text-gray-700 dark:text-gray-200 block px-4 py-2 text-sm"
                    role="menuitem"
                    tabindex="-1"
                  >View profile</a>
                  <a
                    id="user-menu-item-1"
                    href="#"
                    class="text-gray-700 dark:text-gray-200 block px-4 py-2 text-sm"
                    role="menuitem"
                    tabindex="-1"
                  >Settings</a>
                  <a
                    id="user-menu-item-2"
                    href="#"
                    class="text-gray-700 dark:text-gray-200 block px-4 py-2 text-sm"
                    role="menuitem"
                    tabindex="-1"
                  >Notifications</a>
                </div>
                <div
                  class="py-1"
                  role="none"
                >
                  <a
                    id="user-menu-item-3"
                    href="#"
                    class="text-gray-700 dark:text-gray-200 block px-4 py-2 text-sm"
                    role="menuitem"
                    tabindex="-1"
                  >Get desktop app</a>
                  <a
                    id="user-menu-item-4"
                    href="#"
                    class="text-gray-700 dark:text-gray-200 block px-4 py-2 text-sm"
                    role="menuitem"
                    tabindex="-1"
                  >Support</a>
                </div>
                <div
                  class="py-1"
                  role="none"
                >
                  <a
                    id="user-menu-item-5"
                    href="#"
                    class="text-gray-700 dark:text-gray-200 block px-4 py-2 text-sm"
                    role="menuitem"
                    tabindex="-1"
                  >Logout</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <main class="flex-1">
        <TopBar />
        <div class="lg:py-8 py-4 dark:bg-gray-800 min-h-screen bg-white/80 backdrop-blur-sm">
          <div class="px-4 sm:px-6 lg:px-8 mb-8">
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 md:grid-cols-2">
              <StatCard
                title="Total Leads"
                :data="100"
                :action="false"
              />

              <StatCard
                title="Webpage Source"
                :data="50"
                :action="false"
              />
            </div>
          </div>

          <div class="px-4 sm:px-6 lg:px-8 mb-8">
            <FilterSection
              title="Leads"
              button-text="Leads"
            />
          </div>

          <LeadsTable />
        </div>
      </main>
    </div>
  </div>
</template>
