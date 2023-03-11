<script lang="ts" setup>
import type { Page } from '~/types'

const allLinks: Page[] = [
  {
    page: '/',
  },
  {
    page: '/contact',
  },
  {
    page: '/about',
  },
  {
    page: '/events',
  },
  {
    page: '/carecompare',
  },
  {
    page: '/carriers',
  },
  {
    page: '/compliance',
  },
  {
    page: '/continuingeducation',
  },
  {
    page: '/reportscenter',
  },
  {
    page: '/agentonboarding',
  },
  {
    page: '/quotes',
  },
  {
    page: '/site-builder',
  },
  {
    page: '/brokersales',
  },
  {
    page: '/services',
  },
  {
    page: '/team',
  },
  {
    page: '/testimonials',
  },
  {
    page: '/whycarefree',
  },
  {
    page: '/trainingevents',
  },
  {
    page: '/virtualmeetandgreet',
  },
  {
    page: '/winners-circle-2023',
  },
  {
    page: '/product',
  },
  {
    page: '/terms',
  },
  {
    page: '/faq',
  },
  {
    page: '/get-contracted',
  },
  {
    page: '/reportscenter\/login',
  },
  {
    page: '/login',
  },
  {
    page: '/aetna',
  },
  {
    page: '/alignment',
  },
  {
    page: '/afsc',
  },
  {
    page: '/amfirst',
  },
  {
    page: '/Anthem',
  },
  {
    page: '/bcbs',
  },
  {
    page: '/brighthealthplan',
  },
  {
    page: '/Cigna',
  },
  {
    page: '/clear-spring',
  },
  {
    page: '/delta',
  },
  {
    page: '/devoted',
  },
  {
    page: '/Empire',
  },
  {
    page: '/FreedomHealth',
  },
  {
    page: '/HealthSun',
  },
  {
    page: '/humana',
  },
  {
    page: '/hap',
  },
  {
    page: '/imperial_insurance',
  },
  {
    page: '/Medica',
  },
  {
    page: '/mhh',
  },
  {
    page: '/Molina',
  },
  {
    page: '/mutual',
  },
  {
    page: '/FreedomOptimum',
  },
  {
    page: '/oscar',
  },
  {
    page: '/PCP',
  },
  {
    page: '/renaissance',
  },
  {
    page: '/Molina',
  },
  {
    page: '/scan',
  },
  {
    page: '/SimplyHealthcare',
  },
  {
    page: '/solis',
  },
  {
    page: '/UHC',
  },
  {
    page: '/vsp',
  },
  {
    page: '/WellCare',
  },
  {
    page: '/MTS_Telesales',
  },
  {
    page: '/MTS_Onboarding',
  },
  {
    page: '/MTS_Medicare',
  },
  {
    page: '/MTS_Sales_Process',
  },
  {
    page: '/MTS_Industry',
  },
  {
    page: '/MTS_Compliance',
  },
  {
    page: '/MTS_Technology',
  },
  {
    page: '/MTS_CSRs',
  },
  {
    page: '/MTS_Onboarding_Csr',
  },
  {
    page: '/MTS_Medicare_Csr',
  },
  {
    page: '/MTS_Sales_Process_Csr',
  },
  {
    page: '/MTS_Compliance_Csr',
  },
  {
    page: '/MTS_Technology_Csr',
  },
  {
    page: '/MTS_Captive_Agents',
  },
  {
    page: '/MSC_Telesales',
  },
  {
    page: '/MSC_Onboarding',
  },
  {
    page: '/MSC_Medicare',
  },
  {
    page: '/MSC_Sales_Process',
  },
  {
    page: '/MSC_Industry',
  },
  {
    page: '/MSC_Compliance',
  },
  {
    page: '/MSC_Technology',
  },
  {
    page: '/MSC_CSRs',
  },
  {
    page: '/MSC_Onboarding_Csr',
  },
  {
    page: '/MSC_Medicare_Csr',
  },
  {
    page: '/MSC_Sales_Process_Csr',
  },
  {
    page: '/MSC_Compliance_Csr',
  },
  {
    page: '/MSC_Technology_Csr',
  },
  {
    page: '/Vendor_Telesales',
  },
  {
    page: '/Vendor_Medicare',
  },
  {
    page: '/Vendor_Sales_Process',
  },
  {
    page: '/Vendor_Industry',
  },
  {
    page: '/Vendor_Compliance',
  },
  {
    page: 'Vendor_Onboarding',
  },
  {
    page: '/CF_Captive',
  },
  {
    page: '/CF_Onboarding',
  },
  {
    page: '/CF_Medicare',
  },
  {
    page: '/CF_Industry',
  },
  {
    page: '/CF_Technology',
  },
  {
    page: '/CF_Sales_Process',
  },
  {
    page: '/CF_Compliance',
  },
  {
    page: '/CF_Relationship',
  },
  {
    page: '/CF_SP',
  },
  {
    page: '/CF_Onboarding_SP',
  },
  {
    page: '/CF_Medicare_SP',
  },
  {
    page: '/CF_Industry_SP',
  },
  {
    page: '/CF_Technology_SP',
  },
  {
    page: '/CF_Sales_Process_SP',
  },
  {
    page: '/CF_Compliance_SP',
  },
  {
    page: '/CF_Relationship_SP',
  },
  {
    page: '/CF_Ind',
  },
  {
    page: '/CF_Ind_Onboarding',
  },
  {
    page: '/CF_Ind_Medicare',
  },
  {
    page: '/CF_Ind_Industry',
  },
  {
    page: '/CF_Ind_Technology',
  },
  {
    page: '/CF_Ind_Sales_Process',
  },
  {
    page: '/CF_Ind_Compliance',
  },
  {
    page: '/CF_Ind_Relationship',
  },
]

