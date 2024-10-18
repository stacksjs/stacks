export interface PluralizeOptions {
  count?: number
  inclusive?: boolean
}

type Rule = [RegExp, string]
type StringOrRegExp = string | RegExp

interface PluralizeFunction {
  (word: string, options?: PluralizeOptions): string
  plural: (word: string) => string
  isPlural: (word: string) => boolean
  singular: (word: string) => string
  isSingular: (word: string) => boolean
  addPluralRule: (rule: StringOrRegExp, replacement: string) => void
  addSingularRule: (rule: StringOrRegExp, replacement: string) => void
  addUncountableRule: (word: string | RegExp) => void
  addIrregularRule: (single: string, plural: string) => void
}

const pluralRules: Rule[] = []
const singularRules: Rule[] = []
const uncountables: Record<string, boolean> = {}
const irregularPlurals: Record<string, string> = {}
const irregularSingles: Record<string, string> = {}

function sanitizeRule(rule: string | RegExp): RegExp {
  return typeof rule === 'string' ? new RegExp(`^${rule}$`, 'i') : rule
}

function restoreCase(word: string, token: string): string {
  if (word === token)
    return token
  if (word === word.toLowerCase())
    return token.toLowerCase()
  if (word === word.toUpperCase())
    return token.toUpperCase()
  if (word[0] === word[0].toUpperCase()) {
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
  }
  return token.toLowerCase()
}

function interpolate(str: string, ...args: any[]): string {
  return str.replace(/\$(\d{1,2})/g, (match, index) => args[Number(index)] || '')
}

function replace(word: string, rule: Rule): string {
  return word.replace(rule[0], (...matchArgs) => {
    const result = interpolate(rule[1], ...matchArgs)
    if (matchArgs[0] === '') {
      return restoreCase(word[matchArgs[matchArgs.length - 2] - 1], result)
    }
    return restoreCase(matchArgs[0], result)
  })
}

function sanitizeWord(token: string, word: string, rules: Rule[]): string {
  if (!token.length || uncountables[token]) {
    return word
  }

  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i]
    if (rule[0].test(word))
      return replace(word, rule)
  }

  return word
}

function replaceWord(replaceMap: Record<string, string>, keepMap: Record<string, string>, rules: Rule[]): (word: string) => string {
  return (word: string) => {
    const token = word.toLowerCase()
    if (keepMap[token])
      return restoreCase(word, token)
    if (replaceMap[token])
      return restoreCase(word, replaceMap[token])
    return sanitizeWord(token, word, rules)
  }
}

function checkWord(replaceMap: Record<string, string>, keepMap: Record<string, string>, rules: Rule[]): (word: string) => boolean {
  return (word: string) => {
    const token = word.toLowerCase()
    if (keepMap[token])
      return true
    if (replaceMap[token])
      return false
    return sanitizeWord(token, token, rules) === token
  }
}

export const pluralize: PluralizeFunction = ((word: string, options: PluralizeOptions = {}): string => {
  const { count = 2, inclusive = false } = options

  if (typeof word !== 'string') {
    throw new TypeError('Word must be a string')
  }

  const pluralized = count === 1 ? pluralize.singular(word) : pluralize.plural(word)
  return inclusive ? `${count} ${pluralized}` : pluralized
}) as PluralizeFunction

export const singular: PluralizeFunction = ((word: string): string => {
  return pluralize.singular(word)
}) as PluralizeFunction

export const plural: PluralizeFunction = ((word: string, count: number = 2): string => {
  return pluralize(word, { count })
}) as PluralizeFunction

pluralize.plural = replaceWord(irregularSingles, irregularPlurals, pluralRules)
pluralize.isPlural = checkWord(irregularSingles, irregularPlurals, pluralRules)
pluralize.singular = replaceWord(irregularPlurals, irregularSingles, singularRules)
pluralize.isSingular = checkWord(irregularPlurals, irregularSingles, singularRules)

pluralize.addPluralRule = (rule: string | RegExp, replacement: string): void => {
  pluralRules.push([sanitizeRule(rule), replacement])
}

