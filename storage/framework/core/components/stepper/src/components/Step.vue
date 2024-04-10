<template>
  <div :class="['v-step', classes]">
    <input
      :id="id"
      class="input"
      type="radio"
      v-show="debug"
      :checked="active"
      :name="computedName"
      @change="handleChange"
    >
    <label class="label" :for="id">
      <slot name="index-root" v-bind="scope">
        <span class="index">
          <slot name="index" v-bind="scope">
            {{ scope.displayIndex }}
          </slot>
        </span>
      </slot>
      <span class="title" v-if="defaultSlot">
        <slot v-bind="scope"></slot>
      </span>
      <span class="divider" v-if="withDivider"></span>
    </label>
  </div>
</template>

<script>
import Utils from '@/modules/Stepper.Utils'

export default {
  name: 'VStep',
  props: {
    index: {
      type: Number,
      default: 0
    },
    name: {
      type: String,
      default: ''
    },
    active: {
      type: Boolean,
      default: false
    },
    visited: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    withDivider: {
      type: Boolean,
      default: false
    },
    debug: {
      type: Boolean,
      default: false
    }
  },
  data: () => ({
    namespace: { kebab: 'v-step', capitalize: 'V-Step' }
  }),
  computed: {
    id() {
      return `${this.namespace.kebab}-${this._uid}-${this.index}`
    },
    displayIndex() {
      return this.index + 1
    },
    computedName() {
      return this.name || this.id
    },
    defaultSlot() {
      return this.$slots.default || this.$scopedSlots.default
    },
    scope() {
      const { index, displayIndex, defaultSlot, flags } = this
      return { index, displayIndex, defaultSlot, flags }
    },
    flags() {
      return {
        isActive: this.active,
        isVisited: this.visited,
        isDisabled: this.disabled
      }
    },
    classes() {
      return {
        'is-active': this.active,
        'is-visited': this.visited,
        'is-disabled': this.disabled
      }
    }
  },
  methods: {
    /**
     * Lift index (a la v-model).
     * @returns {void}
     */
    handleChange() {
      this.$emit('change', this.index)
    }
  },
  inheritAttrs: false
}
</script>

<style lang="scss" scoped>
@import '~@/sass/colors';

.v-step {
  flex: 1;
  opacity: 0.55;
  box-sizing: border-box;
  transition: opacity 0.7s;

  &:hover:not(.is-disabled) {
    opacity: 0.85;
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }

  &.is-active,
  &.is-visited {
    .label {
      cursor: pointer;
    }

    .index {
      color: $app-color-dusty-gray;
    }
  }

  &.is-active {
    opacity: 1;

    .title {
      color: lighten($app-color-eden, 30%);
    }

    .label {
      .index {
        border-color: rgba($app-color-wild-sand, 0.2);
        background-color: lighten($app-color-eden, 0%);
      }
    }
  }

  &.is-visited {
    .index {
      background-color: $app-color-white;
    }
  }

  @media (max-width: 575px) {
    &:not(:last-child) {
      // Bootstrap "xs"
      margin-right: 0.5rem;
    }
  }
}

.label {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.index {
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  flex-shrink: 0;
  font-size: 1.5rem;
  border-radius: 50%;
  margin-right: 0.5rem;
  color: $app-color-white;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: 1px solid $app-color-wild-sand;
}

.title {
  color: $app-color-white;
}

.divider {
  width: 100%;
  margin-left: 0.5rem;
  border-bottom: 1px solid $app-color-white;
  box-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);
}
</style>
