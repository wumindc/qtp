FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

FROM base AS source
COPY . .
RUN pnpm install --frozen-lockfile

FROM source AS web
ARG NEXT_PUBLIC_GATEWAY_ORIGIN=same-origin
ENV NEXT_PUBLIC_GATEWAY_ORIGIN=${NEXT_PUBLIC_GATEWAY_ORIGIN}
RUN pnpm --filter web build
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]

FROM source AS service
ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}
CMD ["sh", "-c", "pnpm --filter ${SERVICE_NAME} start"]