const baseUrl = import.meta.env.VITE_API_ROOT_BASE_URL

function sortUrls(urls: Page[]): any[] {
  return (urls.slice().sort(
    (a, b) =>
      a.page.replace('/', '')
        .localeCompare(
          b.page.replace('/', ''),
        ),
  ))
}

function getUrl(link: string) {
  return `${baseUrl}${link}`
}

const dateYesterday = computed(() => {
  const date = new Date()

  date.setDate(date.getDate() - 1)

  const formattedDate = `${date.getFullYear()}-${(`0${date.getMonth() + 1}`).slice(-2)}-${(`0${date.getDate()}`).slice(-2)} ${(`0${date.getHours()}`).slice(-2)}:${(`0${date.getMinutes()}`).slice(-2)}:${(`0${date.getSeconds()}`).slice(-2)}`

  return formattedDate
})
</script>

<template>
  <div class="flex flex-col items-center justify-between dark:border-gray-600 md:flex-row">
    <h3 class="font-semibold">
      Broken Links
    </h3>
    <div class="p-4 rounded-md bg-green-50 dark:bg-green-100">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg
            class="w-5 h-5 text-green-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm font-semibold text-green-800">
            No broken links found on 187 scanned pages.
          </p>
        </div>
      </div>
    </div>
  </div>

  <div class="mt-4 bg-white rounded-lg shadow dark:bg-gray-700">
    <div class="relative px-8">
      <!-- <SectionLoader
        v-if="loading"
        :height="24"
      /> -->
    </div>
    <div
      class="px-4 pb-4"
    >
      <div class="flex flex-col">
        <div class="overflow-x-auto">
          <div class="inline-block min-w-full py-2 align-middle">
            <table
              class="min-w-full divide-y divide-gray-300"
            >
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    URL
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Status Code
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr
                  v-for="(link, index) in sortUrls(allLinks)"
                  :key="index"
                >
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    <a
                      :href="getUrl(link.page)"
                      target="_new"
                    >{{ link.page }}</a>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">{{ 200 }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="flex justify-end pt-4">
    <div class="flex">
      <div class="p-4 rounded-md bg-teal-50 dark:bg-teal-100">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg
              class="w-5 h-5 text-teal-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 7a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 7zM8 4a1 1 0 000 2h.007a1 1 0 000-2H8z" />
              <path
                fill-rule="evenodd"
                d="M0 8a8 8 0 1116 0A8 8 0 010 8zm8-6.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-lg font-semibold text-gray-700">
              <p class="text-sm">
                This table contains all URLs that were crawled at {{ dateYesterday }}
              </p>
            </h3>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
