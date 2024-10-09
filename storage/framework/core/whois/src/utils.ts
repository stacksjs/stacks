/**
 * Copy an Object with its values
 *
 * @param obj Object which needs to be copied
 * @returns A copy of the object
 */
export function shallowCopy<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.slice() as T // Clone the array
  }

  if (typeof obj === 'object' && obj !== null) {
    const copy: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key))
        copy[key] = shallowCopy(obj[key])
    }
    return copy as T
  }

  return obj // For primitive values, return as is
}