pluralize.addSingularRule = (rule: string | RegExp, replacement: string): void => {
  singularRules.push([sanitizeRule(rule), replacement])
}

pluralize.addUncountableRule = (word: string | RegExp): void => {
  if (typeof word === 'string') {
    uncountables[word.toLowerCase()] = true
    return
  }
  pluralize.addPluralRule(word, '$0')
  pluralize.addSingularRule(word, '$0')
}

pluralize.addIrregularRule = (single: string, plural: string): void => {
  const lowerPlural = plural.toLowerCase()
  const lowerSingle = single.toLowerCase()
  irregularSingles[lowerSingle] = lowerPlural
  irregularPlurals[lowerPlural] = lowerSingle
};

// Add irregular rules
[
  ['I', 'we'],
  ['me', 'us'],
  ['he', 'they'],
  ['she', 'they'],
  ['them', 'them'],
  ['myself', 'ourselves'],
  ['yourself', 'yourselves'],
  ['itself', 'themselves'],
  ['herself', 'themselves'],
  ['himself', 'themselves'],
  ['themself', 'themselves'],
  ['is', 'are'],
  ['was', 'were'],
  ['has', 'have'],
  ['this', 'these'],
  ['that', 'those'],
  ['my', 'our'],
  ['its', 'their'],
  ['his', 'their'],
  ['her', 'their'],
  ['echo', 'echoes'],
  ['dingo', 'dingoes'],
  ['volcano', 'volcanoes'],
  ['tornado', 'tornadoes'],
  ['torpedo', 'torpedoes'],
  ['genus', 'genera'],
  ['viscus', 'viscera'],
  ['stigma', 'stigmata'],
  ['stoma', 'stomata'],
  ['dogma', 'dogmata'],
  ['lemma', 'lemmata'],
  ['schema', 'schemata'],
  ['anathema', 'anathemata'],
  ['ox', 'oxen'],
  ['axe', 'axes'],
  ['die', 'dice'],
  ['yes', 'yeses'],
  ['foot', 'feet'],
  ['eave', 'eaves'],
  ['goose', 'geese'],
  ['tooth', 'teeth'],
  ['quiz', 'quizzes'],
  ['human', 'humans'],
  ['proof', 'proofs'],
  ['carve', 'carves'],
  ['valve', 'valves'],
  ['looey', 'looies'],
  ['thief', 'thieves'],
  ['groove', 'grooves'],
  ['pickaxe', 'pickaxes'],
  ['passerby', 'passersby'],
  ['canvas', 'canvases'],
].forEach(([single, plural]) => pluralize.addIrregularRule(single, plural));

// Add plural rules
[
  [/s?$/i, 's'],
  [/[^\x20-\x7F]$/, '$0'],
  [/([^aeiou]ese)$/i, '$1'],
  [/(ax|test)is$/i, '$1es'],
  [/(alias|[^aou]us|t[lm]as|gas|ris)$/i, '$1es'],
  [/(e[mn]u)s?$/i, '$1s'],
  [/([^l]ias|[aeiou]las|[ejzr]as|[iu]am)$/i, '$1'],
  [/(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1i'],
  [/(alumn|alg|vertebr)(?:a|ae)$/i, '$1ae'],
  [/(seraph|cherub)(?:im)?$/i, '$1im'],
  [/(her|at|gr)o$/i, '$1oes'],
  [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor)(?:a|um)$/i, '$1a'],
  [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)(?:a|on)$/i, '$1a'],
  [/sis$/i, 'ses'],
  [/(?:(kni|wi|li)fe|(ar|l|ea|eo|oa|hoo)f)$/i, '$1$2ves'],
  [/([^aeiouy]|qu)y$/i, '$1ies'],
  [/([^ch][ieo][ln])ey$/i, '$1ies'],
  [/(x|ch|ss|sh|zz)$/i, '$1es'],
  [/(matr|cod|mur|sil|vert|ind|append)(?:ix|ex)$/i, '$1ices'],
  [/\b((?:tit)?m|l)(?:ice|ouse)$/i, '$1ice'],
  [/(pe)(?:rson|ople)$/i, '$1ople'],
  [/(child)(?:ren)?$/i, '$1ren'],
  [/eaux$/i, '$0'],
  [/m[ae]n$/i, 'men'],
  ['thou', 'you'],
].forEach(([rule, replacement]) => pluralize.addPluralRule(rule, replacement as string));

