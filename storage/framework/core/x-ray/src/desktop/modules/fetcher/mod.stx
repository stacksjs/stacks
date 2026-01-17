<!-- <script setup>
import { ref } from 'vue'

import { $http, generalHandleHttp } from '../../services/http'

/* fetching */

const url = ref('')
const loading = ref(false)
const result = ref('')

async function makeRequest() {
  result.value = ''

  loading.value = true
  const { status, data, headers } = await $http.get({ url: url.value })
  loading.value = false
  if (generalHandleHttp(status, data)) return

  result.value = {
    status,
    headers,
    data,
  }
}
</script>

<template>
  <v-card
    prepend-icon="mdi-earth"
    title="Fetcher"
    subtitle="Make request and get content"
  >
    <v-card-text class="d-flex align-center">
      <v-text-field
        v-model="url"
        label="Url"
        hide-details
      />

      <v-btn
        color="primary"
        class="ms-3"
        :disabled="!url || !url.startsWith('http')"
        :loading="loading"
        @click="makeRequest()"
      >
        Make Request
      </v-btn>
    </v-card-text>

    <v-card-text v-if="loading">
      Getting your data ...
    </v-card-text>
    <v-card-text v-else-if="!result">
      No data gotten
    </v-card-text>
    <v-card-text v-else>
      <pre>{{ result }}</pre>
    </v-card-text>
  </v-card>
</template> -->
