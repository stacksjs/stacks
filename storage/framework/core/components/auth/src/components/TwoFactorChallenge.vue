<template>
  <div class="py-32">
    <div class="mx-auto max-w-sm rounded-md px-8 py-4 shadow-md">
      <div class="card-body">
        <div>
          <h3 class="text-center text-sm text-gray-900 font-semibold">
            Two Factor Authentication
          </h3>
          <label for="code" class="mt-4 block text-sm text-gray-900 font-medium leading-6">
            Authentication code
          </label>
          <div class="mt-2 flex rounded-md shadow-sm space-x-2">
            <input id="code" type="code" maxlength="1" name="code" placeholder="-" class="block w-full border-0 rounded-md px-2 py-2 text-center text-gray-900 ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            <input id="code" type="code" maxlength="1" name="code" placeholder="-" class="block w-full border-0 rounded-md px-2 py-2 text-center text-gray-900 ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            <input id="code" type="code" maxlength="1" name="code" placeholder="-" class="block w-full border-0 rounded-md px-2 py-2 text-center text-gray-900 ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            <input id="code" type="code" maxlength="1" name="code" placeholder="-" class="block w-full border-0 rounded-md px-2 py-2 text-center text-gray-900 ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            <input id="code" type="code" maxlength="1" name="code" placeholder="-" class="block w-full border-0 rounded-md px-2 py-2 text-center text-gray-900 ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            <input id="code" type="code" maxlength="1" name="code" placeholder="-" class="block w-full border-0 rounded-md px-2 py-2 text-center text-gray-900 ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
          </div>
        </div>
        <div class="py-4">
          <button type="submit" class="relative h-8 w-full flex items-center justify-center border-teal rounded-full bg-teal px-4 text-white font-semibold focus:outline-none">
            Verify
          </button>
        </div>
        <div>
          <p class="text-xs text-gray-700 font-semibold">
            Open your Symantec 2FA app to view your authentication code.
          </p>
        </div>
        <div class="mt-4">
          <p class="text-xs text-gray-700 font-semibold">
            Having Problems?
          </p>
          <a href="#" class="text-xs text-blue-500 hover:underline">Use recovery code instead</a>
        </div>
      </div>
    </div>
  </div>
</template>
