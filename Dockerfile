# syntax=docker/dockerfile:1
FROM node:24-slim AS build
ENV CI=true
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter @qroove/server deploy --prod --legacy /out/server

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/docs/.vitepress/dist ./docs/.vitepress/dist
USER node
CMD ["node", "apps/server/dist/main.js"]
