<template>
  <div>
    <button
      type="button"
      class=":stx: inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
      @click="increment"
    >
      <i
        class=":stx: i-heroicons-outline-plus -ml-1 mr-3 h-5 w-5"
        aria-hidden="true"
      />
      Dummy Counter: {{ count }}
    </button>
  </div>
</template>
