<script setup lang="ts">
// import { ref } from 'vue'
// import Multiselect from '@vueform/multiselect'

// interface Props {
//   filterValues: object | any // the Meilisearch index to use for this table
// }

// const {
//   filterValues,
// } = defineProps<Props>()

// const multiselect = ref(null)

// const multiselectComputed: any = computed(() => {
//   if (multiselect.value)
//     return multiselect.value
// })

// const { searchFilters, type, table } = await useTable()

// const activeFilters = await searchFilters(type.value)

// const filterValue = ref({})
// const filterLength = ref(0)

// const allFilters = activeFilters.map((filter: string) => {
//   const filterName = filter.split('_')
//   const name = []

//   for (let i = 0; i < filterName.length; i++)
//     name[i] = filterName[i].charAt(0).toUpperCase() + filterName[i].substring(1)

//   // Directly return the joined string
//   return { name: name.join(' '), column: snakeCase(name.join(' ')) }
// })

// function getFilters(filterKey: string): any {
//   return filterValues[filterKey]
// }

// function snakeCase(char: string) {
//   return char.replace(/\W+/g, ' ')
//     .split(/ |\B(?=[A-Z])/)
//     .map(word => word.toLowerCase())
//     .join('_')
// }

// async function applyFilters() {
//   let length = 0
//   const mappedFilters = Object.keys(filterValue.value).map((key) => {
//     length = length += 1

//     filterLength.value = length

//     return filterValue.value[key].map((filter: any) => {
//       return `${key} = ${filter}`
//     })
//   })

//   table.filterValue = mappedFilters
//   table.currentPage = 1
// }

// async function clearAllFilters() {
//   table.filterValue = []
//   table.currentPage = 1

//   filterValue.value = {}
//   filterLength.value = 0

//   if (multiselectComputed.value) {
//     for (let index = 0; index < multiselectComputed.value.length; index++) {
//       if (multiselectComputed.value[index])
//         multiselectComputed.value[index].clear()
//     }
//   }
// }

// function modifyFilters(name: string, value: any, id: number) {
//   filterValue.value[name] = [...value]
// },
</script>

<template>
  <div />
  <!-- <div class="bg-white mx-auto max-w-7xl">
    --Filters--
    <section
      aria-labelledby="filter-heading"
      class="border-t border-b border-gray-200 grid z-10 relative items-center"
    >
      <h2
        id="filter-heading"
        class="sr-only"
      >
        Filters
      </h2>
      <div class="py-4 col-start-1 row-start-1 relative">
        <div class="divide-x flex mx-auto space-x-6 divide-gray-200 text-sm max-w-7xl px-4 sm:px-6 lg:px-8">
          <div>
            <button
              type="button"
              class="flex font-medium text-gray-700 group items-center"
              aria-controls="disclosure-1"
              aria-expanded="false"
            >
               Heroicon name: solid/filter
              <svg
                class="flex-none h-5 mr-2 text-gray-400 w-5 group-hover:text-gray-500"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
                  clip-rule="evenodd"
                />
              </svg>
              {{ filterLength }} Filters
            </button>
          </div>
          <div class="pl-6">
            <button
              type="button"
              class="text-gray-500"
              @click="clearAllFilters"
            >
              Clear all
            </button>
          </div>
        </div>
      </div>
      <div
        id="disclosure-1"
        class="border-t border-gray-200 py-10"
      >
        <div class="mx-auto text-sm  max-w-7xl px-4 sm:px-6 md:gap-x-6 lg:px-8">
          <div class="auto-rows-min grid gap-y-10 grid-cols-1 md:gap-x-6 md:grid-cols-4">
            <fieldset
              v-for="(filter, index) in allFilters"
              :key="index"
            >
              <legend class="font-medium block">
                {{ filter.name }}
              </legend>
              <div class="space-y-6 pt-6 sm:space-y-4 sm:pt-4">
                <div class="flex text-base items-center sm:text-sm">
                  <Multiselect
                    ref="multiselect"
                    :options="getFilters(filter.column)"
                    mode="tags"
                    :close-on-select="false"
                    :searchable="true"
                    :create-option="true"
                    @input="modifyFilters(filter.column, $event, index)"
                  />
                </div>
              </div>
            </fieldset>
          </div>

          <div class="flex justify-end">
            <button
              type="button"
              class="border border-transparent rounded-full font-medium bg-blue-600 shadow-sm text-xs text-white py-1.5 px-3 inline-flex items-center hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              @click="applyFilters"
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>
    </section>
  </div> -->
