route.view('hello-world')

route.get('users', () => {
  return view('users')
})
