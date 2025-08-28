# Build stage
FROM oven/bun:1.2.21-debian AS builder
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

# Final stage
FROM oven/bun:1.2.21-debian AS release
WORKDIR /usr/src

# Copy built files from builder stage
COPY --from=builder /usr/src/app ./app
COPY --from=builder /usr/src/config ./config
COPY --from=builder /usr/src/docs ./docs
COPY --from=builder /usr/src/dist ./dist
COPY --from=builder /usr/src/tsconfig.json ./tsconfig.json

# Set up storage directory
USER root
RUN mkdir -p ./storage
COPY --chown=bun:bun ./storage ./storage

# Install curl for the healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && apt-get clean && rm -rf /var/lib/apt/lists/*

# Add storage volume for logs and other files
VOLUME ["/usr/src/storage"]

# Switch to non-root user
USER bun

# Expose port and set entrypoint
EXPOSE 3000/tcp
ENTRYPOINT ["bun", "run", "dist/index.js"]
