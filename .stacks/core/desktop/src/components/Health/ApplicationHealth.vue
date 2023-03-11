<template>
  <div class="flex flex-col items-center justify-between dark:border-gray-600 md:flex-row">
    <h3 class="font-semibold">
      Application Health
    </h3>
  </div>

  <div class="mt-4 bg-white rounded-lg shadow dark:bg-gray-700">
    <div class="p-4">
      <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-200">
        Latest Health Check Results
      </h3>
    </div>
    <div class="p-4">
      <div class="flex flex-col">
        <div class="overflow-x-auto">
          <div class="inline-block min-w-full py-2 align-middle">
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    The Sunfire integration is working
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Ok</span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    Ok
                  </td>
                </tr>

                <tr>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    CPU usage is normal
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Ok</span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    Ok
                  </td>
                </tr>

                <tr>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    The Database is connection is working
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Ok</span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    Ok
                  </td>
                </tr>

                <tr>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    Memory usage is normal
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Ok</span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    Ok
                  </td>
                </tr>
                <tr>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    Used Disk Space
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Ok</span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    16%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
