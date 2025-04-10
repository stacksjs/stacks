<template>
  <div class="google-places-autocomplete">
    <input
      ref="input"
      type="text"
      :value="value"
      :placeholder="placeholder"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      class="google-places-input"
    />
    <div v-if="showSuggestions && suggestions.length > 0" class="suggestions-container">
      <ul class="suggestions-list">
        <li
          v-for="(suggestion, index) in suggestions"
          :key="index"
          @click="selectSuggestion(suggestion)"
          class="suggestion-item"
        >
          {{ suggestion.description }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GooglePlacesAutocomplete',
  props: {
    value: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: 'Enter a location'
    },
    apiKey: {
      type: String,
      required: true
    },
    types: {
      type: Array,
      default: () => ['geocode']
    },
    country: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      autocomplete: null,
      suggestions: [],
      showSuggestions: false,
      debounceTimer: null
    }
  },
  mounted() {
    this.initGooglePlaces()
  },
  methods: {
    initGooglePlaces() {
      if (!window.google) {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places`
        script.async = true
        script.defer = true
        document.head.appendChild(script)
        script.onload = () => this.setupAutocomplete()
      } else {
        this.setupAutocomplete()
      }
    },
    setupAutocomplete() {
      if (!window.google || !window.google.maps || !window.google.maps.places) {
        console.error('Google Places API not loaded')
        return
      }

      const options = {
        types: this.types
      }

      if (this.country) {
        options.componentRestrictions = { country: this.country }
      }

      this.autocomplete = new window.google.maps.places.AutocompleteService()
    },
    handleInput(event) {
      const value = event.target.value
      this.$emit('input', value)

      if (value.length < 2) {
        this.suggestions = []
        return
      }

      clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.getPlacePredictions(value)
      }, 300)
    },
    getPlacePredictions(input) {
      if (!this.autocomplete) return

      this.autocomplete.getPlacePredictions(
        {
          input,
          types: this.types,
          componentRestrictions: this.country ? { country: this.country } : undefined
        },
        (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            this.suggestions = predictions
            this.showSuggestions = true
          } else {
            this.suggestions = []
          }
        }
      )
    },
    selectSuggestion(suggestion) {
      this.$emit('input', suggestion.description)
      this.$emit('place-selected', suggestion)
      this.suggestions = []
      this.showSuggestions = false
    },
    handleFocus() {
      if (this.suggestions.length > 0) {
        this.showSuggestions = true
      }
    },
    handleBlur() {
      setTimeout(() => {
        this.showSuggestions = false
      }, 200)
    }
  }
}
</script>

<style scoped>
.google-places-autocomplete {
  position: relative;
  width: 100%;
}

.google-places-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.suggestions-container {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-top: 4px;
}

.suggestions-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
}

.suggestion-item:hover {
  background-color: #f5f5f5;
}
</style>
