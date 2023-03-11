<script setup lang="ts">
const {
  webpage,
} = defineProps<Props>()

interface Props {
  webpage: object | any
}

const webpageData = ref({
  first_name: '',
  last_name: '',
  subdomain: '',
  email_address: '',
  phone: '',
  state: '',
  city: '',
  postal_code: '',
  carecompare_purl: '',
})

onMounted(() => {
  webpageData.value = webpage
})

const fullName = computed(() => {
  return `${webpage.first_name} ${webpage.last_name}`
})
</script>

<template>
  <div class="mt-8">
    <div class="lg:flex">
      <div
        class="p-4 bg-white divide-y divide-gray-200 rounded-md md:p-10 lg:w-2/3 dark:bg-gray-700"
      >
        <div>
          <div class="divide-y divide-gray-200 sm:space-y-5">
            <div>
              <div>
                <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
                  Business Card Ordering Process
                </h3>
                <p class="max-w-2xl mt-1 text-sm text-gray-500 dark:text-gray-400">
                  CareFree Insurances provides Ready to Sell Agents a way to
                  order compliant and professional business cards at a
                  discounted price. Complete the form below to order and provide
                  payment information.
                </p>
                <p class="max-w-2xl mt-1 text-sm text-gray-500 dark:text-gray-400">
                  To make any text changes please contact CareFree at (888)
                  549-4800.
                </p>
              </div>

              <div class="mt-6 space-y-6 sm:mt-5 sm:space-y-5">
                <div
                  class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-center sm:border-t sm:border-gray-200 sm:pt-5"
                >
                  <label
                    for="photo"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Agent Picture (Required)
                  </label>
                  <div class="mt-1 sm:mt-0 sm:col-span-2">
                    <div class="flex items-center">
                      <span
                        class="w-12 h-12 overflow-hidden bg-gray-100 rounded-full "
                      >
                        <svg
                          class="w-full h-full text-gray-300"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      </span>
                      <button
                        type="button"
                        class="ml-4 secondary-button"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
                >
                  <label
                    for="cover-photo"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
                  >
                    Secondary Logo (Optional)
                  </label>
                  <div class="mt-1 sm:mt-0 sm:col-span-2">
                    <div class="flex items-center">
                      <span
                        class="w-12 h-12 overflow-hidden bg-gray-100 rounded-full "
                      >
                        <svg
                          class="w-full h-full text-gray-300"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      </span>
                      <button
                        type="button"
                        class="ml-4 secondary-button"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div class="space-y-6 sm:space-y-5">
                <div
                  class="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:pt-5"
                >
                  <label
                    for="first-name"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
                  >
                    First name
                  </label>
                  <div class="mt-1 sm:mt-0 sm:col-span-2">
                    <input
                      id="first-name"
                      v-model="webpageData.first_name"
                      type="text"
                      name="first-name"
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                    >
                  </div>
                </div>

                <div
                  class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
                >
                  <label
                    for="last-name"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
                  >
                    Last name
                  </label>
                  <div class="mt-1 sm:mt-0 sm:col-span-2">
                    <input
                      id="last-name"
                      v-model="webpageData.last_name"
                      type="text"
                      name="last-name"
                      autocomplete="family-name"
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                    >
                  </div>
                </div>

                <div
                  class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
                >
                  <label
                    for="email"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
                  >
                    Email address
                  </label>
                  <div class="mt-1 sm:mt-0 sm:col-span-2">
                    <input
                      id="email"
                      v-model="webpageData.email_address"
                      type="text"
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                    >
                  </div>
                </div>

                <div
                  class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
                >
                  <label
                    for="phone"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
                  >
                    Phone
                  </label>
                  <div class="mt-1 sm:mt-0 sm:col-span-2">
                    <input
                      id="phone"
                      v-model="webpageData.phone"
                      type="text"
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                    >
                  </div>
                </div>

                <div
                  class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
                >
                  <label
                    for="subdomain"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
                  >
                    Agent Website
                  </label>
                  <div class="mt-1 sm:mt-0 sm:col-span-2">
                    <input
                      id="subdomain"
                      v-model="webpageData.subdomain"
                      type="text"
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                    >
                  </div>
                </div>
                <div
                  class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
                >
                  <span class="flex flex-col flex-grow">
                    <span
                      id="availability-label"
                      class="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >Display URL</span>
                  </span>
                  <!-- Enabled: "bg-teal-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex flex-shrink-0 h-6 transition-colors duration-200 ease-in-out bg-gray-200 border-2 border-transparent rounded-full cursor-pointer w-11 focus:outline-none focus:ring-2 focus:ring-offset-2 "
                    role="switch"
                    aria-checked="false"
                    aria-labelledby="availability-label"
                    aria-describedby="availability-description"
                  >
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="inline-block w-5 h-5 transition duration-200 ease-in-out transform translate-x-0 bg-white rounded-full shadow pointer-events-none ring-0"
                    />
                  </button>
                </div>

                <div
                  class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
                >
                  <span class="flex flex-col flex-grow">
                    <span
                      id="availability-label"
                      class="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >Card Language</span>
                  </span>
                  <!-- Enabled: "bg-teal-600", Not Enabled: "bg-gray-200" -->
                  <!-- This example requires Tailwind CSS v2.0+ -->
                  <!-- Enabled: "bg-teal-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex flex-shrink-0 w-16 h-8 transition-colors duration-200 ease-in-out bg-gray-200 border-2 border-transparent rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-502"
                    role="switch"
                    aria-checked="false"
                  >
                    <span class="sr-only">Use setting</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      class="relative inline-block transition duration-200 ease-in-out transform translate-x-0 bg-white rounded-full shadow pointer-events-none w-7 h-7 ring-0"
                    >
                      <!-- Enabled: "opacity-0 ease-out duration-100", Not Enabled: "opacity-100 ease-in duration-200" -->
                      <span
                        class="absolute inset-0 flex items-center justify-center w-full h-full text-xs transition-opacity duration-200 ease-in opacity-100 "
                        aria-hidden="true"
                      >
                        en
                      </span>
                      <!-- Enabled: "opacity-100 ease-in duration-200", Not Enabled: "opacity-0 ease-out duration-100" -->
                      <span
                        class="absolute inset-0 flex items-center justify-center w-full h-full text-xs transition-opacity duration-100 ease-out opacity-0 "
                        aria-hidden="true"
                      >
                        es
                      </span>
                    </span>
                  </button>
                </div>
                <div class="sm:border-t sm:border-gray-200 sm:pt-5">
                  <span class="flex flex-col flex-grow">
                    <span
                      id="availability-label"
                      class="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >Select a template</span>
                  </span>

                  <div class="flex items-center pt-5">
                    <div class="w-1/4 pr-2">
                      <button class="flex border rounded active-card">
                        <img
                          src="https://carefreeagency.com/images/dev/v2/card-builder/cfa-bc-e-01.png"
                          alt=""
                          class="w-full"
                        >
                      </button>
                    </div>
                    <div class="w-1/4 pr-2">
                      <button class="flex border rounded">
                        <img
                          src="https://carefreeagency.com/images/dev/v2/card-builder/cfa-bc-e-02.png"
                          alt=""
                          class="w-full"
                        >
                      </button>
                    </div>
                    <div class="w-1/4 pr-2">
                      <button class="flex border rounded">
                        <img
                          src="https://carefreeagency.com/images/dev/v2/card-builder/cfa-bc-e-03.png"
                          alt=""
                          class="w-full"
                        >
                      </button>
                    </div>
                    <div class="w-1/4 pr-2">
                      <button class="flex border rounded">
                        <img
                          src="https://carefreeagency.com/images/dev/v2/card-builder/cfa-bc-e-04.png"
                          alt=""
                          class="w-full"
                        >
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="p-6 mt-8 space-y-10 rounded-md lg:mt-0 lg:ml-4 lg:w-1/3 h-1/2 bg-carefree-blue-1">
        <h2 class="text-lg font-semibold text-center text-gray-50">
          Business Card Preview
        </h2>
        <div>
          <div class="flex flex-wrap w-full">
            <div
              class="relative w-full text-gray-900 bg-white rounded-lg shadow-md"
            >
              <!---->
              <div class="flex w-full">
                <img
                  src="https://carefreeagency.com/images/cfa-business-card-swoosh.svg"
                  alt=""
                  class="w-full"
                >
              </div>
              <div class="flex w-full px-2 pb-2">
                <div class="w-full">
                  <p class="flex flex-col mb-2">
                    <span class="text-xs font-bold">{{ fullName }}</span>
                    <span class="text-xs font-base">Medicare Sales Consultant</span>
                  </p>
                  <p class="flex flex-col">
                    <span class="text-xs font-base">{{ webpage.phone }}</span>
                    <span class="text-xs font-base">{{ webpage.email_address }}</span>
                    <span class="text-xs font-base">{{ webpage.subdomain }}</span>
                  </p>
                </div>
                <!---->
              </div>
            </div>
          </div>
        </div>

        <div>
          <label class="text-sm font-semibold uppercase text-gray text-gray-50">type</label>
          <select
            id="quantity"
            name="quantity"
            autocomplete="quantity"
            class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
          >
            <option>500</option>
            <option>1000</option>
          </select>
        </div>

        <div>
          <label class="text-sm font-semibold uppercase text-gray text-gray-50">Type</label>
          <select
            id="type"
            name="type"
            autocomplete="type"
            class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
          >
            <option>Matte</option>
            <option>Gloss</option>
          </select>
        </div>
        <div>
          <span class="font-semibold text-gray-50">Price: <span class="font-normal"> $25.00 </span></span>
        </div>

        <div class="flex justify-center">
          <button
            type="button"
            class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <!-- Heroicon name: solid/mail -->
            <svg
              class="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path
                fill-rule="evenodd"
                d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
                clip-rule="evenodd"
              />
            </svg>
            Order Card
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
