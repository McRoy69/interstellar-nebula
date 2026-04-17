# Usaremos Node 20 por estabilidad y ligereza en producción
FROM node:20-slim

WORKDIR /app

# Solo instalamos dependencias de producción (mucho más ligero)
COPY package*.json ./
RUN npm install --omit=dev

# Copiamos el servidor y la carpeta dist (que subimos desde GitHub)
COPY standalone-server.cjs ./
COPY dist ./dist
COPY config.js ./config.js 2>/dev/null || :
COPY .env ./ 2>/dev/null || :

# El resto del código fuente NO es necesario en el servidor
EXPOSE 3000
CMD ["node", "standalone-server.cjs"]
