# Builder image
FROM oven/bun:latest AS builder
WORKDIR /tmp

COPY ./runtime.ts ./runtime.ts
COPY ./index.ts ./index.ts

RUN bun add aws4fetch
RUN bun add @stacksjs/cloud
RUN bun build --compile runtime.ts --outfile bootstrap
# TODO: remove the --external @stacksjs/cloud
RUN bun build --target=bun index.ts --outfile index --external @stacksjs/cloud

# Runtime image, includes Lambda RIC
FROM public.ecr.aws/lambda/provided:al2

# Copy our handler code into the task root
COPY --from=builder /tmp/index ${LAMBDA_TASK_ROOT}
# Copy bun + runtime.ts into the runtime directory
COPY --from=builder /tmp/bootstrap ${LAMBDA_RUNTIME_DIR}

# Set our handler method
CMD ["index.fetch"]
