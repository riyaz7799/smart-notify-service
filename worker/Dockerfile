FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (no lockfile present; omit dev deps)
RUN npm install --omit=dev

# Copy application code
COPY src ./src

# Start the worker
CMD ["node", "src/index.js"]
