<script setup lang="ts">
import { useWebpageStore } from '~/stores/webpage'

const {
  activeStatus,
  webpage,
} = defineProps<Props>()

const emit = defineEmits(['newRecordAction', 'activeMenu'])

const route = useRoute()
const router = useRouter()
const toast = useToast()
const webpageStore = useWebpageStore()
const errors = ref({} as any)

function changeActive(menu: string) {
  emit('activeMenu', menu)
}

interface Props {
  activeStatus: string
  webpage: object | any
}

function statusIs(status: String[]): Boolean {
  return status.includes(activeStatus)
}

async function submitWebpage() {
  const form = webpageStore.webpageForm

  const formData = new FormData()

  Object.keys(form).forEach((key) => {
    if (form[key])
      formData.append(key, form[key])

    return formData
  })

  formData.append('create', 'false')
  formData.append('update', 'true')

  try {
    errors.value = {}

    await webpageStore.updateWebpage(route.params.id, formData)

    await toast.success({ text: 'Successfully updated webpage!' })

    router.push({ name: 'webpages' })
  }
  catch (err: any) {
    toast.error({ text: 'Something went wrong!' })

    errors.value = err.data.errors

    webpageStore.setFormErrors(errors)
  }
}
</script>

<template>
  <div class="mt-8">
    <h2 class="mb-4 text-xl text-gray-600 dark:text-gray-300">
      Website Editor
    </h2>
    <div class="sm:hidden">
      <label
        for="tabs"
        class="sr-only"
      >Select a tab</label>
      <!-- Use an "onChange" listener to redirect the user to the selected tab URL. -->
      <select
        id="tabs"
        name="tabs"
        class="block w-full border-gray-300 rounded-md focus:border-teal-500"
      >
        <option>Personal Info</option>

        <option>Header Image</option>

        <option selected>
          Primary Text
        </option>

        <option>Secondary Text</option>
      </select>
    </div>
    <div class="hidden sm:block">
      <div class="border-b border-gray-200 dark:border-gray-600">
        <nav
          class="flex"
          aria-label="Tabs"
        >
          <!-- Current: "border-teal-500 text-teal-600", Default: "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 hover:border-gray-300" -->
          <button
            class="w-1/4 px-1 py-4 text-sm font-medium text-center dark-hover:text-gray-300 hover:text-gray-700 dark:text-gray-200 hover:border-gray-300"
            :class="{ 'text-teal-600 dark:text-teal-300 border-b-2 border-teal-500': statusIs(['site', 'personal']), 'border-transparent dark:text-gray-400 text-gray-500': !statusIs(['site', 'personal']) }"
            @click="changeActive('personal')"
          >
            Personal Info
          </button>

          <button
            class="w-1/4 px-1 py-4 text-sm font-medium text-center hover:text-gray-700 dark:text-gray-200 hover:border-gray-300 dark-hover:text-gray-300"
            :class="{ 'text-teal-600 border-b-2 border-teal-500 dark:text-teal-300': statusIs(['header-image']), 'border-transparent dark:text-gray-400 text-gray-500': !statusIs(['header-image']) }"
            @click="changeActive('header-image')"
          >
            Header Image
          </button>

          <button
            class="w-1/4 px-1 py-4 text-sm font-medium text-center hover:text-gray-700 dark:text-gray-200 hover:border-gray-300 dark-hover:text-gray-300"
            :class="{ 'text-teal-600 border-b-2 border-teal-500 dark:text-teal-300': statusIs(['primary-text']), 'border-transparent dark:text-gray-400 text-gray-500': !statusIs(['primary-text']) }"
            @click="changeActive('primary-text')"
          >
            Primary Text
          </button>

          <button
            class="w-1/4 px-1 py-4 text-sm font-medium text-center hover:text-gray-700 dark:text-gray-200 hover:border-gray-300 dark-hover:text-gray-300"
            :class="{ 'text-teal-600 border-b-2 border-teal-500 dark:text-teal-300': statusIs(['secondary-text']), 'border-transparent dark:text-gray-400 text-gray-500': !statusIs(['secondary-text']) }"
            @click="changeActive('secondary-text')"
          >
            Secondary Text
          </button>
        </nav>
      </div>
    </div>

    <div
      v-if="!isEmpty(webpage)"
      class="dark:bg-gray-800"
    >
      <PersonalInfo
        v-if="activeStatus === 'personal' || activeStatus === 'site'"
        :webpage="webpage"
      />

      <HeaderImage
        v-if="activeStatus === 'header-image'"
        :webpage="webpage"
      />

      <PrimaryText
        v-if="activeStatus === 'primary-text'"
        :copyblock="Number(webpage.copyblock_1)"
      />

      <SecondaryText
        v-if="activeStatus === 'secondary-text'"
        :copyblock="Number(webpage.copyblock_2)"
      />

      <div class="flex justify-end">
        <button
          type="button"
          class="mr-4 secondary-button"
        >
          Cancel
        </button>

        <AppButton
          passed-class="primary-button"
          button-text="Update"
          loading-text="Updating..."
          @click="submitWebpage"
        />
      </div>
    </div>
  </div>
</template>
