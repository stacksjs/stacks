<script setup lang="ts">
import { useEventStore } from '~/stores/event'

const route = useRoute()
const router = useRouter()
const eventStore = useEventStore()

const errors = ref({} as any)

const eventData = ref({
  title: '',
  name: '',
  name_spanish: '',
  content: '',
  short_description: '',
  timezone: '',
  link: '',
  salesforce_id: '',
  location: '',
  address: '',
  city: '',
  zip_code: '',
  state: '',
  region: '',
  category: '',
  image_url: '',
  is_spanish: false,
  is_active: false,
  is_training: false,
  all_day: false,
  npn_not_required: false,
  is_carecompare: false,
  public: false,
  is_testing: false,
  is_wv: false,
  attendees_limit: false,
  webex_password: '',
  date: null,
  start_time: null,
  end_time: null,
  tracking_code_pre: '',
  tracking_code_post: '',
  datetimes: [] as any[],
})

const toast = useToast()
const dateFields = ref([] as any[])

onMounted(async () => {
  await fetchEvent()
})

async function fetchEvent() {
  await eventStore.fetchEvent(route.params.id)

  eventData.value = eventStore.event
  eventData.value.date = eventStore.event.date.date
  eventData.value.start_time = eventStore.event.time.start_time
  eventData.value.end_time = eventStore.event.time.end_time

  dateFields.value = eventStore.event.times.map((time: any) => {
    const date = eventStore.event.dates.find((date: any) => date.id === time.event_date_id)

    return {
      start_time: time.start_time,
      end_time: time.end_time,
      time_id: time.id,
      date_id: date.id,
      date: date.date,
    }
  })
}

async function updateEvent() {
  eventData.value.image_url = ''
  eventData.value.tracking_code_pre = ''
  eventData.value.tracking_code_post = ''
  eventData.value.datetimes = dateFields.value

  try {
    await eventStore.updateEvent(route.params.id, eventData.value)

    await toast.success({ text: 'Successfully updated event!' })

    router.push({ name: 'events' })
  }
  catch (err: any) {
    errors.value = err.data.errors
  }
}