// Add singular rules
[
  [/s$/i, ''],
  [/(ss)$/i, '$1'],
  [/(wi|kni|(?:after|half|high|low|mid|non|night|\W|^)li)ves$/i, '$1fe'],
  [/(ar|(?:wo|[ae])l|[eo][ao])ves$/i, '$1f'],
  [/ies$/i, 'y'],
  [/(dg|ss|ois|lk|ok|wn|mb|th|ch|ec|oal|is|ck|ix|sser|ts|wb)ies$/i, '$1ie'],
  [/\b(l|(?:neck|cross|hog|aun)?t|coll|faer|food|gen|goon|group|hipp|junk|vegg|(?:pork)?p|charl|calor|cut)ies$/i, '$1ie'],
  [/\b(mon|smil)ies$/i, '$1ey'],
  [/\b((?:tit)?m|l)ice$/i, '$1ouse'],
  [/(seraph|cherub)im$/i, '$1'],
  [/(x|ch|ss|sh|zz|tto|go|cho|alias|[^aou]us|t[lm]as|gas|(?:her|at|gr)o|[aeiou]ris)(?:es)?$/i, '$1'],
  [/(analy|diagno|parenthe|progno|synop|the|empha|cri|ne)(?:sis|ses)$/i, '$1sis'],
  [/(movie|twelve|abuse|e[mn]u)s$/i, '$1'],
  [/(test)(?:is|es)$/i, '$1is'],
  [/(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1us'],
  [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|quor)a$/i, '$1um'],
  [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)a$/i, '$1on'],
  [/(alumn|alg|vertebr)ae$/i, '$1a'],
  [/(cod|mur|sil|vert|ind)ices$/i, '$1ex'],
  [/(matr|append)ices$/i, '$1ix'],
  [/(pe)(rson|ople)$/i, '$1rson'],
  [/(child)ren$/i, '$1'],
  [/(eau)x?$/i, '$1'],
  [/men$/i, 'man'],
].forEach(([rule, replacement]) => pluralize.addSingularRule(rule, replacement as string));

// Add uncountable rules
[
  'adulthood',
  'advice',
  'agenda',
  'aid',
  'aircraft',
  'alcohol',
  'ammo',
  'analytics',
  'anime',
  'athletics',
  'audio',
  'bison',
  'blood',
  'bream',
  'buffalo',
  'butter',
  'carp',
  'cash',
  'chassis',
  'chess',
  'clothing',
  'cod',
  'commerce',
  'cooperation',
  'corps',
  'debris',
  'diabetes',
  'digestion',
  'elk',
  'energy',
  'equipment',
  'excretion',
  'expertise',
  'firmware',
  'flounder',
  'fun',
  'gallows',
  'garbage',
  'graffiti',
  'hardware',
  'headquarters',
  'health',
  'herpes',
  'highjinks',
  'homework',
  'housework',
  'information',
  'jeans',
  'justice',
  'kudos',
  'labour',
  'literature',
  'machinery',
  'mackerel',
  'mail',
  'media',
  'mews',
  'moose',
  'music',
  'mud',
  'manga',
  'news',
  'only',
  'personnel',
  'pike',
  'plankton',
  'pliers',
  'police',
  'pollution',
  'premises',
  'rain',
  'research',
  'rice',
  'salmon',
  'scissors',
  'series',
  'sewage',
  'shambles',
  'shrimp',
  'software',
  'staff',
  'swine',
  'tennis',
  'traffic',
  'transportation',
  'trout',
  'tuna',
  'wealth',
  'welfare',
  'whiting',
  'wildebeest',
  'wildlife',
  'you',
  /pok[eé]mon$/i,
  /[^aeiou]ese$/i,
  /deer$/i,
  /fish$/i,
  /measles$/i,
  /o[iu]s$/i,
  /pox$/i,
  /sheep$/i,
].forEach(pluralize.addUncountableRule)

export default pluralize
