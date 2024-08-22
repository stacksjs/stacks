# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.1.25-debian AS base
WORKDIR /usr/src

# Install curl - I wonder if there is a better way to do this, because it is only needed for the healthcheck — is wget installed by default?
RUN apt-get update && apt-get install -y curl

# [optional] tests & build
# ENV NODE_ENV=production
# RUN bun test
# RUN bun run build

# copy production dependencies and source code into final image
FROM base AS release
COPY ./storage ./storage
COPY ./config ./config
COPY ./docs ./docs
COPY ./dist/* ./
COPY ./tsconfig.json ./

# Create log directory and set permissions
RUN chown -R bun:bun ./storage

# Add volume for logs
VOLUME ["/usr/src/storage"]

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "index.js" ]
