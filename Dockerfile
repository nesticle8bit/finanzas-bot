# Imagen base de Node.js
FROM node:20

# Crear carpeta de la app
WORKDIR /app

# Copiar package.json e instalar dependencias
COPY package*.json ./
RUN npm install --production

# Copiar el resto del código
COPY . .

# Crear carpeta para base de datos
RUN mkdir -p /app/data

# Variables de entorno
ENV NODE_ENV=production

# Comando para iniciar el bot
CMD ["node", "bot.js"]
