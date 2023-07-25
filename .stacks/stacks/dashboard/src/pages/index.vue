<template>
  <main class="px-4 sm:px-6 lg:px-8">
    <div class="relative isolate overflow-hidden">
      <!-- Stats -->
      <div class="border-b border-b-gray-900/10 lg:border-t lg:border-t-gray-900/5">
        <dl class="mx-auto grid max-w-7xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:px-2 xl:px-0">
          <div class="flex items-baseline flex-wrap justify-between gap-y-2 gap-x-4 border-t border-gray-900/5 px-4 py-10 sm:px-6 lg:border-t-0 xl:px-8">
            <dt class="text-sm font-medium leading-6 text-gray-500">
              Revenue
            </dt>
            <dd class="text-xs font-medium text-gray-700">
              +4.75%
            </dd>
            <dd class="w-full flex-none text-3xl font-medium leading-10 tracking-tight text-gray-900">
              $405,091.00
            </dd>
          </div>
          <div class="flex items-baseline flex-wrap justify-between gap-y-2 gap-x-4 border-t border-gray-900/5 px-4 py-10 sm:px-6 lg:border-t-0 xl:px-8 sm:border-l">
            <dt class="text-sm font-medium leading-6 text-gray-500">
              Overdue invoices
            </dt>
            <dd class="text-xs font-medium text-rose-600">
              +54.02%
            </dd>
            <dd class="w-full flex-none text-3xl font-medium leading-10 tracking-tight text-gray-900">
              $12,787.00
            </dd>
          </div>
          <div class="flex items-baseline flex-wrap justify-between gap-y-2 gap-x-4 border-t border-gray-900/5 px-4 py-10 sm:px-6 lg:border-t-0 xl:px-8 lg:border-l">
            <dt class="text-sm font-medium leading-6 text-gray-500">
              Outstanding invoices
            </dt>
            <dd class="text-xs font-medium text-gray-700">
              -1.39%
            </dd>
            <dd class="w-full flex-none text-3xl font-medium leading-10 tracking-tight text-gray-900">
              $245,988.00
            </dd>
          </div>
          <div class="flex items-baseline flex-wrap justify-between gap-y-2 gap-x-4 border-t border-gray-900/5 px-4 py-10 sm:px-6 lg:border-t-0 xl:px-8 sm:border-l">
            <dt class="text-sm font-medium leading-6 text-gray-500">
              Expenses
            </dt>
            <dd class="text-xs font-medium text-rose-600">
              +10.18%
            </dd>
            <dd class="w-full flex-none text-3xl font-medium leading-10 tracking-tight text-gray-900">
              $30,156.00
            </dd>
          </div>
        </dl>
      </div>

      <div
        class="absolute left-0 top-full -z-10 mt-96 origin-top-left translate-y-40 -rotate-90 transform-gpu opacity-20 blur-3xl sm:left-1/2 sm:-ml-96 sm:-mt-10 sm:translate-y-0 sm:rotate-0 sm:transform-gpu sm:opacity-50"
        aria-hidden="true"
      >
        <div
          class="aspect-[1154/678] w-[72.125rem] bg-gradient-to-br from-[#FF80B5] to-[#9089FC]"
          style="clip-path: polygon(100% 38.5%, 82.6% 100%, 60.2% 37.7%, 52.4% 32.1%, 47.5% 41.8%, 45.2% 65.6%, 27.5% 23.4%, 0.1% 35.3%, 17.9% 0%, 27.7% 23.4%, 76.2% 2.5%, 74.2% 56%, 100% 38.5%)"
        />
      </div>
    </div>

    <div class="space-y-16 py-16 xl:space-y-20">
      <!-- Recent activity table -->
      <div>
        <div class="mx-auto max-w-7xl">
          <h2 class="mx-auto max-w-2xl text-base font-semibold leading-6 text-gray-900 lg:mx-0 lg:max-w-none">
            Recent activity
          </h2>
        </div>
        <div class="mt-6 overflow-hidden border-t border-gray-100">
          <div class="mx-auto max-w-7xl">
            <div class="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
              <table class="w-full text-left">
                <thead class="sr-only">
                  <tr>
                    <th>Amount</th>
                    <th class="hidden sm:table-cell">
                      Client
                    </th>
                    <th>More details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="text-sm leading-6 text-gray-900">
                    <th
                      scope="colgroup"
                      colspan="3"
                      class="relative isolate py-2 font-semibold"
                    >
                      <time datetime="2023-03-22">Today</time>
                      <div class="absolute inset-y-0 right-full -z-10 w-screen border-b border-gray-200 bg-gray-50" />
                      <div class="absolute inset-y-0 left-0 -z-10 w-screen border-b border-gray-200 bg-gray-50" />
                    </th>
                  </tr>
                  <tr>
                    <td class="relative py-5 pr-6">
                      <div class="flex gap-x-6">
                        <svg
                          class="hidden h-6 w-5 flex-none text-gray-400 sm:block"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.75a.75.75 0 001.5 0V8.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0L6.2 9.74a.75.75 0 101.1 1.02l1.95-2.1v4.59z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        <div class="flex-auto">
                          <div class="flex items-start gap-x-3">
                            <div class="text-sm font-medium leading-6 text-gray-900">
                              $7,600.00 USD
                            </div>
                            <div class="rounded-md py-1 px-2 text-xs font-medium ring-1 ring-inset text-green-700 bg-green-50 ring-green-600/20">
                              Paid
                            </div>
                          </div>
                          <div class="mt-1 text-xs leading-5 text-gray-500">
                            $500.00 tax
                          </div>
                        </div>
                      </div>
                      <div class="absolute bottom-0 right-full h-px w-screen bg-gray-100" />
                      <div class="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
                    </td>
                    <td class="hidden py-5 pr-6 sm:table-cell">
                      <div class="text-sm leading-6 text-gray-900">
                        Reform
                      </div>
                      <div class="mt-1 text-xs leading-5 text-gray-500">
                        Website redesign
                      </div>
                    </td>
                    <td class="py-5 text-right">
                      <div class="flex justify-end">
                        <a
                          href="#"
                          class="text-sm font-medium leading-6 text-indigo-600 hover:text-indigo-500"
                        >View<span class="hidden sm:inline"> transaction</span><span class="sr-only">, invoice #00012, Reform</span></a>
                      </div>
                      <div class="mt-1 text-xs leading-5 text-gray-500">
                        Invoice <span class="text-gray-900">#00012</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="relative py-5 pr-6">
                      <div class="flex gap-x-6">
                        <svg
                          class="hidden h-6 w-5 flex-none text-gray-400 sm:block"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59L7.3 9.24a.75.75 0 00-1.1 1.02l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        <div class="flex-auto">
                          <div class="flex items-start gap-x-3">
                            <div class="text-sm font-medium leading-6 text-gray-900">
                              $10,000.00 USD
                            </div>
                            <div class="rounded-md py-1 px-2 text-xs font-medium ring-1 ring-inset text-gray-600 bg-gray-50 ring-gray-500/10">
                              Withdraw
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="absolute bottom-0 right-full h-px w-screen bg-gray-100" />
                      <div class="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
                    </td>
                    <td class="hidden py-5 pr-6 sm:table-cell">
                      <div class="text-sm leading-6 text-gray-900">
                        Tom Cook
                      </div>
                      <div class="mt-1 text-xs leading-5 text-gray-500">
                        Salary
                      </div>
                    </td>
                    <td class="py-5 text-right">
                      <div class="flex justify-end">
                        <a
                          href="#"
                          class="text-sm font-medium leading-6 text-indigo-600 hover:text-indigo-500"
                        >View<span class="hidden sm:inline"> transaction</span><span class="sr-only">, invoice #00011, Tom Cook</span></a>
                      </div>
                      <div class="mt-1 text-xs leading-5 text-gray-500">
                        Invoice <span class="text-gray-900">#00011</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="relative py-5 pr-6">
                      <div class="flex gap-x-6">
                        <svg
                          class="hidden h-6 w-5 flex-none text-gray-400 sm:block"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        <div class="flex-auto">
                          <div class="flex items-start gap-x-3">
                            <div class="text-sm font-medium leading-6 text-gray-900">
                              $2,000.00 USD
                            </div>
                            <div class="rounded-md py-1 px-2 text-xs font-medium ring-1 ring-inset text-red-700 bg-red-50 ring-red-600/10">
                              Overdue
                            </div>
                          </div>
                          <div class="mt-1 text-xs leading-5 text-gray-500">
                            $130.00 tax
                          </div>
                        </div>
                      </div>
                      <div class="absolute bottom-0 right-full h-px w-screen bg-gray-100" />
                      <div class="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
                    </td>
                    <td class="hidden py-5 pr-6 sm:table-cell">
                      <div class="text-sm leading-6 text-gray-900">
                        Tuple
                      </div>
                      <div class="mt-1 text-xs leading-5 text-gray-500">
                        Logo design
                      </div>
                    </td>
                    <td class="py-5 text-right">
                      <div class="flex justify-end">
                        <a
                          href="#"
                          class="text-sm font-medium leading-6 text-indigo-600 hover:text-indigo-500"
                        >View<span class="hidden sm:inline"> transaction</span><span class="sr-only">, invoice #00009, Tuple</span></a>
                      </div>
                      <div class="mt-1 text-xs leading-5 text-gray-500">
                        Invoice <span class="text-gray-900">#00009</span>
                      </div>
                    </td>
                  </tr>

                  <tr class="text-sm leading-6 text-gray-900">
                    <th
                      scope="colgroup"
                      colspan="3"
                      class="relative isolate py-2 font-semibold"
                    >
                      <time datetime="2023-03-21">Yesterday</time>
                      <div class="absolute inset-y-0 right-full -z-10 w-screen border-b border-gray-200 bg-gray-50" />
                      <div class="absolute inset-y-0 left-0 -z-10 w-screen border-b border-gray-200 bg-gray-50" />
                    </th>
                  </tr>
                  <tr>
                    <td class="relative py-5 pr-6">
                      <div class="flex gap-x-6">
                        <svg
                          class="hidden h-6 w-5 flex-none text-gray-400 sm:block"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.75a.75.75 0 001.5 0V8.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0L6.2 9.74a.75.75 0 101.1 1.02l1.95-2.1v4.59z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        <div class="flex-auto">
                          <div class="flex items-start gap-x-3">
                            <div class="text-sm font-medium leading-6 text-gray-900">
                              $14,000.00 USD
                            </div>
                            <div class="rounded-md py-1 px-2 text-xs font-medium ring-1 ring-inset text-green-700 bg-green-50 ring-green-600/20">
                              Paid
                            </div>
                          </div>
                          <div class="mt-1 text-xs leading-5 text-gray-500">
                            $900.00 tax
                          </div>
                        </div>
                      </div>
                      <div class="absolute bottom-0 right-full h-px w-screen bg-gray-100" />
                      <div class="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
                    </td>
                    <td class="hidden py-5 pr-6 sm:table-cell">
                      <div class="text-sm leading-6 text-gray-900">
                        SavvyCal
                      </div>
                      <div class="mt-1 text-xs leading-5 text-gray-500">
                        Website redesign
                      </div>
                    </td>
                    <td class="py-5 text-right">
                      <div class="flex justify-end">
                        <a
                          href="#"
                          class="text-sm font-medium leading-6 text-indigo-600 hover:text-indigo-500"
                        >View<span class="hidden sm:inline"> transaction</span><span class="sr-only">, invoice #00010, SavvyCal</span></a>
                      </div>
                      <div class="mt-1 text-xs leading-5 text-gray-500">
                        Invoice <span class="text-gray-900">#00010</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent client list -->
      <div class="mx-auto max-w-7xl">
        <div class="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold leading-7 text-gray-900">
              Recent clients
            </h2>
            <a
              href="#"
              class="text-sm font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
            >View all<span class="sr-only">, clients</span></a>
          </div>
          <ul
            role="list"
            class="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-3 xl:gap-x-8"
          >
            <li class="overflow-hidden rounded-xl border border-gray-200">
              <div class="flex items-center gap-x-4 border-b border-gray-900/5 bg-gray-50 p-6">
                <img
                  src="https://tailwindui.com/img/logos/48x48/tuple.svg"
                  alt="Tuple"
                  class="h-12 w-12 flex-none rounded-lg bg-white object-cover ring-1 ring-gray-900/10"
                >
                <div class="text-sm font-medium leading-6 text-gray-900">
                  Tuple
                </div>
                <div class="relative ml-auto">
                  <button
                    id="options-menu-0-button"
                    type="button"
                    class="-m-2.5 block p-2.5 text-gray-400 hover:text-gray-500"
                    aria-expanded="false"
                    aria-haspopup="true"
                  >
                    <span class="sr-only">Open options</span>
                    <svg
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                    </svg>
                  </button>

                  <!--
                  Dropdown menu, show/hide based on menu state.

                  Entering: "transition ease-out duration-100"
                    From: "transform opacity-0 scale-95"
                    To: "transform opacity-100 scale-100"
                  Leaving: "transition ease-in duration-75"
                    From: "transform opacity-100 scale-100"
                    To: "transform opacity-0 scale-95"
                -->
                  <div
                    class="absolute right-0 z-10 mt-0.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none hidden"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="options-menu-0-button"
                    tabindex="-1"
                  >
                    <!-- Active: "bg-gray-50", Not Active: "" -->
                    <a
                      id="options-menu-0-item-0"
                      href="#"
                      class="block px-3 py-1 text-sm leading-6 text-gray-900"
                      role="menuitem"
                      tabindex="-1"
                    >View<span class="sr-only">, Tuple</span></a>
                    <a
                      id="options-menu-0-item-1"
                      href="#"
                      class="block px-3 py-1 text-sm leading-6 text-gray-900"
                      role="menuitem"
                      tabindex="-1"
                    >Edit<span class="sr-only">, Tuple</span></a>
                  </div>
                </div>
              </div>
              <dl class="-my-3 divide-y divide-gray-100 px-6 py-4 text-sm leading-6">
                <div class="flex justify-between gap-x-4 py-3">
                  <dt class="text-gray-500">
                    Last invoice
                  </dt>
                  <dd class="text-gray-700">
                    <time datetime="2022-12-13">December 13, 2022</time>
                  </dd>
                </div>
                <div class="flex justify-between gap-x-4 py-3">
                  <dt class="text-gray-500">
                    Amount
                  </dt>
                  <dd class="flex items-start gap-x-2">
                    <div class="font-medium text-gray-900">
                      $2,000.00
                    </div>
                    <div class="rounded-md py-1 px-2 text-xs font-medium ring-1 ring-inset text-red-700 bg-red-50 ring-red-600/10">
                      Overdue
                    </div>
                  </dd>
                </div>
              </dl>
            </li>
            <li class="overflow-hidden rounded-xl border border-gray-200">
              <div class="flex items-center gap-x-4 border-b border-gray-900/5 bg-gray-50 p-6">
                <img
                  src="https://tailwindui.com/img/logos/48x48/savvycal.svg"
                  alt="SavvyCal"
                  class="h-12 w-12 flex-none rounded-lg bg-white object-cover ring-1 ring-gray-900/10"
                >
                <div class="text-sm font-medium leading-6 text-gray-900">
                  SavvyCal
                </div>
                <div class="relative ml-auto">
                  <button
                    id="options-menu-1-button"
                    type="button"
                    class="-m-2.5 block p-2.5 text-gray-400 hover:text-gray-500"
                    aria-expanded="false"
                    aria-haspopup="true"
                  >
                    <span class="sr-only">Open options</span>
                    <svg
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                    </svg>
                  </button>

                  <!--
                  Dropdown menu, show/hide based on menu state.

                  Entering: "transition ease-out duration-100"
                    From: "transform opacity-0 scale-95"
                    To: "transform opacity-100 scale-100"
                  Leaving: "transition ease-in duration-75"
                    From: "transform opacity-100 scale-100"
                    To: "transform opacity-0 scale-95"
                -->
                  <div
                    class="absolute right-0 z-10 mt-0.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none hidden"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="options-menu-1-button"
                    tabindex="-1"
                  >
                    <!-- Active: "bg-gray-50", Not Active: "" -->
                    <a
                      id="options-menu-1-item-0"
                      href="#"
                      class="block px-3 py-1 text-sm leading-6 text-gray-900"
                      role="menuitem"
                      tabindex="-1"
                    >View<span class="sr-only">, SavvyCal</span></a>
                    <a
                      id="options-menu-1-item-1"
                      href="#"
                      class="block px-3 py-1 text-sm leading-6 text-gray-900"
                      role="menuitem"
                      tabindex="-1"
                    >Edit<span class="sr-only">, SavvyCal</span></a>
                  </div>
                </div>
              </div>
              <dl class="-my-3 divide-y divide-gray-100 px-6 py-4 text-sm leading-6">
                <div class="flex justify-between gap-x-4 py-3">
                  <dt class="text-gray-500">
                    Last invoice
                  </dt>
                  <dd class="text-gray-700">
                    <time datetime="2023-01-22">January 22, 2023</time>
                  </dd>
                </div>
                <div class="flex justify-between gap-x-4 py-3">
                  <dt class="text-gray-500">
                    Amount
                  </dt>
                  <dd class="flex items-start gap-x-2">
                    <div class="font-medium text-gray-900">
                      $14,000.00
                    </div>
                    <div class="rounded-md py-1 px-2 text-xs font-medium ring-1 ring-inset text-green-700 bg-green-50 ring-green-600/20">
                      Paid
                    </div>
                  </dd>
                </div>
              </dl>
            </li>
            <li class="overflow-hidden rounded-xl border border-gray-200">
              <div class="flex items-center gap-x-4 border-b border-gray-900/5 bg-gray-50 p-6">
                <img
                  src="https://tailwindui.com/img/logos/48x48/reform.svg"
                  alt="Reform"
                  class="h-12 w-12 flex-none rounded-lg bg-white object-cover ring-1 ring-gray-900/10"
                >
                <div class="text-sm font-medium leading-6 text-gray-900">
                  Reform
                </div>
                <div class="relative ml-auto">
                  <button
                    id="options-menu-2-button"
                    type="button"
                    class="-m-2.5 block p-2.5 text-gray-400 hover:text-gray-500"
                    aria-expanded="false"
                    aria-haspopup="true"
                  >
                    <span class="sr-only">Open options</span>
                    <svg
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                    </svg>
                  </button>

                  <!--
                  Dropdown menu, show/hide based on menu state.

                  Entering: "transition ease-out duration-100"
                    From: "transform opacity-0 scale-95"
                    To: "transform opacity-100 scale-100"
                  Leaving: "transition ease-in duration-75"
                    From: "transform opacity-100 scale-100"
                    To: "transform opacity-0 scale-95"
                -->
                  <div
                    class="absolute right-0 z-10 mt-0.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none hidden"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="options-menu-2-button"
                    tabindex="-1"
                  >
                    <!-- Active: "bg-gray-50", Not Active: "" -->
                    <a
                      id="options-menu-2-item-0"
                      href="#"
                      class="block px-3 py-1 text-sm leading-6 text-gray-900"
                      role="menuitem"
                      tabindex="-1"
                    >View<span class="sr-only">, Reform</span></a>
                    <a
                      id="options-menu-2-item-1"
                      href="#"
                      class="block px-3 py-1 text-sm leading-6 text-gray-900"
                      role="menuitem"
                      tabindex="-1"
                    >Edit<span class="sr-only">, Reform</span></a>
                  </div>
                </div>
              </div>
              <dl class="-my-3 divide-y divide-gray-100 px-6 py-4 text-sm leading-6">
                <div class="flex justify-between gap-x-4 py-3">
                  <dt class="text-gray-500">
                    Last invoice
                  </dt>
                  <dd class="text-gray-700">
                    <time datetime="2023-01-23">January 23, 2023</time>
                  </dd>
                </div>
                <div class="flex justify-between gap-x-4 py-3">
                  <dt class="text-gray-500">
                    Amount
                  </dt>
                  <dd class="flex items-start gap-x-2">
                    <div class="font-medium text-gray-900">
                      $7,600.00
                    </div>
                    <div class="rounded-md py-1 px-2 text-xs font-medium ring-1 ring-inset text-green-700 bg-green-50 ring-green-600/20">
                      Paid
                    </div>
                  </dd>
                </div>
              </dl>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </main>
</template>
