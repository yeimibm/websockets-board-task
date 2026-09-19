FROM node:22-alpine AS builder
WORKDIR /workspace
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile
ARG VITE_WS_URL=ws://localhost:8000
ENV VITE_WS_URL=$VITE_WS_URL
RUN pnpm --filter @collab/websocket-protocol build \
    && pnpm --filter @collab/web build

FROM node:22-alpine AS runner
WORKDIR /workspace/apps/web
ENV NODE_ENV=production PORT=3000
COPY --from=builder /workspace/node_modules /workspace/node_modules
COPY --from=builder /workspace/apps/web/node_modules /workspace/apps/web/node_modules
COPY --from=builder /workspace/apps/web/dist /workspace/apps/web/dist
COPY --from=builder /workspace/apps/web/dist-server /workspace/apps/web/dist-server
COPY --from=builder /workspace/apps/web/package.json /workspace/apps/web/package.json
WORKDIR /workspace/apps/web
EXPOSE 3000
CMD ["node", "dist-server/server.js"]
