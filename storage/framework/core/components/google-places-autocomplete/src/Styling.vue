<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const showCheckIcon = ref(false)

const stylingCode = ref(`
<template>
  <div class="w-full max-w-md">
    <GooglePlacesAutocomplete
      v-model="selectedPlace"
      :api-key="'YOUR_GOOGLE_MAPS_API_KEY'"
      placeholder="Enter an address"
      @place-selected="handlePlaceSelected"
      class="custom-input"
    />
  </div>
</template>

<style scoped>
.custom-input {
  /* Input field styling */
  :deep(.google-places-input) {
    @apply w-full px-4 py-2 border border-gray-300 rounded-lg
           focus:ring-2 focus:ring-blue-500 focus:border-transparent
           transition-all duration-200;
  }

  /* Suggestions container styling */
  :deep(.suggestions-container) {
    @apply mt-1 border border-gray-200 rounded-lg shadow-lg;
  }

  /* Individual suggestion item styling */
  :deep(.suggestion-item) {
    @apply px-4 py-2 hover:bg-gray-100 cursor-pointer
           transition-colors duration-150;
  }

  /* Active suggestion item styling */
  :deep(.suggestion-item:hover) {
    @apply bg-blue-50 text-blue-600;
  }
</style>`)

async function handleCopyCode() {
  await useCopyCode({ code: stylingCode.value, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="styles">
    <h1 class="my-2 text-lg font-semibold">
      Custom Styling
    </h1>
    <div class="mt-5">
      <p class="my-3 text-base">
        The Google Places Autocomplete component can be fully styled to match your application's design. You can customize the input field, suggestions container, and individual suggestion items using CSS.<br><br>
        The component uses Vue's <code><b>:deep()</b></code> selector to allow styling of child components. This example shows how to style the input field, suggestions container, and suggestion items.
      </p>

      <div class="code-block relative">
        <Highlight :code="stylingCode" />
        <button
          aria-label="Copy code"
          title="Copy code"
          class="btn-border absolute right-2 top-2 p-1"
          @click="handleCopyCode"
        >
          <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
          <div v-else class="i-hugeicons:copy-01 text-gray-500" />
        </button>
      </div>
    </div>
  </div>
</template>
