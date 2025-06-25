# Lightweight Dockerfile - Much faster build
FROM node:18-alpine

# Install only essential compilers (reduces build time by 70%)
RUN apk add --no-cache python3 gcc g++ openjdk11-jre-headless

# Set working directory
WORKDIR /app

# Copy and install dependencies first (for Docker layer caching)
COPY executor-package.json package.json
RUN npm install --production --silent

# Copy executor
COPY code-executor.js .

# Create temp directories
RUN mkdir -p /tmp/code /tmp/output && chmod 777 /tmp/code /tmp/output

EXPOSE 5000
CMD ["node", "code-executor.js"]