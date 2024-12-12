<script lang="ts" setup>
useHead({
  title: 'Dashboard - Health',
})
</script>

<template>
  <div
    class="px-4 py-8 lg:px-8 sm:px-6"
  >
    <div
      class="flex items-start"
    >
      <div
        class="w-full"
      >
        <section>
          <div>
            <div
              class="overflow-hidden rounded-lg bg-gray-200 sm:grid sm:grid-cols-2 sm:gap-px divide-y divide-gray-200 dark:bg-blue-gray-600 sm:divide-y-0 dark:divide-gray-600 dark:divide-gray-600"
            >
              <div
                class="group relative bg-white p-6 dark:bg-blue-gray-800"
              >
                <div
                  class="flex items-center space-x-2"
                >
                  <div
                    class="mt-0.5 h-3 w-3 rounded-full bg-green-500"
                  /><h3
                    class="text-lg dark:text-gray-100"
                  >
                    <a
                      href="#"
                      class="hover:text-home-teal-button font-semibold focus:outline-none"
                    > Uptime </a>
                  </h3>
                </div>
                <div
                  class="mt-8"
                >
                  <p
                    class="mt-2 text-sm text-gray-500 dark:text-gray-400"
                  >
                    Your site is up. We last checked less than a minute ago.
                  </p><div>
                    <!----><dl
                      class="grid grid-cols-1 mt-5 overflow-hidden border rounded-lg bg-white md:grid-cols-3 divide-y divide-gray-200 dark:border-gray-500 dark:bg-blue-gray-700 md:divide-x md:divide-y-0 dark:divide-gray-500 dark:divide-gray-600"
                    >
                      <div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          Past 7 Days
                        </dt><dd
                          class="mt-1 flex items-baseline justify-between md:block lg:flex"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            100%
                          </div>
                        </dd>
                      </div><div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          Past 14 Days
                        </dt><dd
                          class="mt-1 flex items-baseline justify-between md:block lg:flex"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            100%
                          </div>
                        </dd>
                      </div><div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          Past 30 Days
                        </dt><dd
                          class="mt-1 flex items-baseline justify-between md:block lg:flex"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            100%
                          </div>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div><div
                class="group relative bg-white p-6 dark:bg-blue-gray-800"
              >
                <div
                  class="flex items-center space-x-2"
                >
                  <div
                    class="mt-0.5 h-3 w-3 rounded-full bg-green-500"
                  /><h3
                    class="text-lg dark:text-gray-100"
                  >
                    <a
                      href="#"
                      class="hover:text-home-teal-button font-semibold focus:outline-none"
                    > Performance </a>
                  </h3>
                </div><div
                  class="mt-8"
                >
                  <p
                    class="mt-2 text-sm text-gray-500 dark:text-gray-400"
                  >
                    We're monitoring the performance of your site. Your site is fast. We last checked 3 minutes ago.
                  </p>
                </div>
              </div><div
                class="group relative bg-white p-6 dark:bg-blue-gray-800"
              >
                <div
                  class="flex items-center space-x-2"
                >
                  <div
                    class="mt-0.5 h-3 w-3 rounded-full bg-green-500"
                  /><h3
                    class="text-lg dark:text-gray-100"
                  >
                    <a
                      href="#"
                      class="hover:text-home-teal-button font-semibold focus:outline-none"
                    > Certificate health </a>
                  </h3>
                </div><div
                  class="mt-8"
                >
                  <p
                    class="mt-2 text-sm text-gray-500 dark:text-gray-400"
                  >
                    Your certificate is healthy. We last checked 3 minutes ago.
                  </p><!----><div>
                    <dl
                      class="mt-5 overflow-hidden border rounded-lg bg-white divide-y divide-gray-200 dark:border-gray-500 dark:bg-blue-gray-700 dark:divide-gray-500 dark:divide-gray-600"
                    >
                      <div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          Expires In
                        </dt>
                        <dd
                          class="mt-1"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            Will not expire in the next 14 days
                          </div>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
              <div
                class="group relative bg-white p-6 dark:bg-blue-gray-800"
              >
                <div
                  class="flex items-center space-x-2"
                >
                  <div
                    class="mt-0.5 h-3 w-3 rounded-full bg-green-500"
                  /><h3
                    class="text-lg dark:text-gray-100"
                  >
                    <a
                      href="#"
                      class="hover:text-home-teal-button font-semibold focus:outline-none"
                    > Broken Links </a>
                  </h3>
                </div><div
                  class="mt-8"
                >
                  <p
                    class="mt-2 text-sm text-gray-500 dark:text-gray-400"
                  >
                    Your site has no broken links.
                  </p><!----><div>
                    <dl
                      class="grid grid-cols-1 mt-5 overflow-hidden border rounded-lg bg-white md:grid-cols-2 divide-y divide-gray-200 dark:border-gray-500 dark:bg-blue-gray-700 md:divide-x md:divide-y-0 dark:divide-gray-500 dark:divide-gray-600"
                    >
                      <div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          Broken Links
                        </dt><dd
                          class="mt-1 flex items-baseline justify-between md:block lg:flex"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            0
                          </div>
                        </dd>
                      </div><div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          URLs Crawled
                        </dt><dd
                          class="mt-1 flex items-baseline justify-between md:block lg:flex"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            583
                          </div>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div><div
                class="group relative bg-white p-6 dark:bg-blue-gray-800"
              >
                <div
                  class="flex items-center space-x-2"
                >
                  <div
                    class="mt-0.5 h-3 w-3 rounded-full bg-green-500"
                  /><h3
                    class="text-lg dark:text-gray-100"
                  >
                    <a
                      href="#"
                      class="hover:text-home-teal-button font-semibold focus:outline-none"
                    > Mixed Content </a>
                  </h3>
                </div><div
                  class="mt-8"
                >
                  <p
                    class="mt-2 text-sm text-gray-500 dark:text-gray-400"
                  >
                    We did not find mixed content. We last checked an hour ago.
                  </p>
                  <div>
                    <dl
                      class="grid grid-cols-1 mt-5 overflow-hidden border rounded-lg bg-white md:grid-cols-2 divide-y divide-gray-200 dark:border-gray-500 dark:bg-blue-gray-700 md:divide-x md:divide-y-0 dark:divide-gray-500 dark:divide-gray-600"
                    >
                      <div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          Pieces of Mixed Content
                        </dt><dd
                          class="mt-1 flex items-baseline justify-between md:block lg:flex"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            0
                          </div>
                        </dd>
                      </div>
                      <div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          URLs Crawled
                        </dt>
                        <dd
                          class="mt-1 flex items-baseline justify-between md:block lg:flex"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            0
                          </div>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div><div
                class="group relative bg-white p-6 dark:bg-blue-gray-800"
              >
                <div
                  class="flex items-center space-x-2"
                >
                  <div
                    class="mt-0.5 h-3 w-3 rounded-full bg-blue-500"
                  /><h3
                    class="text-lg dark:text-gray-100"
                  >
                    <a
                      href="#"
                      class="hover:text-home-teal-button font-semibold focus:outline-none"
                    > Certificate transparency </a>
                  </h3>
                </div><div
                  class="mt-8"
                >
                  <p
                    class="mt-2 text-sm text-gray-500 dark:text-gray-400"
                  >
                    Your site is up. We last checked less than a minute ago.
                  </p>
                </div>
              </div><div
                class="group relative bg-white p-6 dark:bg-blue-gray-800"
              >
                <div
                  class="flex items-center space-x-2"
                >
                  <div
                    class="mt-0.5 h-3 w-3 rounded-full bg-green-500"
                  /><h3
                    class="text-lg dark:text-gray-100"
                  >
                    <a
                      href="#"
                      class="hover:text-home-teal-button font-semibold focus:outline-none"
                    > Application Health </a>
                  </h3>
                </div><div
                  class="mt-8"
                >
                  <p
                    class="mt-2 text-sm text-gray-500 dark:text-gray-400"
                  >
                    Your application seems to be healthy. We last checked 10 minutes ago.
                  </p><!----><div>
                    <dl
                      class="grid grid-cols-1 mt-5 overflow-hidden border rounded-lg bg-white md:grid-cols-2 divide-y divide-gray-200 dark:border-gray-500 dark:bg-blue-gray-700 md:divide-x md:divide-y-0 dark:divide-gray-500 dark:divide-gray-600"
                    >
                      <div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          Total Health Checks
                        </dt><dd
                          class="mt-1 flex items-baseline justify-between md:block lg:flex"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            2
                          </div>
                        </dd>
                      </div><div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          Failed Health Checks
                        </dt><dd
                          class="mt-1 flex items-baseline justify-between md:block lg:flex"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            0
                          </div>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div><div
                class="group relative bg-white p-6 dark:bg-blue-gray-800"
              >
                <div
                  class="flex items-center space-x-2"
                >
                  <div
                    class="mt-0.5 h-3 w-3 rounded-full bg-green-500"
                  /><h3
                    class="text-lg dark:text-gray-100"
                  >
                    <a
                      href="#"
                      class="hover:text-home-teal-button font-semibold focus:outline-none"
                    > DNS </a>
                  </h3>
                </div><!----><div
                  class="mt-8"
                >
                  <p
                    class="mt-2 text-sm text-gray-500 dark:text-gray-400"
                  >
                    DNS records found. We last checked an hour ago.
                  </p><div>
                    <dl
                      class="lg grid grid-cols-1 mt-5 overflow-hidden border rounded-lg bg-white md:grid-cols-2 divide-y divide-gray-200 dark:border-gray-500 dark:bg-blue-gray-700 md:divide-x md:divide-y-0 dark:divide-gray-500 dark:divide-gray-600"
                    >
                      <div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          DNS Records
                        </dt><dd
                          class="mt-1 flex items-baseline justify-between md:block lg:flex"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            18
                          </div>
                        </dd>
                      </div><div
                        class="p-2 sm:p-3"
                      >
                        <dt
                          class="text-sm text-gray-500 dark:text-gray-200"
                        >
                          URLs Crawled
                        </dt><dd
                          class="mt-1 flex items-baseline justify-between md:block lg:flex"
                        >
                          <div
                            class="pt-4 text-sm text-gray-900 font-semibold dark:text-gray-100"
                          >
                            20
                          </div>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
