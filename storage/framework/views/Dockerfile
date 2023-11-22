FROM node:21-alpine as build-stage

WORKDIR /app
RUN corepack enable

COPY .npmrc package.json ./
RUN bun install

COPY . .
RUN bun run build

FROM nginx:stable-alpine as production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