</template>

<style>
/*
Ensure the default browser behavior of the `hidden` attribute.
*/

[hidden] {
  display: none;
}

*, ::before, ::after {
  --tw-translate-x: 0;
  --tw-translate-y: 0;
  --tw-rotate: 0;
  --tw-skew-x: 0;
  --tw-skew-y: 0;
  --tw-scale-x: 1;
  --tw-scale-y: 1;
  --tw-pan-x:  ;
  --tw-pan-y:  ;
  --tw-pinch-zoom:  ;
  --tw-scroll-snap-strictness: proximity;
  --tw-ordinal:  ;
  --tw-slashed-zero:  ;
  --tw-numeric-figure:  ;
  --tw-numeric-spacing:  ;
  --tw-numeric-fraction:  ;
  --tw-ring-inset:  ;
  --tw-ring-offset-width: 0px;
  --tw-ring-offset-color: #fff;
  --tw-ring-color: rgb(59 130 246 / 0.5);
  --tw-ring-offset-shadow: 0 0 #0000;
  --tw-ring-shadow: 0 0 #0000;
  --tw-shadow: 0 0 #0000;
  --tw-shadow-colored: 0 0 #0000;
  --tw-blur:  ;
  --tw-brightness:  ;
  --tw-contrast:  ;
  --tw-grayscale:  ;
  --tw-hue-rotate:  ;
  --tw-invert:  ;
  --tw-saturate:  ;
  --tw-sepia:  ;
  --tw-drop-shadow:  ;
  --tw-backdrop-blur:  ;
  --tw-backdrop-brightness:  ;
  --tw-backdrop-contrast:  ;
  --tw-backdrop-grayscale:  ;
  --tw-backdrop-hue-rotate:  ;
  --tw-backdrop-invert:  ;
  --tw-backdrop-opacity:  ;
  --tw-backdrop-saturate:  ;
  --tw-backdrop-sepia:  ;
}

.form-input,.form-textarea,.form-select,.form-multiselect {
  -webkit-appearance: none;
     -moz-appearance: none;
          appearance: none;
  background-color: #fff;
  border-color: #6b7280;
  border-width: 1px;
  border-radius: 0px;
  padding-top: 0.5rem;
  padding-right: 0.75rem;
  padding-bottom: 0.5rem;
  padding-left: 0.75rem;
  font-size: 1rem;
  line-height: 1.5rem;
  --tw-shadow: 0 0 #0000;
}

.form-input:focus, .form-textarea:focus, .form-select:focus, .form-multiselect:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  --tw-ring-inset: var(--tw-empty,/*!*/ /*!*/);
  --tw-ring-offset-width: 0px;
  --tw-ring-offset-color: #fff;
  --tw-ring-color: #2563eb;
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  border-color: #2563eb;
}

.form-input::-moz-placeholder, .form-textarea::-moz-placeholder {
  color: #6b7280;
  opacity: 1;
}

.form-input:-ms-input-placeholder, .form-textarea:-ms-input-placeholder {
  color: #6b7280;
  opacity: 1;
}

.form-input::placeholder,.form-textarea::placeholder {
  color: #6b7280;
  opacity: 1;
}

.form-input::-webkit-datetime-edit-fields-wrapper {
  padding: 0;
}

.form-input::-webkit-date-and-time-value {
  min-height: 1.5em;
}

.form-input::-webkit-datetime-edit,.form-input::-webkit-datetime-edit-year-field,.form-input::-webkit-datetime-edit-month-field,.form-input::-webkit-datetime-edit-day-field,.form-input::-webkit-datetime-edit-hour-field,.form-input::-webkit-datetime-edit-minute-field,.form-input::-webkit-datetime-edit-second-field,.form-input::-webkit-datetime-edit-millisecond-field,.form-input::-webkit-datetime-edit-meridiem-field {
  padding-top: 0;
  padding-bottom: 0;
}

