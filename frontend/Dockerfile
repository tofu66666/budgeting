FROM node:20-alpine

WORKDIR /app

ENV PORT=80

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 80

# Serve the production build; Vercel injects $PORT at runtime
CMD ["npm", "run", "start"]
