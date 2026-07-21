// The Stacks desktop application is the dashboard hosted in a native Craft
// window. Keeping one server entry means desktop and dashboard share routes,
// settings, authentication, rpx/tlsx pretty URLs, and hot reload behavior.
await import('./dashboard')
