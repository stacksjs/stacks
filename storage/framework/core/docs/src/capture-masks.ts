const textControls = 'textarea,input:is(:not([type]),[type="text" i],[type="password" i],[type="email" i],[type="search" i],[type="tel" i],[type="url" i])'

/** Hide entered text while keeping the field background, border and focus visible. */
export function captureMaskCss(selectors: string[]): string {
  const selected = `:is(${['input[type="password"]', ...selectors].join(',')})`
  const fields = `${selected}:is(${textControls})`
  return `
${selected}:not(:is(${textControls})) { opacity: 0 !important; }
${fields}, ${fields}::selection {
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  -webkit-text-stroke: 0 transparent !important;
  text-shadow: none !important;
  caret-color: transparent !important;
  forced-color-adjust: none !important;
}
${fields}::selection { background: transparent !important; }
${fields}::placeholder { color: GrayText !important; -webkit-text-fill-color: GrayText !important; }
${fields}::-webkit-search-cancel-button { visibility: hidden !important; }
`
}
