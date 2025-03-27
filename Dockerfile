FROM node:22

COPY .open-live-trivia_vault/ /root/.open-live-trivia_vault/

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

EXPOSE 3006

CMD ["npm", "start"]