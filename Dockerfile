FROM node:20-alpine
WORKDIR /app

# Install Docker CLI to call ml_worker
# not the proper way but we are too far gone with cron-node
# Why can't it be like celery
RUN apk add --no-cache docker-cli

COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

