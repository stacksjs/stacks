class Model {
  id?: number
  value = 1
  queries: Object = {}

  constructor() {
    return { id: this.id, value: this.value, queries: this.queries }
  }
}

export default Model
