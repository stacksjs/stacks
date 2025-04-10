<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const code = `<!-- App.vue -->
<script lang="ts" setup>
import { ref } from 'vue'
import GooglePlacesAutocomplete from '@stacksjs/google-places-autocomplete'

const selectedPlace = ref('')
const handlePlaceSelected = (place: any) => {
  selectedPlace.value = place.description
  console.log('Selected place:', place)
}
<\/script>

<template>
  <div class="w-full max-w-md">
    <GooglePlacesAutocomplete
      v-model="selectedPlace"
      :api-key="'YOUR_GOOGLE_MAPS_API_KEY'"
      placeholder="Enter an address"
      @place-selected="handlePlaceSelected"
    />
    <p v-if="selectedPlace" class="mt-2 text-sm text-gray-600">
      Selected: {{ selectedPlace }}
    </p>
  </div>
</template>`

const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({ code, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="usage">
    <h1 class="my-2 text-lg font-semibold">
      Usage
    </h1>
    <p class="my-3 text-base">
      The Google Places Autocomplete component provides a simple way to integrate Google's Places Autocomplete service into your Vue application. It handles all the complexity of interacting with the Google Maps API while providing a clean, customizable interface.<br><br>

      The component requires a Google Maps API key and provides several props for customization, including placeholder text, country restrictions, and place types.
    </p>
    <div class="group code-block relative">
      <Highlight
        class-name="rounded-md text-xs"
        language="xml"
        :autodetect="false"
        :code="code"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="btn-border absolute right-2 top-2 hidden p-1 group-hover:block"
        @click="handleCopyCode"
      >
        <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
        <div v-else class="i-hugeicons:copy-01 text-gray-500" />
      </button>
    </div>
    <p class="my-3 text-base">
      To learn more about the Google Places API, visit the <a class="text-blue-500" href="https://developers.google.com/maps/documentation/javascript/places-autocomplete" target="_blank">official documentation</a>.
    </p>
  </div>
</template>
