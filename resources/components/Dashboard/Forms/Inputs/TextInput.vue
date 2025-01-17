<script setup lang="ts">
import {toRef} from 'vue';
import {useField} from 'vee-validate';

const props = defineProps({
  type: {
    type: String,
    default: 'text',
  },
  value: {
    type: String,
    default: undefined,
  },
  name: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  successMessage: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
});

const name = toRef(props, 'name');

const {
  value: inputValue,
  errorMessage,
  handleBlur,
  handleChange,
  meta,
} = useField(name, undefined, {
  initialValue: props.value,
});

const textInputClass = computed(() => {
  const className = {}

  className['text-red-900 focus:outline-red-600 outline-red-300 placeholder:text-red-300'] = !!errorMessage.value

  return className
})

</script>

<template>
  <input-wrapper :for="name" :errorMessage="errorMessage">
    <div class="mt-2 grid grid-cols-1">
      <input
        :name="name"
        :id="name"
        :type="type"
        :value="inputValue"
        :placeholder="placeholder"
        @input="handleChange"
        @blur="handleBlur"
        class="col-start-1 row-start-1 block w-full rounded-md bg-white py-1.5 px-3 text-base outline outline-1 -outline-offset-1 focus:outline focus:outline-2 focus:-outline-offset-2 sm:pr-9 sm:text-sm/6"
        :class="textInputClass"
      />
    </div>
  </input-wrapper>
</template>
