# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.1.24-debian AS base
WORKDIR /usr/src/app

# Install curl - I wonder if there is a better way to do this, because it is only needed for the healthcheck — is wget installed by default?
RUN apt-get update && apt-get install -y curl

# [optional] tests & build
# ENV NODE_ENV=production
# RUN bun test
# RUN bun run build

# copy production dependencies and source code into final image
FROM base AS release
COPY /usr/src/app/app ./app
COPY /usr/src/app/config ./config
COPY /usr/src/app/docs ./docs
COPY /usr/src/app/routes ./routes
# TODO: need to exclude all ignored files and folders from the build
COPY /usr/src/app/storage ./storage
COPY /usr/src/app/dist/* ./

# Add volume for logs
VOLUME ["/mnt/efs"]

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "index.js" ]
