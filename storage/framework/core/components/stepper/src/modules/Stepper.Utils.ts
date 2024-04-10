import $Utils from '@/modules/Utils'

export class Utils {
  /**
   * Remove stale storage keys.
   * @param {String} id
   * @returns {void}
   */
  static removeStaleStorage(keys = []) {
    keys = [].concat(keys)

    for (const key in window.localStorage) {
      if (keys.includes(key)) {
        // Keep
      } else {
        window.localStorage.removeItem(key)
      }
    }
  }

  /**
   * Constructs a step slot name.
   * @returns {String}
   */
  static getSlotName(suffix = '', displayIndex, options = {}) {
    const defaults = { prefix: 'step' }
    options = Object.assign({}, defaults, options)
    const { prefix } = options
    const name = []
    if ($Utils.isNan(displayIndex)) {
      throw new Error(`[Stepper.Utils.getSlotName warn]: Cannot generate name without a "displayIndex".`)
    }
    if (prefix) {
      name.push(prefix)
    }
    if (displayIndex) {
      name.push(displayIndex)
    }
    if (suffix) {
      name.push(suffix)
    }
    return name.join('-')
  }

  /**
  * Returns whether step slot was passed.
  * @returns {Boolean}
  */
  static withSlot(name) {
    return this.withoutSlot(name) === false
  }

  /**
   * Returns whether step slot was not passed.
   * @returns {Boolean}
   */
  static withoutSlot(name) {
    const noSlot = !this.$slots[name] || (this.$slots[name] && !this.$slots[name].length)
    const noScopedSlot = !this.$scopedSlots[name]
    return noSlot && noScopedSlot
  }
}

export default Utils
