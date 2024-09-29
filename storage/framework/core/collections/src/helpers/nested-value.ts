/**
 * Get value of a nested property
 *
 * @param mainObject - The object to search for the nested property
 * @param key - The key path to the nested property, using dot notation
 * @returns The value of the nested property, or the mainObject if not found
 */
export function nestedValue<T>(mainObject: T, key: string): any {
  try {
    return key.split('.').reduce((obj: any, property: string) => obj[property], mainObject)
  } catch (err) {
    // If we end up here, we're not working with an object, and mainObject is the value itself
    return mainObject
  }
}
