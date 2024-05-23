export class Utils {

  static removeStaleStorage(keys: string[] = []) {

    for (const key in window.localStorage) {
      if (!keys.includes(key))
        window.localStorage.removeItem(key);
    }
  }

  static isNumber(value: any): boolean {
    return !isNaN(parseFloat(value)) && isFinite(value)
  }

  static isNan(value: any): boolean {
    return this.isNumber(value) === false
  }
}
