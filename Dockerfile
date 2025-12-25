FROM node:20-alpine

WORKDIR /app

# Install dependencies first
COPY package*.json ./
RUN npm config set fetch-retry-maxtimeout 600000 && \
    npm config set fetch-timeout 600000 && \
    npm install || (cat /root/.npm/_logs/*.log && exit 1)

# Copy rest of the code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies for smaller image
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start the server
# The initScheduler() is called in server.ts under production mode
CMD ["npm", "run", "server"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
