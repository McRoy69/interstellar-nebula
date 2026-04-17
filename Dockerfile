# Usaremos Node 20 por estabilidad y ligereza en producción
FROM node:20-slim

WORKDIR /app

# Solo instalamos dependencias de producción (mucho más ligero)
COPY package*.json ./
RUN npm install --omit=dev

# Copiamos los archivos generados en GitHub
COPY standalone-server.cjs ./
COPY dist ./dist

# Los archivos .env y config.js los manejamos de forma segura
# (Si no existen en el contexto de copia, Docker fallaría sin ellos,
# así que solo copiamos lo que SEGURO está en el repositorio)

EXPOSE 3000
CMD ["node", "standalone-server.cjs"]
