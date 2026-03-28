FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

ENV MCP_TRANSPORT=sse
ENV MCP_PORT=3001

EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
