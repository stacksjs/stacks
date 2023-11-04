export async function hello(event: any) {
  console.log('Hello from Bun!')

  return new Response(
    JSON.stringify({
      body: {
        handlerTs: Date.now(),
      },
    }),
  )
}
