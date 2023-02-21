interface ModelData {
  [key: string]: any
}

const User: ModelData = {
  name: 'User',
  fields: [
    {
      name: 'name',
      type: 'String',
      unique: true,
    },
    {
      name: 'email',
      type: 'String',
      unique: true,
    },
    {
      name: 'password',
      type: 'String',
    },
  ],
}

export default User
