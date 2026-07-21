ARG BUN_VERSION=1.3.14

# Keep the build and runtime distributions identical. Alpine avoids carrying
# Debian's package database and shell utilities into the production image.
FROM oven/bun:${BUN_VERSION}-alpine AS builder
WORKDIR /usr/src

# Copy source files
COPY ./app ./app
COPY ./config ./config
COPY ./docs ./docs
COPY ./dist ./dist
COPY ./tsconfig.docker.json ./tsconfig.json

# [optional] Run tests and build
# ENV NODE_ENV=production
# RUN bun test
# RUN bun run build

FROM oven/bun:${BUN_VERSION}-alpine AS release
WORKDIR /usr/src

# Copy built files from builder stage
COPY --chown=bun:bun --from=builder /usr/src/app ./app
COPY --chown=bun:bun --from=builder /usr/src/config ./config
COPY --chown=bun:bun --from=builder /usr/src/docs ./docs
COPY --chown=bun:bun --from=builder /usr/src/dist ./dist
COPY --chown=bun:bun --from=builder /usr/src/tsconfig.json ./tsconfig.json
COPY --chown=bun:bun ./storage ./storage

# Add storage volume for logs and other files
VOLUME ["/usr/src/storage"]

USER bun

# Expose port and set entrypoint
EXPOSE 3000/tcp
ENTRYPOINT ["bun", "run", "dist/index.js"]
