FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm i -g nodemon && npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY ./logToTrace.js /usr/src/app/logToTrace.js
COPY ./logToMetrics.js /usr/src/app/logToMetrics.js
COPY ./logs/ /usr/src/app/logs/

# ENTRYPOINT [ "/bin/sh", "-c" ]

CMD [ "npm", "run", "prod" ]