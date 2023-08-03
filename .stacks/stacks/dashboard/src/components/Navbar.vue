<script></script>

<template>
  <div class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
    <button
      type="button"
      class="-m-2.5 p-2.5 text-gray-700 lg:hidden"
    >
      <span class="sr-only">Open sidebar</span>
      <svg
        class="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
        />
      </svg>
    </button>

    <!-- Separator -->
    <div
      class="h-6 w-px bg-gray-200 lg:hidden"
      aria-hidden="true"
    />

    <div class="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
      <form
        class="relative flex flex-1"
        action="#"
        method="GET"
      >
        <label
          for="search-field"
          class="sr-only"
        >Search</label>
        <svg
          class="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400"
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
        <input
          id="search-field"
          class="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
          placeholder="Search..."
          type="search"
          name="search"
        >
      </form>
      <div class="flex items-center gap-x-4 lg:gap-x-6">
        <button
          type="button"
          class="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
        >
          <span class="sr-only">View notifications</span>
          <div class="i-heroicons-bell w-6 h-6" />
        </button>

        <!-- Separator -->
        <div
          class="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200"
          aria-hidden="true"
        />

        <!-- Profile dropdown -->
        <div class="relative">
          <button
            id="user-menu-button"
            type="button"
            class="-m-1.5 flex items-center p-1.5"
            aria-expanded="false"
            aria-haspopup="true"
          >
            <span class="sr-only">Open user menu</span>
            <img
              class="h-8 w-8 rounded-full bg-gray-50"
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
              alt=""
            >
            <span class="hidden lg:flex lg:items-center">
              <div class="i-heroicons-chevron-down w-5 h-5 ml-2 text-gray-400" />
            </span>
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
            class="absolute hidden right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="user-menu-button"
            tabindex="-1"
          >
            <!-- Active: "bg-gray-50", Not Active: "" -->
            <a
              id="user-menu-item-0"
              href="#"
              class="block px-3 py-1 text-sm leading-6 text-gray-900"
              role="menuitem"
              tabindex="-1"
            >Your profile</a>
            <a
              id="user-menu-item-1"
              href="#"
              class="block px-3 py-1 text-sm leading-6 text-gray-900"
              role="menuitem"
              tabindex="-1"
            >Sign out</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
