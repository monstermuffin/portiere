FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache gettext

COPY package.json ./

RUN npm install

COPY server.js .
COPY public/ public/

RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'envsubst < /app/public/script.js > /app/public/script.js.tmp && mv /app/public/script.js.tmp /app/public/script.js' >> /docker-entrypoint.sh && \
    echo 'node server.js' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]