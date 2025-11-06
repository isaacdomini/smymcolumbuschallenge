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
CMD ["npm", "run", "server"]
