FROM node:20-bullseye

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ruby-full \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
ENV PORT=3000

CMD ["npm", "run", "server"]
