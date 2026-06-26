# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files and build
COPY . .
RUN npm run build

# Stage 2: Production environment
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy the Firebase config file
COPY firebase-applet-config.json ./

# Cloud Run defaults to port 8080
EXPOSE 8080

# Start the Node server
CMD ["npm", "run", "start"]