function addDate() {
  dateFields.value.push({ date: null, start_time: null, end_time: null })
}
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <main class="flex-1">
        <TopBar />

        <div
          v-if="eventData"
          class="bg-gray-100 dark:bg-gray-800"
        >
          <div class="max-w-5xl px-4 py-12 mx-auto sm:px-6 lg:px-8">
            <div class="relative">
              <div class="flex">
                <button
                  class="text-gray-400 hover:text-gray-600"
                  @click="router.go(-1)"
                >
                  <svg
                    fill="none"
                    stroke="currentColor"
                    class="w-6 h-6"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                    />
                  </svg>
                </button>

                <h2 class="pl-4 text-xl font-semibold text-gray-700 dark:text-gray-200">
                  Update Event
                </h2>
              </div>

              <div
                class="p-10 mt-4 bg-white rounded-lg dark:bg-gray-700"
              >
                <div class="flex">
                  <div class="w-1/3">
                    <h3 class="text-lg leading-6 text-gray-600 dark:text-gray-200">
                      General Information
                    </h3>

                    <p class="max-w-2xl mt-1 text-sm text-gray-500 dark:text-gray-400">
                      General information like event name, URL, venue capacity.
                    </p>
                  </div>
                  <div class="w-2/3 pl-8">
                    <div class="flex flex-col">
                      <div class="pb-5">
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Name</span>
                        </div>
                        <div
                          class="flex-1"
                        >
                          <input
                            v-model="eventData.name"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >
                        </div>
                      </div>

                      <div class="py-5">
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >URL</span>
                        </div>
                        <div
                          class="flex-1"
                        >
                          <input
                            v-model="eventData.title"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >

                          <span
                            v-if="!isEmpty(errors)"
                            class="text-xs text-red-500"
                          >
                            {{ getError(errors, 'title', 'URL is required.') }}
                          </span>
                        </div>
                      </div>

                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Name Spanish (Optional)</span>
                        </div>
                        <div
                          class="flex-1"
                        >
                          <input
                            v-model="eventData.name_spanish"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >
                        </div>
                      </div>

                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Salesforce ID</span>
                        </div>
                        <div
                          class="flex-1"
                        >
                          <input
                            v-model="eventData.salesforce_id"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >
                        </div>
                      </div>
                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Region</span>
                        </div>
                        <div
                          class="flex-1"
                        >
                          <input
                            v-model="eventData.region"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >
                        </div>
                      </div>
                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Event Link</span>
                        </div>
                        <div
                          class="flex-1"
                        >
                          <input
                            v-model="eventData.link"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >
                        </div>
                      </div>

                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Event Password</span>
                        </div>
                        <div
                          class="flex-1"
                        >
                          <input
                            v-model="eventData.webex_password"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >
                        </div>
                      </div>
                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Max Venue Capacity</span>
                        </div>
                        <div
                          class="flex-1"
                        >
                          <input
                            v-model="eventData.attendees_limit"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >
                        </div>
                      </div>
                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >
                            Short Description
                          </span>
                        </div>
                        <div
                          class="flex-1"
                        >
                          <textarea
                            v-model="eventData.short_description"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          />
                        </div>
                      </div>
                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Category</span>
                        </div>
                        <div>
                          <select
                            id="category"
                            v-model="eventData.category"
                            name="category"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                            :required="hasError(errors, 'category')"
                          >
                            <option
                              value="In Person"
                            >
                              In Person
                            </option>
                            <option
                              value="Webinar"
                            >
                              Webinar
                            </option>
                          </select>
                        </div>
                      </div>
                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Timezone</span>
                        </div>
                        <div>
                          <select
                            id="timezone"
                            v-model="eventData.timezone"
                            name="timezone"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                            :required="hasError(errors, 'timezone')"
                          >
                            <option
                              value=""
                            >
                              Select a timezone
                            </option>
                            <option
                              value="CDT"
                            >
                              CDT
                            </option>
                            <option
                              value="CST"
                            >
                              CST
                            </option>
                            <option
                              value="EDT"
                            >
                              EDT
                            </option>
                            <option
                              value="EST"
                            >
                              EST
                            </option>
                            <option
                              value="MDT"
                            >
                              MDT
                            </option>
                            <option
                              value="MST"
                            >
                              MST
                            </option>
                            <option
                              value="PDT"
                            >
                              PDT
                            </option>
                            <option
                              value="PST"
                            >
                              PST
                            </option>
                            <option
                              value="UTC"
                            >
                              UTC
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="mb-5 border-gray-300 opacity-50 divider-line dark:border-gray-500 dark:opacity-50" />
                <div>
                  <div class="flex">
                    <div class="w-1/3">
                      <div>
                        <h3 class="text-lg leading-6 text-gray-600 dark:text-gray-200">
                          Location
                        </h3>
                        <p class="max-w-2xl mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Event location where the event where be held.
                        </p>
                      </div>
                    </div>
                    <div class="w-2/3 pl-8">
                      <div
                        class="pb-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Location</span>
                        </div>
                        <div>
                          <input
                            v-model="eventData.location"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >

                          <span
                            v-if="!isEmpty(errors)"
                            class="text-xs text-red-500"
                          >
                            {{ getError(errors, 'location') }}
                          </span>
                        </div>
                      </div>

                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Address</span>
                        </div>
                        <div>
                          <input
                            v-model="eventData.address"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >

                          <span
                            v-if="!isEmpty(errors)"
                            class="text-xs text-red-500"
                          >
                            {{ getError(errors, 'address') }}
                          </span>
                        </div>
                      </div>
                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >City</span>
                        </div>
                        <div>
                          <input
                            v-model="eventData.city"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >

                          <span
                            v-if="!isEmpty(errors)"
                            class="text-xs text-red-500"
                          >
                            {{ getError(errors, 'location') }}
                          </span>
                        </div>
                      </div>
                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >State</span>
                        </div>
                        <div>
                          <select
                            id="state"
                            v-model="eventData.state"
                            name="state"
                            class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                          >
                            <option
                              v-for="(state, index) in states"
                              :key="index"
                              :value="state.abbreviation"
                            >
                              {{ state.name }}
                            </option>
                          </select>

                          <span
                            v-if="!isEmpty(errors)"
                            class="text-xs text-red-500"
                          >
                            {{ getError(errors, 'state') }}
                          </span>
                        </div>
                      </div>
                      <div
                        class="py-5"
                      >
                        <div>
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Zip</span>
                        </div>
                        <div>
                          <input
                            v-model="eventData.zip_code"
                            type="text"
                            class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                          >
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="mb-5 border-gray-300 opacity-50 divider-line dark:border-gray-500 dark:opacity-50" />
                <div
                  class="pb-4 mt-8"
                >
                  <div class="flex">
                    <div class="w-1/3">
                      <div>
                        <h3 class="text-lg leading-6 text-gray-600 dark:text-gray-200">
                          Date
                        </h3>
                        <p class="max-w-2xl mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Event date and time.
                        </p>
                      </div>
                    </div>
                    <div class="w-2/3 pl-8">
                      <div
                        v-for="(input, index) in dateFields"
                        :key="index"
                        class="flex items-start w-full pb-4 space-x-4"
                      >
                        <div class="w-full">
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Date</span>
                          <div>
                            <input
                              v-model="input.date"
                              type="date"
                              class="h-10.5 block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                            >
                          </div>

                          <span
                            v-if="!isEmpty(errors)"
                            class="text-xs text-red-500"
                          >
                            {{ getError(errors, 'date') }}
                          </span>
                        </div>

                        <div class="w-full">
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >Start Time</span>
                          <div>
                            <input
                              v-model="input.start_time"
                              type="time"
                              class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                            >

                            <span
                              v-if="!isEmpty(errors)"
                              class="text-xs text-red-500"
                            >
                              {{ getError(errors, 'start_time') }}
                            </span>
                          </div>
                        </div>
                        <div class="w-full">
                          <span
                            class="text-sm font-semibold text-gray-700 dark:text-gray-200"
                          >End Time</span>
                          <div>
                            <input
                              v-model="input.end_time"
                              type="time"
                              class="block mt-1.5 w-full required:border-red-500 px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;s"
                            >

                            <span
                              v-if="!isEmpty(errors)"
                              class="text-xs text-red-500"
                            >
                              {{ getError(errors, 'end_time') }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="flex justify-end pl-12 mt-4">
                    <button
                      class="w-2/3 secondary-button"
                      @click="addDate"
                    >
                      Add Date

                      <svg
                        class="w-5 h-5 ml-1 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="mb-5 border-gray-300 opacity-75 divider-line dark:border-gray-500 dark:opacity-50" />
                <div>
                  <div class="flex">
                    <div class="w-1/3">
                      <div>
                        <h3 class="text-lg leading-6 text-gray-600 dark:text-gray-200">
                          Other Information
                        </h3>
                        <p class="max-w-2xl mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Event configurations.
                        </p>
                      </div>
                    </div>
                    <div class="w-2/3 pl-8">
                      <div
                        class="flex space-x-24"
                      >
                        <fieldset
                          class="space-y-5"
                        >
                          <div
                            class="relative flex items-start"
                          >
                            <div
                              class="flex items-center h-5"
                            >
                              <input
                                id="active-event"
                                v-model="eventData.is_active"
                                type="checkbox"
                                class="w-4 h-4 border-gray-300 rounded cursor-pointer text-custom-blue focus:ring-custom-blue"
                              >
                            </div>
                            <div
                              class="ml-3 text-sm"
                            >
                              <label
                                for="active-event"
                                class="font-semibold text-gray-700 cursor-pointer dark:text-gray-200 dark:text-gray-300"
                              >Active Event</label>
                            </div>
                          </div>
                          <div
                            class="relative flex items-start"
                          >
                            <div
                              class="flex items-center h-5"
                            >
                              <input
                                id="meet-greet"
                                v-model="eventData.is_wv"
                                type="checkbox"
                                class="w-4 h-4 border-gray-300 rounded cursor-pointer text-custom-blue focus:ring-custom-blue"
                              >
                            </div>
                            <div
                              class="ml-3 text-sm"
                            >
                              <label
                                for="meet-greet"
                                class="font-semibold text-gray-700 cursor-pointer dark:text-gray-200 dark:text-gray-300"
                              >Meet and Greet</label>
                            </div>
                          </div>
                          <div
                            class="relative flex items-start"
                          >
                            <div
                              class="flex items-center h-5"
                            >
                              <input
                                id="test-event"
                                v-model="eventData.is_testing"
                                type="checkbox"
                                class="w-4 h-4 border-gray-300 rounded cursor-pointer text-custom-blue focus:ring-custom-blue"
                              >
                            </div>
                            <div
                              class="ml-3 text-sm"
                            >
                              <label
                                for="test-event"
                                class="font-semibold text-gray-700 cursor-pointer dark:text-gray-200 dark:text-gray-300"
                              >Test Event</label>
                            </div>
                          </div>
                          <div
                            class="relative flex items-start"
                          >
                            <div
                              class="flex items-center h-5"
                            >
                              <input
                                id="spanish-event"
                                v-model="eventData.is_spanish"
                                type="checkbox"
                                class="w-4 h-4 border-gray-300 rounded cursor-pointer text-custom-blue focus:ring-custom-blue"
                              >
                            </div>
                            <div
                              class="ml-3 text-sm"
                            >
                              <label
                                for="spanish-event"
                                class="font-semibold text-gray-700 cursor-pointer dark:text-gray-200 dark:text-gray-300"
                              >Spanish Event</label>
                            </div>
                          </div>
                        </fieldset>
                        <fieldset
                          class="pl-4 space-y-5"
                        >
                          <div
                            class="relative flex items-start"
                          >
                            <div
                              class="flex items-center h-5"
                            >
                              <input
                                id="visible"
                                v-model="eventData.public"
                                type="checkbox"
                                class="w-4 h-4 border-gray-300 rounded cursor-pointer text-custom-blue focus:ring-custom-blue"
                              >
                            </div>
                            <div
                              class="ml-3 text-sm"
                            >
                              <label
                                for="visible"
                                class="font-semibold text-gray-700 cursor-pointer dark:text-gray-200 dark:text-gray-300"
                              >Public Event</label>
                            </div>
                          </div>
                          <div
                            class="relative flex items-start"
                          >
                            <div
                              class="flex items-center h-5"
                            >
                              <input
                                id="npn-required"
                                v-model="eventData.npn_not_required"
                                type="checkbox"
                                class="w-4 h-4 border-gray-300 rounded cursor-pointer text-custom-blue focus:ring-custom-blue"
                              >
                            </div>
                            <div
                              class="ml-3 text-sm"
                            >
                              <label
                                for="npn-required"
                                class="font-semibold text-gray-700 cursor-pointer dark:text-gray-200 dark:text-gray-300"
                              >NPN Not Required</label>
                            </div>
                          </div>
                          <div
                            class="relative flex items-start"
                          >
                            <div
                              class="flex items-center h-5"
                            >
                              <input
                                id="training-event"
                                v-model="eventData.is_training"
                                type="checkbox"
                                class="w-4 h-4 border-gray-300 rounded cursor-pointer text-custom-blue focus:ring-custom-blue"
                              >
                            </div>
                            <div
                              class="ml-3 text-sm"
                            >
                              <label
                                for="training-event"
                                class="font-semibold text-gray-700 cursor-pointer dark:text-gray-200 dark:text-gray-300"
                              >Training Event</label>
                            </div>
                          </div>
                          <div
                            class="relative flex items-start"
                          >
                            <div
                              class="flex items-center h-5"
                            >
                              <input
                                id="all-day"
                                v-model="eventData.all_day"
                                type="checkbox"
                                class="w-4 h-4 border-gray-300 rounded cursor-pointer text-custom-blue focus:ring-custom-blue"
                              >
                            </div>
                            <div
                              class="ml-3 text-sm"
                            >
                              <label
                                for="all-day"
                                class="font-semibold text-gray-700 cursor-pointer dark:text-gray-200 dark:text-gray-300"
                              >All Day Event</label>
                            </div>
                          </div>
                        </fieldset>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="mb-3 border-gray-300 opacity-75 divider-line dark:border-gray-500 dark:opacity-50" />
                <div
                  class="flex justify-end px-4 py-3 space-x-4"
                >
                  <button
                    type="button"
                    class="inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm dark:border-gray-500 dark-hover:bg-gray-500 dark:text-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-custom-blue focus:ring-offset-2 dark:bg-gray-600"
                    @click="router.push({ name: 'events' })"
                  >
                    Cancel
                  </button>

                  <AppButton
                    button-text="Update Event"
                    loading-text="Updating Event..."
                    passed-class="primary-button "
                    @click="updateEvent()"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.event-inputs {
  @apply block mt-1.5 required:border-red-500 w-full px-3 py-2 rounded text-gray-900 border border-gray-300 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-500 focus:outline-none focus:ring-2;
}
</style>
