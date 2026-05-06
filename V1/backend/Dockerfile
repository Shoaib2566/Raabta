FROM node:22-slim

WORKDIR /app

COPY backend/package*.json ./backend/

WORKDIR /app/backend

RUN npm install

WORKDIR /app

COPY backend ./backend
COPY frontend ./frontend

EXPOSE 5000

CMD ["node", "backend/server.js"]
