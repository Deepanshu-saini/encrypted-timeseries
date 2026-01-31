FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY services/emitter/ ./services/emitter/
COPY data.json ./

# Start the service
CMD ["node", "services/emitter/index.js"]