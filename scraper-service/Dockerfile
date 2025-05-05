FROM node:18-slim
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx playwright install --with-deps
EXPOSE 3001
CMD ["npm", "start"]
