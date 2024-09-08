# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.1.26-debian AS base
WORKDIR /usr/src

# Install curl - I wonder if there is a better way to do this, because it is only needed for the healthcheck — is wget installed by default?
RUN apt-get update && apt-get install -y curl

# [optional] tests & build
# ENV NODE_ENV=production
# RUN bun test
# RUN bun run build

# copy production dependencies and source code into final image
FROM base AS release
COPY ./app ./app
COPY ./config ./config
COPY ./docs ./docs
COPY ./dist ./dist
COPY ./tsconfig.docker.json ./tsconfig.json

# Combine COPY and chown for storage
RUN mkdir -p ./storage && chown -R bun:bun ./storage
COPY --chown=bun:bun ./storage ./storage

# Add storage volume for logs and other files
VOLUME ["/usr/src/storage"]

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "dist/index.js" ]
