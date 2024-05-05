async function request(url = '', method = 'GET', data = {}): Promise<any> {
  // Default options are marked with *
  const fetchBody: RequestInit = {
    method, // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data),
  }

  if (data && Object.keys(data).length === 0 && Object.getPrototypeOf(data) === Object.prototype)
    fetchBody.body = undefined

  const response = await fetch(url, fetchBody)

  return response.json() // parses JSON response into native JavaScript objects
}

export default request
