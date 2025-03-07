<template>
  <div
    class="relative z-50 lg:hidden"
    role="dialog"
    aria-modal="true"
  >
    <!--
        Off-canvas menu backdrop, show/hide based on off-canvas menu state.

        Entering: "transition-opacity ease-linear duration-300"
          From: "opacity-0"
          To: "opacity-100"
        Leaving: "transition-opacity ease-linear duration-300"
          From: "opacity-100"
          To: "opacity-0"
      -->
    <div class="fixed inset-0 bg-gray-900/80" />

    <div class="fixed inset-0 flex">
      <!--
        Off-canvas menu, show/hide based on off-canvas menu state.

        Entering: "transition ease-in-out duration-300 transform"
          From: "-translate-x-full"
          To: "translate-x-0"
        Leaving: "transition ease-in-out duration-300 transform"
          From: "translate-x-0"
          To: "-translate-x-full"
      -->
      <div class="relative mr-16 max-w-xs w-full flex flex-1">
        <!--
          Close button, show/hide based on off-canvas menu state.

          Entering: "ease-in-out duration-300"
            From: "opacity-0"
            To: "opacity-100"
          Leaving: "ease-in-out duration-300"
            From: "opacity-100"
            To: "opacity-0"
        -->
        <div class="absolute left-full top-0 w-16 flex justify-center pt-5">
          <button
            type="button"
            class="p-2.5 -m-2.5"
          >
            <span class="sr-only">Close sidebar</span>

            <div class="i-hugeicons-cancel-01 h-6 w-6 text-white" />
          </button>
        </div>

        <!-- Sidebar component, swap this element with another sidebar if you like -->
        <div class="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
          <div class="h-16 flex shrink-0 items-center">
            <img
              class="h-8 w-auto"
              src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600"
              alt="Your Company"
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
