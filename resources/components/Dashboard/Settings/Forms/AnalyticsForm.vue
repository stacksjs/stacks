<script setup lang="ts">

</script>

<template>
  <form>
    <div class="space-y-12">
      <div class="border-b border-gray-900/10 pb-12">
        <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
          <div class="sm:col-span-3">
            <label for="driver" class="block text-sm font-medium leading-6 text-gray-900">Driver</label>
            <div class="mt-2">
              <select id="driver" name="country" autocomplete="country-name" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6">
                <option selected>
                  Fathom
                </option>
                <option>Google Analytics</option>
              </select>
            </div>
          </div>
          <div class="sm:col-span-3" />

          <div class="sm:col-span-3">
            <label for="google-analytics" class="block text-sm font-medium leading-6 text-gray-900">Google Analytics (tracking-id)</label>
            <div class="mt-2">
              <input id="google-analytics" type="text" name="google-analytics" placeholder="UA-XXXXXXXXX-X" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
            </div>
          </div>

          <div class="sm:col-span-3">
            <label for="fathom" class="block text-sm font-medium leading-6 text-gray-900">Fathom (site-id)</label>
            <div class="mt-2">
              <input id="fathom" type="text" placeholder="WOLZMJDL" name="fathom" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="mt-6 flex items-center justify-end gap-x-6">
      <button type="button" class="text-sm font-semibold leading-6 text-gray-900">
        Cancel
      </button>
      <Button
        type="submit"
        class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Save
      </Button>
    </div>
  </form>
</template>

<style scoped>

</style>
