const handler = {
  async hello(_event: any) {
    // eslint-disable-next-line no-console
    console.log('Hello from Bun!')
    return new Response(
      JSON.stringify({
        body: {
          handlerTs: Date.now(),
        },
      }),
    )
  },
}
export { handler as default }
