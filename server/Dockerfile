FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p /data
ENV PORT=3001
ENV JWT_SECRET=change-this-in-production
EXPOSE 3001
VOLUME ["/data"]
CMD ["node", "index.js"]
