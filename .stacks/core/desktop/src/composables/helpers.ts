export const isEmpty = (obj: any) => {
  for (const prop in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, prop))
      return false
  }

  return JSON.stringify(obj) === JSON.stringify({})
}

export const cleanArray = (rules: any) => {
  for (const key of Object.keys(rules)) {
    if (!rules[key] || rules[key] === undefined)
      delete rules[key]
  }

  for (const key of Object.keys(rules)) {
    if (!rules[key].length)
      delete rules[key]
  }

  return rules
}

export const capitalizeWords = (str: string): string => {
  const words = str.split(' ')
  const capitalizedWords = []
  for (let i = 0; i < words.length; i++) {
    const currentWord = words[i]
    capitalizedWords.push(currentWord[0].toUpperCase() + currentWord.slice(1))
  }
  return capitalizedWords.join(' ')
}

export const displayKey = (key: string): string => {
  const str = key.split('_').join(' ')

  return capitalizeWords(str)
}

export const getError = (errors: any, form: string, message = '') => {
  if (errors[form])
    return message || errors[form][0]
}

export const hasError = (errors: any, form: string) => {
  if (errors[form])
    return true
  return false
}

export function formatNumberWithCommas(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
