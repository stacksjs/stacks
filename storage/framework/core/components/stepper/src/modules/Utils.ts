export class Utils {
  /**
   * @param {*} value
   * @returns {Boolean}
   */
  static isNumber(value: any) {
    return !isNaN(parseFloat(value)) && isFinite(value)
  }

  /**
   * @param {*} value
   * @returns {Boolean}
   */
  static isNan() {
    return this.isNumber.apply(this, arguments) === false
  }
}

export default Utils
