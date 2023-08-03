<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <form class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-gray-800">
      <div
        class="sm:flex sm:items-center"
      >
        <div
          class="sm:flex-auto"
        >
          <h1
            class="text-base font-semibold leading-6 text-gray-900"
          >
            Team X
          </h1>
        </div>
      </div>
      <div class="py-2">
        <div class="bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400 flex flex-row rounded-lg p-4 text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="text-gray-400 h-6 flex-shrink-0"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          /></svg><div class="ml-4 mt-0.5 flex flex-grow">
            <p class="">
              You can add teammates here.
            </p>
          </div>
        </div>
        <div class="mt-4 flex flex-col">
          <label>Enter teammate email to invite them.</label>
          <div class="mt-1 flex flex-col">
            <input
              type="text"
              class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              list="artisanCommands"
              autocorrect="off"
            >
          </div>
        </div>
      </div>
      <div>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Invite
          </button>
        </div>
      </div>
    </form>

    <div class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-gray-800 mt-16">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 text-gray-900">
            Teammates
          </h1>
        </div>
      </div>
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Email
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Role
                  </th>
                  <th
                    scope="col"
                    class="relative py-3 pl-3 pr-4 sm:pr-0"
                  >
                    <span class="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                    John Doe
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    johndoe@example.com
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    User
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-blue-600 hover:text-blue-900"
                    >Remove</a>
                    <a
                      href="#"
                      class="text-blue-600 hover:text-blue-900 pl-4"
                    >Change Role</a>
                  </td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                    Sheldon Cooper
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    sheldoncooper@gmail.com
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    Admin
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-blue-600 hover:text-blue-900"
                    >Remove</a>
                    <a
                      href="#"
                      class="text-blue-600 hover:text-blue-900 pl-4"
                    >Change Role</a>
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
