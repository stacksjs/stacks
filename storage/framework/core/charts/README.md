# @stacksjs/charts

Chart.js-compatible charting for Stacks dashboards, rendered to HTML5 canvas.

## Why

Chart.js was previously a direct dependency. This package wraps the chart.js
API (`new Chart(ctx, { type, data, options })`) so dashboards can keep their
existing call sites while the framework drops the upstream dependency.

The implementation is canvas-native and uses [`ts-charts`][1] for scale and
format helpers. Supported chart types: `line`, `bar`, `doughnut`, `pie`. Most
common option shapes (responsive, scales with `beginAtZero`/`stacked`/`grid`/
`ticks.callback`, legends, tooltip callbacks, dual y-axes via `yAxisID: 'y1'`)
are honoured. Less-common features (radar, animations, plugin pipeline,
gradients on dataset properties) fall back to sensible defaults rather than
throwing.

[1]: https://github.com/stacksjs/ts-charts

## Usage

```ts
const { Chart, registerables } = await import('@stacksjs/charts')
Chart.register(...registerables) // no-op, kept for chart.js parity

const chart = new Chart(canvas, {
  type: 'line',
  data: {
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [{ label: 'Revenue', data: [10, 20, 30], borderColor: '#3b82f6' }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } },
  },
})

chart.update()
chart.destroy()
```
