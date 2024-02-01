# Builder image
FROM oven/bun:latest AS builder
WORKDIR /tmp

COPY runtime.ts index.ts package.json .

RUN bun install @stacksjs/router aws4fetch
RUN bun build --compile runtime.ts --outfile bootstrap
RUN bun build --target=bun index.ts --outfile index --external @stacksjs/router

# Runtime image, includes Lambda RIC
FROM public.ecr.aws/lambda/provided:al2

COPY --from=builder /tmp/index ${LAMBDA_TASK_ROOT}
COPY --from=builder /tmp/node_modules ${LAMBDA_TASK_ROOT}
# Copy bun + runtime.ts into the runtime directory
COPY --from=builder /tmp/bootstrap ${LAMBDA_RUNTIME_DIR}

# Set our handler method
CMD ["index.fetch"]
