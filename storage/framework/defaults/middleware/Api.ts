// import { HttpError } from '@stacksjs/error-handling'
// import { Middleware, request } from '@stacksjs/router'
// import { AccessToken, Team } from '@stacksjs/orm'

// export default new Middleware({
//   name: 'API Authentication',
//   priority: 1,
//   async handle() {
//     const bearerToken = request.bearerToken() || ''

//     if (!bearerToken)
//       throw new HttpError(401, 'Unauthorized.')

//     const parts = bearerToken.split(':')

//     if (parts.length !== 3)
//       throw new HttpError(401, 'Invalid bearer token format')

//     const tokenId = Number(parts[0])
//     const teamId = parts[1] as string
//     const plainString = parts[2] as string

//     const team = await Team.find(Number(teamId))

//     if (!team)
//       throw new HttpError(401, 'Invalid bearer token')

//     const accessTokens = await team.teamAccessTokens()

//     if (!accessTokens.length)
//       throw new HttpError(401, 'Invalid bearer token')

//     const accessTokenIds = accessTokens.map(accessToken => accessToken.id)

//     if (!accessTokenIds.includes(tokenId))
//       throw new HttpError(401, 'Invalid bearer token')

//     const teamBearerToken = await AccessToken.where('token', plainString).first()

//     if (!teamBearerToken)
//       throw new HttpError(401, 'Invalid bearer token')
//   },
// })
