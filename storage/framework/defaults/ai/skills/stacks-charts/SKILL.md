---
name: stacks-charts
description: Use when rendering native dashboard charts, configuring scales or tooltips, or managing canvas chart lifecycle. Covers @stacksjs/charts and its Chart.js-compatible subset.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Native charts

Import Chart from @stacksjs/charts. The package supplies a canvas renderer over
ts-charts primitives with a compatibility-shaped configuration. It is not a
promise of complete Chart.js plugin, animation or chart-type parity.

## Lifecycle and supported behavior

Mount a chart once its canvas is available; update data/options and call update,
then destroy it when the view is removed. Use stx refs and lifecycle helpers
rather than global DOM lookups in a template. Keep dimensions and device pixel
ratio under the renderer's sizing contract to avoid compounding canvas resize.

Line, bar, pie and doughnut have their native rendering paths. Radar currently
falls back to a line layout. Advanced animation/plugin options are not a full
implementation; inspect the chosen option before promising a visual effect.
Chart.register/registerables are compatibility shims, not a third-party plugin
registry. Scales, legend, colors, ticks and tooltip callbacks have native helpers.

Read ChartConfig/ChartData/ChartOptions from the package types and reuse the
dashboard's established chart integration. Test zero/negative values, sizing,
dual axes where used, updates and destruction. Provide meaningful accessible
text or tabular data alongside a canvas chart.

Source: core/charts/src/{chart,types,colors,ticks,sizing}.ts. Retained tests:
scales.test.ts, ticks.test.ts and sizing.test.ts.
