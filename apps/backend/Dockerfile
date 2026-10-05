# The API: compiled once, then run from a slim image with production dependencies only
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
# Migrations and holiday data are run from this image by deploy/remote-deploy.sh
COPY migrations ./migrations
COPY data ./data
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
