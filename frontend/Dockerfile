FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install \
    && ROLLUP_VERSION="$(node -p "require('rollup/package.json').version")" \
    && ROLLUP_ARCH="$(node -p "process.arch")" \
    && npm install --no-save --no-package-lock \
      "@rollup/rollup-linux-${ROLLUP_ARCH}-musl@${ROLLUP_VERSION}"

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
