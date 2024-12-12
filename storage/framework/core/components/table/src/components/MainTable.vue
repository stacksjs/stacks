<script setup lang="ts">
import type { Hits, SearchResponse } from '@stacksjs/types'
import { useTable } from '../functions/table'

interface Props {
  type: string // the Meilisearch index you would like to use for this table
  columns: string | string[] // used as table heads/column titles
  source?: string // optional: the Meilisearch host name/address (defaults: http://127.0.0.1:7700)
  password?: string // optional: the Meilisearch password (defaults: '')
  searchable?: string | boolean // optional: determines whether the table displays the search bar (defaults: true)
  query?: string // optional: the "query" (= search input) used to search the table (defaults: '')
  sortable?: string | boolean // optional: determines whether the table displays the "table head"-sorts (defaults: true)
  sort?: string // optional: the only active sort to be applied to the table (defaults: '')
  sorts?: string | string[] // optional: the specific type of sorts to be applied to the table (defaults: [])
  filterable?: string | boolean // optional: determines whether the table displays the filters component (defaults: true)
  filters?: string | string[] // optional: the specific type of filters to be displayed/utilized in the table (defaults: [])
  actionable?: string | boolean // optional: determines whether the table displays any "action items" (defaults: true)
  actions?: string | string[] // optional: the specific type of actions to be displayed/utilized in the table (defaults: 'Edit, Delete')
  perPage?: string | number // optional: the number of rows (items) to be displayed per page (defaults: 10)
  currentPage?: number // optional: the current page number (defaults: 1)
  selectable?: string | boolean // optional: determines whether the table displays the checkboxes (defaults: true)
  selectedRows?: number[] | string[] // optional: holds the selected rows (defaults: [])
  selectedAll?: boolean // optional: determines whether all the rows are selected (defaults: false)
  results?: SearchResponse<Record<string, any>> // optional: the Meilisearch search response (defaults: {})
  hits?: Hits // optional: the Meilisearch hits (we could also name this "rows" as that would be more applicable to the "table domain" but choosing to stay in sync with Meilisearch right now until we implement for a second search engine driver)
  // stickyHeader?: string | boolean // optional: holds the selected rows (defaults: [])
  // stickyFooter?: string | boolean // optional: determines whether all the rows are selected (defaults: false)
}

const {
  type,
  columns,
  source = 'http://127.0.0.1:7700',
  password = '',
  searchable = true,
  query = '',
  sortable = true,
  sort = '',
  sorts = '',
  filterable = true,
  filters = '',
  actionable = false,

  actions = ['Edit', 'Delete'],
  perPage = 20,
  selectable = true,

  selectedRows = [],
  selectedAll = false,
} = defineProps<Props>()

// const parsedColumns = computed((): string[] => {
//   if (isString(columns))
//     return (columns as string).split(',').map(col => col.trim())

//   return columns as string[]
// })

// const parsedSorts = computed((): string[] => {
//   if (isString(sorts))
//     return (sorts as string).split(',').map(col => col.trim())

//   return sorts as string[]
// })

// const parsedFilters = computed((): string[] => {
//   if (isString(filters))
//     return (filters as string).split(',').map(col => col.trim())

//   return filters as string[]
// })

// const itemsPerPage = computed((): number => {
//   if (isString(perPage))
//     return Number.parseInt(perPage as string)

//   return perPage as number
// })

// let's use (init) the table by passing the default state
const { table } = await useTable()

// let's run the initial search upon page view/load

// console.log('running initial search')
// const results = await search()

// console.log('initial search complete', results)

// now that we have the search results, let's update/set the state of the table
// table.source = source
// table.password = password
// table.hits = results?.hits
// table.type = type
// table.columns = parsedColumns.value
// table.searchable = searchable
// table.query = query
// table.filterable = filterable
// table.filters = parsedFilters.value
// table.sortable = sortable
// table.sort = sort
// table.sorts = parsedSorts.value
// table.perPage = itemsPerPage.value
// table.actionable = actionable
// table.actions = actions
// table.selectable = selectable
// table.selectedRows = selectedRows
// table.selectedAll = selectedAll
// table.results = results as SearchResponse
</script>

<template>
  <div class="px-4 lg:px-8 sm:px-6">
    <Suspense>
      <div class="mt-8 flex flex-col">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 md:px-6">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300">
                <!-- <TableHead /> -->

                dsdsds
              <!-- <TableBody>
                <template #action_column="rowData">
                  <slot
                    name="action_column"
                    :value="rowData.rowData"
                  />
                </template>
                <template
                  v-for="(col, x) in parsedColumns"
                  :key="x"
                  #[columnName(col)]="tableBodyData"
                >
                  <slot
                    :name="columnName(col)"
                    :value="tableBodyData.tableRowData"
                  />
                </template>
              </TableBody> -->
              </table>
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  </div>
</template>

