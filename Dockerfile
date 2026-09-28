# syntax=docker/dockerfile:1

# Install deps natively on the build machine, fetching OpenTUI's native binary for the
# target platform. The final stage has no RUN steps, so cross-builds need no emulation.
FROM --platform=$BUILDPLATFORM node:26-slim AS deps
ARG TARGETARCH
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --os=linux --cpu=$([ "$TARGETARCH" = amd64 ] && echo x64 || echo "$TARGETARCH") \
 && mkdir /data

FROM node:26-slim
ENV NODE_ENV=production \
    TERM=xterm-256color \
    COLORTERM=truecolor \
    MOBY_SAVE=/data/moby-escape-save.json
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /data /data
COPY package.json ./
COPY bin ./bin
COPY src ./src
USER node
VOLUME /data
# Run main.js directly (rather than via the launcher) so the game is PID 1 and gets signals.
ENTRYPOINT ["node", "--experimental-ffi", "--no-warnings", "src/main.js"]
