// Avoid ts-collect 0.4.1 and 0.4.2: their published dist is unparseable, so an
// import here took the whole test suite down. Fixed in 0.4.3.
export { collect } from 'ts-collect'
