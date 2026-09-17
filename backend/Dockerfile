FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache git ca-certificates openssh-client

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache git ca-certificates openssh-client
RUN git config --system --add safe.directory /data/n8n-cicd-workflows

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
