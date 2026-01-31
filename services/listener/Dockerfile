FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY services/listener/ ./services/listener/
COPY data.json ./

# Expose port
EXPOSE 3001

# Start the service
CMD ["node", "services/listener/index.js"]