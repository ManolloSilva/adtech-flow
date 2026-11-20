FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE 8080
ENV DB_PATH=/data/adtech.db
CMD ["node", "src/index.js"]