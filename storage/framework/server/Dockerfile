# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install curl - I wonder if there is a better way to do this, because it is only needed for the healthcheck
RUN apt-get update && apt-get install -y curl

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
# COPY package.json bun.lockb /temp/dev/ # TODO: add bun.lockb back in
COPY package.json /temp/dev/
COPY tsconfig.json /temp/dev/
COPY core/ /temp/dev/core/
RUN cd /temp/dev && bun install
# RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
# COPY package.json bun.lockb /temp/prod/
COPY package.json /temp/prod/
COPY tsconfig.json /temp/prod/
COPY core/ /temp/prod/core/
RUN cd /temp/prod && bun install
# RUN cd /temp/prod && bun install --production --frozen-lockfile

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules ./node_modules
COPY ./Actions ./Actions
COPY ./app ./app
COPY ./config ./config
COPY ./core ./core
COPY ./docs ./docs
COPY ./routes ./routes
COPY ./storage ./storage
COPY ./index.ts ./index.ts
COPY ./package.json ./package.json
COPY ./tsconfig.json ./tsconfig.json

# [optional] tests & build
# ENV NODE_ENV=production
# RUN bun test
# RUN bun run build

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules ./node_modules
COPY --from=prerelease /usr/src/app/index.ts ./index.ts
COPY --from=prerelease /usr/src/app/tsconfig.json ./tsconfig.json
COPY --from=prerelease /usr/src/app/package.json ./package.json
COPY --from=prerelease /usr/src/app/Actions ./Actions
COPY --from=prerelease /usr/src/app/app ./app
COPY --from=prerelease /usr/src/app/config ./config
COPY --from=prerelease /usr/src/app/core ./core
COPY --from=prerelease /usr/src/app/docs ./docs
COPY --from=prerelease /usr/src/app/routes ./routes
COPY --from=prerelease /usr/src/app/storage ./storage

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "index.ts" ]
