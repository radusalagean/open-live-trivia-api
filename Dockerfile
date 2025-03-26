FROM node:22

COPY secrets/ ~/.open-live-trivia_vault/

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

EXPOSE 3006

CMD ["npm", "start"]