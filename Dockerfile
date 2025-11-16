# Use official Puppeteer image (includes Chrome and all dependencies)
FROM ghcr.io/puppeteer/puppeteer:21.11.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (using install instead of ci since package-lock.json is gitignored)
RUN npm install --omit=dev

# Copy application code
COPY . .

# Create directory for Puppeteer cache
RUN mkdir -p /app/.cache

# Set environment to production
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Expose port for health checks
EXPOSE 8080

# Run the application with health check server
CMD ["node", "src/server.js"]
