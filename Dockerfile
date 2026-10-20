FROM node:22-alpine

WORKDIR /app

# Copy dependency files first for layer caching
COPY package.json package-lock.json* ./

RUN npm ci --production=false

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (default 8081)
EXPOSE 8081

# Run with tsx for dev, or node dist/main.js for production
CMD ["npm", "start"]