.form-select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
  -webkit-print-color-adjust: exact;
     color-adjust: exact;
          print-color-adjust: exact;
}

.form-checkbox,.form-radio {
  -webkit-appearance: none;
     -moz-appearance: none;
          appearance: none;
  padding: 0;
  -webkit-print-color-adjust: exact;
     color-adjust: exact;
          print-color-adjust: exact;
  display: inline-block;
  vertical-align: middle;
  background-origin: border-box;
  -webkit-user-select: none;
     -moz-user-select: none;
      -ms-user-select: none;
          user-select: none;
  flex-shrink: 0;
  height: 1rem;
  width: 1rem;
  color: #2563eb;
  background-color: #fff;
  border-color: #6b7280;
  border-width: 1px;
  --tw-shadow: 0 0 #0000;
}

.form-checkbox {
  border-radius: 0px;
}

.form-radio {
  border-radius: 100%;
}

.form-checkbox:focus,.form-radio:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  --tw-ring-inset: var(--tw-empty,/*!*/ /*!*/);
  --tw-ring-offset-width: 2px;
  --tw-ring-offset-color: #fff;
  --tw-ring-color: #2563eb;
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
}

.form-checkbox:checked,.form-radio:checked {
  border-color: transparent;
  background-color: currentColor;
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
}

.form-checkbox:checked {
  background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
}

.form-radio:checked {
  background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='8' cy='8' r='3'/%3e%3c/svg%3e");
}

.form-checkbox:checked:hover,.form-checkbox:checked:focus,.form-radio:checked:hover,.form-radio:checked:focus {
  border-color: transparent;
  background-color: currentColor;
}

.form-checkbox:indeterminate {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3e%3cpath stroke='white' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 8h8'/%3e%3c/svg%3e");
  border-color: transparent;
  background-color: currentColor;
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
}

.form-checkbox:indeterminate:hover,.form-checkbox:indeterminate:focus {
  border-color: transparent;
  background-color: currentColor;
}

