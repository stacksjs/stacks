# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
# TODO: use alpine layer
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Install curl - I wonder if there is a better way to do this, because it is only needed for the healthcheck — is wget installed by default?
RUN apt-get update && apt-get install -y curl rsync

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
# COPY package.json bun.lockb /temp/dev/ # TODO: add bun.lockb back in
COPY package.json /temp/dev/
COPY tsconfig.json /temp/dev/
COPY core/ /temp/dev/core/

RUN cd /temp/dev && bun install

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
COPY . .

# [optional] tests & build
# ENV NODE_ENV=production
# RUN bun test
# RUN bun run build

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules ./node_modules

# Use rsync to copy files while respecting .gitignore and .dockerignore
# https://unix.stackexchange.com/questions/168561/rsync-folder-while-exclude-froming-gitignore-files-at-different-depths
RUN rsync --filter='dir-merge,-n /.gitignore' /usr/src/app/ /usr/src/app_release/

COPY --from=prerelease /usr/src/app_release/app ./app
COPY --from=prerelease /usr/src/app_release/config ./config
COPY --from=prerelease /usr/src/app_release/core ./core
COPY --from=prerelease /usr/src/app_release/docs ./docs
COPY --from=prerelease /usr/src/app_release/routes ./routes
COPY --from=prerelease /usr/src/app_release/storage ./storage
COPY --from=prerelease /usr/src/app_release/index.ts ./index.ts
COPY --from=prerelease /usr/src/app_release/tsconfig.json ./tsconfig.json
COPY --from=prerelease /usr/src/app_release/package.json ./package.json

# Add volume for logs
VOLUME ["/mnt/efs"]

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "index.ts" ]
