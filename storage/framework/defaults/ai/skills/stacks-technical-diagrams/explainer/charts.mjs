import { PeleError, detectType, register, render } from './vendor/pele/core.js';
import pie from './vendor/pele/diagrams/pie.js';
import xychart from './vendor/pele/diagrams/xychart.js';
import quadrantChart from './vendor/pele/diagrams/quadrantChart.js';
import sankey from './vendor/pele/diagrams/sankey.js';
import radar from './vendor/pele/diagrams/radar.js';
import venn from './vendor/pele/diagrams/venn.js';

register(pie, xychart, quadrantChart, sankey, radar, venn);

const NATIVE = { flowchart: 'workflow or architecture', sequence: 'sequence', class: 'class', er: 'erd', state: 'lifecycle', timeline: 'timeline', gantt: 'timeline or waterfall', mindmap: 'tree', treeview: 'tree' };

// A pie legend reads "Label · value (share%)" rather than Pele's "Label [value]". The labels are
// rewritten before rendering so the legend is laid out for their real width.
function pieLegend(text) {
  if (!/^\s*pie\b/u.test(text)) return text;
  const slice = /^(\s*)"((?:[^"\\]|\\.)*)"\s*:\s*(-?\d+(?:\.\d+)?)\s*$/gmu;
  const total = [...text.matchAll(slice)].reduce((sum, match) => sum + Number(match[3]), 0);
  if (!(total > 0)) return text;
  return text.replace(/^(\s*pie)\s+showData\b/u, '$1').replace(slice, (_, indent, label, value) => { const share = Math.round(Number(value) / total * 100); return `${indent}"${label} · ${value}${/\p{Script=Han}/u.test(label) ? `（${share}%）` : ` (${share}%)`}" : ${value}`; });
}

/** Render a Mermaid chart to static SVG, or return a located diagnostic reason. */
export function compileExplainerChart(text) {
  const type = detectType(text);
  if (type && NATIVE[type]) return { error: `Mermaid ${type} is drawn with the native ${NATIVE[type]} shorthand, which Archify validates and lets readers explore.`, example: `@${NATIVE[type].split(' ')[0]} id=...` };
  try {
    const result = render(pieLegend(text), { padding: 8, fontSize: 13, links: false, images: false, config: { xyChart: { width: 480, height: 260, showDataLabel: true }, quadrantChart: { chartWidth: 400, chartHeight: 400 } } });
    // A rotated CJK axis title lies on its side; vertical writing keeps the characters upright.
    const svg = result.svg.replace(/<g transform="translate\(([\d.-]+),([\d.-]+)\) rotate\(-90\)"><text x="0" y="[\d.-]+" text-anchor="middle">([^<]*\p{Script=Han}[^<]*)<\/text><\/g>/gu, (_, x, y, label) => `<text x="${x}" y="${y}" text-anchor="middle" writing-mode="vertical-rl">${label}</text>`);
    return { svg, width: result.width, height: result.height, type: result.type };
  } catch (error) {
    if (!(error instanceof PeleError)) throw error;
    const supported = 'pie, xychart-beta (bar and line), quadrantChart, sankey-beta, radar-beta or venn-beta';
    return { error: error.code === 'unsupported-diagram' ? `A chart fence supports ${supported}.` : error.message.split('\n')[0], line: error.line, example: 'pie title Share\n  "A" : 60\n  "B" : 40' };
  }
}

// A data file becomes chart text: CSV with a header row, or JSON as an array of objects. Labels come
// from column x and one series from each column in y; a pie takes the first y column as its values.
export function chartFromData(bytes, filePath, { kind, x, y, unit }) {
  let rows;
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/u, '');
  if (/\.json$/iu.test(filePath)) {
    try { rows = JSON.parse(text); } catch { return { error: 'The data file is not valid JSON.' }; }
    if (!Array.isArray(rows) || !rows.every(row => row && typeof row === 'object' && !Array.isArray(row))) return { error: 'JSON chart data must be an array of objects.' };
  } else {
    const cells = line => { const out = []; let cell = '', quoted = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (quoted) { if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; } else if (c === '"') quoted = true; else if (c === ',') { out.push(cell.trim()); cell = ''; } else cell += c; } out.push(cell.trim()); return out; };
    const lines = text.split(/\r?\n/u).filter(line => line.trim());
    if (lines.length < 2) return { error: 'CSV chart data needs a header row and at least one data row.' };
    const header = cells(lines[0]);
    rows = lines.slice(1).map(line => Object.fromEntries(cells(line).map((value, i) => [header[i], value])));
  }
  const columns = new Set(rows.flatMap(row => Object.keys(row)));
  const missing = [x, ...y].find(column => !columns.has(column));
  if (missing) return { error: `The data file has no column "${missing}". Columns: ${[...columns].join(', ')}.` };
  if (rows.length > (kind === 'pie' ? 12 : 60)) return { error: `A ${kind} chart takes at most ${kind === 'pie' ? 12 : 60} rows; this file has ${rows.length}.` };
  const quote = value => `"${String(value).replace(/["\\]/gu, '')}"`;
  // A blank cell is missing data, not zero: Number('') is 0, so blanks are rejected before conversion.
  const blank = value => value === undefined || value === null || String(value).trim() === '';
  const numbers = column => rows.map(row => blank(row[column]) ? NaN : Number(String(row[column]).replace(/,/gu, '')));
  for (const column of y) {
    const bad = numbers(column).findIndex(value => !Number.isFinite(value));
    if (bad < 0) continue;
    if (blank(rows[bad][column])) return { error: `Column "${column}" is empty in data row ${bad + 1}. A blank is missing data, not zero: fill in the value, or leave the row out and say so in the caption.` };
    return { error: `Column "${column}" has a non-numeric value in data row ${bad + 1}: ${rows[bad][column]}.` };
  }
  if (kind === 'pie') { const values = numbers(y[0]); return { text: `pie\n${rows.map((row, i) => `  ${quote(row[x])} : ${values[i]}`).join('\n')}` }; }
  return { text: `xychart-beta\n  x-axis [${rows.map(row => quote(row[x])).join(', ')}]\n${unit ? `  y-axis ${quote(unit)}\n` : ''}${y.map(column => `  ${kind} ${quote(column)} [${numbers(column).join(', ')}]`).join('\n')}` };
}