.mx-auto {
  margin-left: auto;
  margin-right: auto;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-4 {
  margin-top: 1rem;
}

.mt-8 {
  margin-top: 2rem;
}

.mt-1 {
  margin-top: 0.25rem;
}

.ml-2 {
  margin-left: 0.5rem;
}

.mt-0 {
  margin-top: 0px;
}

.block {
  display: block;
}

.flex {
  display: flex;
}

.inline-flex {
  display: inline-flex;
}

.grid {
  display: grid;
}

.h-24 {
  height: 6rem;
}

.w-full {
  width: 100%;
}

.max-w-xl {
  max-width: 36rem;
}

.max-w-md {
  max-width: 28rem;
}

.max-w-4xl {
  max-width: 56rem;
}

.grid-cols-1 {
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

.grid-cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.items-start {
  align-items: flex-start;
}

.items-center {
  align-items: center;
}

.gap-6 {
  gap: 1.5rem;
}

.space-x-4 > :not([hidden]) ~ :not([hidden]) {
  --tw-space-x-reverse: 0;
  margin-right: calc(1rem * var(--tw-space-x-reverse));
  margin-left: calc(1rem * calc(1 - var(--tw-space-x-reverse)));
}

.divide-y > :not([hidden]) ~ :not([hidden]) {
  --tw-divide-y-reverse: 0;
  border-top-width: calc(1px * calc(1 - var(--tw-divide-y-reverse)));
  border-bottom-width: calc(1px * var(--tw-divide-y-reverse));
}

.rounded-md {
  border-radius: 0.375rem;
}

.rounded {
  border-radius: 0.25rem;
}

.border-0 {
  border-width: 0px;
}

.border-2 {
  border-width: 2px;
}

.border-b-2 {
  border-bottom-width: 2px;
}

.border-gray-300 {
  --tw-border-opacity: 1;
  border-color: rgb(209 213 219 / var(--tw-border-opacity));
}

.border-gray-200 {
  --tw-border-opacity: 1;
  border-color: rgb(229 231 235 / var(--tw-border-opacity));
}

.border-transparent {
  border-color: transparent;
}

.bg-gray-100 {
  --tw-bg-opacity: 1;
  background-color: rgb(243 244 246 / var(--tw-bg-opacity));
}

.bg-gray-200 {
  --tw-bg-opacity: 1;
  background-color: rgb(229 231 235 / var(--tw-bg-opacity));
}

.px-6 {
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.py-12 {
  padding-top: 3rem;
  padding-bottom: 3rem;
}

.py-8 {
  padding-top: 2rem;
  padding-bottom: 2rem;
}

.px-0\.5 {
  padding-left: 0.125rem;
  padding-right: 0.125rem;
}

.px-0 {
  padding-left: 0px;
  padding-right: 0px;
}

.text-4xl {
  font-size: 2.25rem;
  line-height: 2.5rem;
}

.text-lg {
  font-size: 1.125rem;
  line-height: 1.75rem;
}

.text-2xl {
  font-size: 1.5rem;
  line-height: 2rem;
}

.font-bold {
  font-weight: 700;
}

.text-gray-900 {
  --tw-text-opacity: 1;
  color: rgb(17 24 39 / var(--tw-text-opacity));
}

.text-gray-600 {
  --tw-text-opacity: 1;
  color: rgb(75 85 99 / var(--tw-text-opacity));
}

.text-gray-700 {
  --tw-text-opacity: 1;
  color: rgb(55 65 81 / var(--tw-text-opacity));
}

.text-blue-600 {
  --tw-text-opacity: 1;
  color: rgb(79 70 229 / var(--tw-text-opacity));
}

.text-black {
  --tw-text-opacity: 1;
  color: rgb(0 0 0 / var(--tw-text-opacity));
}

.text-gray-500 {
  --tw-text-opacity: 1;
  color: rgb(107 114 128 / var(--tw-text-opacity));
}

.underline {
  -webkit-text-decoration-line: underline;
          text-decoration-line: underline;
}

.antialiased {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.shadow-sm {
  --tw-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color);
  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
}

.focus\:border-blue-300:focus {
  --tw-border-opacity: 1;
  border-color: rgb(165 180 252 / var(--tw-border-opacity));
}

.focus\:border-black:focus {
  --tw-border-opacity: 1;
  border-color: rgb(0 0 0 / var(--tw-border-opacity));
}

.focus\:border-gray-300:focus {
  --tw-border-opacity: 1;
  border-color: rgb(209 213 219 / var(--tw-border-opacity));
}

.focus\:border-gray-500:focus {
  --tw-border-opacity: 1;
  border-color: rgb(107 114 128 / var(--tw-border-opacity));
}

.focus\:border-transparent:focus {
  border-color: transparent;
}

.focus\:bg-white:focus {
  --tw-bg-opacity: 1;
  background-color: rgb(255 255 255 / var(--tw-bg-opacity));
}

.focus\:bg-gray-200:focus {
  --tw-bg-opacity: 1;
  background-color: rgb(229 231 235 / var(--tw-bg-opacity));
}

.focus\:ring:focus {
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(3px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
}

.focus\:ring-0:focus {
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(0px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
}

.focus\:ring-1:focus {
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
}

.focus\:ring-blue-200:focus {
  --tw-ring-opacity: 1;
  --tw-ring-color: rgb(199 210 254 / var(--tw-ring-opacity));
}

.focus\:ring-black:focus {
  --tw-ring-opacity: 1;
  --tw-ring-color: rgb(0 0 0 / var(--tw-ring-opacity));
}

.focus\:ring-gray-500:focus {
  --tw-ring-opacity: 1;
  --tw-ring-color: rgb(107 114 128 / var(--tw-ring-opacity));
}

.focus\:ring-opacity-50:focus {
  --tw-ring-opacity: 0.5;
}

.focus\:ring-offset-0:focus {
  --tw-ring-offset-width: 0px;
}

.focus\:ring-offset-2:focus {
  --tw-ring-offset-width: 2px;
}

@media (min-width: 768px) {
  .md\:max-w-4xl {
    max-width: 56rem;
  }

  .md\:grid-cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<style src="@vueform/multiselect/themes/default.css"></style>
