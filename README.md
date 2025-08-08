# 📊 Bot de Finanzas Personales para Telegram

Bot de Telegram para registrar, consultar y administrar tus gastos e ingresos, usando **SQLite** como base de datos y ejecutándose en **Docker Compose**.  

## 🚀 Características

- Registrar **gastos** e **ingresos** con categorías.
- Consultar **balance**, **resúmenes** y **top de gastos**.
- Editar o eliminar registros.
- Exportar movimientos a CSV.
- Establecer metas de ahorro.
- Buscar movimientos por palabra clave.
- Configuración de preferencias con `/config`.
- Persistencia de datos en volumen Docker.

---

## 📋 Lista de Comandos

| Comando | Descripción |
|---------|-------------|
| `/gasto <categoria> <monto>` | Registrar un nuevo gasto. |
| `/ingreso <categoria> <monto>` | Registrar un nuevo ingreso. |
| `/balance` | Mostrar tu balance actual. |
| `/reporte` | Ver resumen mensual. |
| `/categorias` | Ver categorías más comunes. |
| `/topgastos` | Ver los gastos más altos. |
| `/ultimos [n]` | Ver tus últimos n movimientos (por defecto 5). |
| `/resumen [YYYY-MM]` | Ver resumen de un mes específico. |
| `/exportar [YYYY-MM]` | Exportar todos tus movimientos en CSV. |
| `/meta <monto>` | Establecer una meta de ahorro. |
| `/editar <id> <nueva_categoria> <nuevo_monto>` | Editar un movimiento existente. |
| `/eliminar <id>` | Eliminar un movimiento por su ID. |
| `/buscar <texto>` | Buscar movimientos por palabra clave. |
| `/config` | Configurar preferencias del bot. |
| `/ayuda` | Mostrar todos los comandos disponibles. |

---

## 🛠 Requisitos

- **Docker** y **Docker Compose** instalados.
- Token de un bot de Telegram (obtenido desde [@BotFather](https://t.me/BotFather)).

---

## 📦 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/TU_USUARIO/mi-bot-telegram.git
   cd mi-bot-telegram

2. **Configurar el token**
   Edita el archivo docker-compose.yml y agrega tu token en TELEGRAM_TOKEN:
   ```bash
   environment:
     - TELEGRAM_TOKEN=TU_TOKEN_AQUI
   ```

3. **Levantar el contenedor**
   ```bash
   docker compose up -d --build
   ```

4. Ver logs
   ```bash
   docker logs -f telegram-bot
   ```

## 📂 Estructura del Proyecto
```
finanzas-bot/
│── bot.js              # Código principal del bot
│── package.json        # Dependencias
│── Dockerfile          # Imagen Docker
│── docker-compose.yml  # Configuración de servicio
└── data/               # Base de datos SQLite persistente
```
