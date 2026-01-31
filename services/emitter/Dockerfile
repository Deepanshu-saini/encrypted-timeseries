FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY services/emitter/ ./services/emitter/
COPY data.json ./

# Expose port for Render
EXPOSE 3002

# Start the service
CMD ["node", "services/emitter/index.js"]