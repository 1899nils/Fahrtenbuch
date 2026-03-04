# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend & Final Image
FROM node:22-alpine
WORKDIR /app

# Copy backend files
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

COPY backend/ ./backend/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/out ./frontend/out

# Copy root package.json for the start script
COPY package*.json ./

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npm", "start"]