<style>
/* Our reset styles - many thanks to the Tailwind Labs team for gathering many of these */

/*
1. Prevent padding and border from affecting element width. (https://github.com/mozdevs/cssremedy/issues/4)
2. Allow adding a border to an element by just adding a border-width. (https://github.com/tailwindcss/tailwindcss/pull/116)
*/

*,
::before,
::after {
  box-sizing: border-box; /* 1 */
  border-width: 0; /* 2 */
  border-style: solid; /* 2 */
  border-color: currentColor; /* 2 */
}

/*
1. Use a consistent sensible line-height in all browsers.
2. Prevent adjustments of font size after orientation changes in iOS.
3. Use a more readable tab size.
4. Use the user's configured `sans` font-family by default.
*/

html {
  line-height: 1.5; /* 1 */
  -webkit-text-size-adjust: 100%; /* 2 */
  -moz-tab-size: 4; /* 3 */
  tab-size: 4; /* 3 */
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"; /* 4 */
}

/*
Reset links to optimize for opt-in styling instead of opt-out.
*/

a {
  color: inherit;
  text-decoration: inherit;
}

/*
1. Remove text indentation from table contents in Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=999088, https://bugs.webkit.org/show_bug.cgi?id=201297)
2. Correct table border color inheritance in all Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=935729, https://bugs.webkit.org/show_bug.cgi?id=195016)
3. Remove gaps between table borders by default.
*/

table {
  text-indent: 0; /* 1 */
  border-color: inherit; /* 2 */
  border-collapse: collapse; /* 3 */
}

/*
1. Change the font styles in all browsers.
2. Remove the margin in Firefox and Safari.
3. Remove default padding in all browsers.
*/

button,
input,
select {
  font-family: inherit; /* 1 */
  font-size: 100%; /* 1 */
  font-weight: inherit; /* 1 */
  line-height: inherit; /* 1 */
  color: inherit; /* 1 */
  margin: 0; /* 2 */
  padding: 0; /* 3 */
}

/*
Remove the inheritance of text transform in Edge and Firefox.
*/

button,
select {
  text-transform: none;
}

/*
1. Correct the inability to style clickable types in iOS and Safari.
2. Remove default button styles.
*/

button,
[type='button'],
[type='submit'] {
  -webkit-appearance: button; /* 1 */
  background-color: transparent; /* 2 */
  background-image: none; /* 2 */
}

/*
Use the modern Firefox focus style for all focusable elements.
*/

:-moz-focusring {
  outline: auto;
}

/*
Remove the additional `:invalid` styles in Firefox. (https://github.com/mozilla/gecko-dev/blob/2f9eacd9d3d995c937b4251a5557d95d494c9be1/layout/style/res/forms.css#L728-L737)
*/

:-moz-ui-invalid {
  box-shadow: none;
}

/*
Correct the cursor style of increment and decrement buttons in Safari.
*/

::-webkit-inner-spin-button,
::-webkit-outer-spin-button {
  height: auto;
}

/*
1. Correct the odd appearance in Chrome and Safari.
2. Correct the outline style in Safari.
*/

[type='search'] {
  -webkit-appearance: textfield; /* 1 */
  outline-offset: -2px; /* 2 */
}

/*
Remove the inner padding in Chrome and Safari on macOS.
*/

::-webkit-search-decoration {
  -webkit-appearance: none;
}

/*
1. Correct the inability to style clickable types in iOS and Safari.
2. Change font properties to `inherit` in Safari.
*/

::-webkit-file-upload-button {
  -webkit-appearance: button; /* 1 */
  font: inherit; /* 2 */
}

/*
Prevent resizing textareas horizontally by default.
*/

textarea {
  resize: vertical;
}

/*
1. Reset the default placeholder opacity in Firefox. (https://github.com/tailwindlabs/tailwindcss/issues/3300)
2. Set the default placeholder color to the user's configured gray 400 color.
*/

input::placeholder,
textarea::placeholder {
  opacity: 1; /* 1 */
  color: #9ca3af; /* 2 */
}

/*
Set the default cursor for buttons.
*/

button,
[role="button"] {
  cursor: pointer;
}

/*
Make sure disabled buttons don't get the pointer cursor.
*/
:disabled {
  cursor: default;
}
</style>
