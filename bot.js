const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const commands = [
    { command: 'gasto', description: 'Registrar un nuevo gasto: /gasto <categoria> <monto>' },
    { command: 'ingreso', description: 'Registrar un nuevo ingreso: /ingreso <categoria> <monto>' },
    { command: 'balance', description: 'Mostrar tu balance actual' },
    { command: 'reporte', description: 'Ver resumen mensual' },
    { command: 'categorias', description: 'Ver categorías más comunes' },
    { command: 'topgastos', description: 'Ver los gastos más altos' },
    { command: 'ultimos', description: 'Ver tus últimos movimientos: /ultimos [n]' },
    { command: 'resumen', description: 'Ver resumen de un mes: /resumen [YYYY-MM]' },
    { command: 'exportar', description: 'Exportar movimientos en CSV: /exportar [YYYY-MM]' },
    { command: 'meta', description: 'Establecer meta de ahorro: /meta <monto>' },
    { command: 'editar', description: 'Editar un movimiento: /editar <id> <nueva_categoria> <nuevo_monto>' },
    { command: 'eliminar', description: 'Eliminar un movimiento: /eliminar <id>' },
    { command: 'buscar', description: 'Buscar movimientos: /buscar <texto>' },
    { command: 'ayuda', description: 'Mostrar todos los comandos disponibles' }
];

bot.setMyCommands(commands);

function formatearMoneda(valor) {
    return valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
}

function enviarRespuestaRegistro(chatId, tipo, categoria, monto, rowId) {
    db.get(
        `SELECT 
        SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END) as total_ingresos,
        SUM(CASE WHEN tipo='gasto' THEN monto ELSE 0 END) as total_gastos
     FROM movimientos`,
        [],
        (err, row) => {
            if (err) return bot.sendMessage(chatId, '✅ Registrado, pero no pude calcular el balance.');

            const ingresos = row.total_ingresos || 0;
            const gastos = row.total_gastos || 0;
            const balance = ingresos - gastos;

            const fecha = dayjs().format('DD/MM/YYYY HH:mm');
            const emoji = tipo === 'gasto' ? '💸' : '💵';

            bot.sendMessage(
                chatId,
                `${emoji} *${tipo.toUpperCase()} registrado*\n` +
                `📅 ${fecha}\n` +
                `📂 Categoría: *${categoria}*\n` +
                `💲 Monto: *${formatearMoneda(monto)}*\n` +
                `🆔 Id: *${rowId}*\n\n` +

                `📊 Balance actual: *${formatearMoneda(balance)}*`,
                { parse_mode: 'Markdown' }
            );
        }
    );
}

bot.onText(/^\/gasto (.+) (\d+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const categoria = match[1];
    const monto = parseFloat(match[2]);
    const fecha = dayjs().format('YYYY-MM-DD');
    const userId = msg.from.id;

    db.run(
        'INSERT INTO movimientos (user_id, tipo, categoria, monto, fecha) VALUES (?, ?, ?, ?, ?)',
        [userId, 'gasto', categoria, monto, fecha],
        function (err) {
            if (err) return bot.sendMessage(chatId, '❌ Error al registrar el gasto.');
            enviarRespuestaRegistro(chatId, 'gasto', categoria, monto, this.lastID);
        }
    );
});

bot.onText(/^\/ingreso (.+) (\d+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const categoria = match[1];
    const monto = parseFloat(match[2]);
    const fecha = dayjs().format('YYYY-MM-DD');
    const userId = msg.from.id;

    db.run(
        'INSERT INTO movimientos (user_id, tipo, categoria, monto, fecha) VALUES (?, ?, ?, ?)',
        [userId, 'ingreso', categoria, monto, fecha],
        function (err) {
            if (err) return bot.sendMessage(chatId, '❌ Error al registrar el ingreso.');
            enviarRespuestaRegistro(chatId, 'ingreso', categoria, monto, this.lastID);
        }
    );
});

bot.onText(/^\/balance$/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    db.get(
        `SELECT 
            (SELECT SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END) FROM movimientos WHERE user_id = ?) as total_ingresos,
            (SELECT SUM(CASE WHEN tipo='gasto' THEN monto ELSE 0 END) FROM movimientos WHERE user_id = ?) as total_gastos,
            (SELECT monto_meta FROM metas WHERE user_id = ?) as meta
        `,
        [userId, userId, userId],
        (err, row) => {
            if (err) return bot.sendMessage(chatId, '❌ Error al calcular el balance.');

            const ingresos = row.total_ingresos || 0;
            const gastos = row.total_gastos || 0;
            const balance = ingresos - gastos;
            const meta = row.meta || null;

            let mensaje = `📊 Balance actual:\n` +
                `📥 Ingresos: $${ingresos}\n` +
                `📤 Gastos: $${gastos}\n` +
                `💰 Balance: $${balance}`;

            if (meta) {
                const porcentaje = Math.min((balance / meta) * 100, 100); // máximo 100%
                const progreso = Math.max(0, Math.round(porcentaje)); // mínimo 0%
                const bloques = 10; // cantidad de segmentos de la barra
                const llenos = Math.round((progreso / 100) * bloques);
                const vacios = bloques - llenos;

                const barra = `[${'█'.repeat(llenos)}${'░'.repeat(vacios)}] ${progreso}%`;

                mensaje += `\n🎯 Meta: $${meta}\n📈 Progreso: ${barra}`;

                if (balance >= meta) {
                    mensaje += `\n🏆 ¡Has alcanzado tu meta! 🎉`;
                } else {
                    mensaje += `\n💡 Te faltan $${meta - balance} para llegar a la meta.`;
                }
            } else {
                mensaje += `\n⚠️ No has configurado una meta. Usa /meta <monto>`;
            }

            bot.sendMessage(chatId, mensaje);
        }
    );
});

bot.onText(/^\/reporte$/, (msg) => {
    const chatId = msg.chat.id;
    const mesActual = dayjs().format('YYYY-MM');
    const userId = msg.from.id;

    db.all(
        `SELECT categoria, tipo, SUM(monto) as total
     FROM movimientos
     WHERE user_id = ? AND strftime('%Y-%m', fecha) = ?
     GROUP BY categoria, tipo`,
        [userId, mesActual],
        (err, rows) => {
            if (err) return bot.sendMessage(chatId, 'Error al generar el reporte.');
            if (rows.length === 0) return bot.sendMessage(chatId, 'No hay movimientos este mes.');

            let respuesta = `📅 Reporte de ${mesActual}\n\n`;
            rows.forEach(r => {
                respuesta += `${r.tipo === 'gasto' ? '💸' : '💵'} ${r.categoria}: $${r.total}\n`;
            });

            bot.sendMessage(chatId, respuesta);
        }
    );
});

bot.onText(/^\/categorias(?:\s+([0-9]{4}-[0-9]{2}))?(?:\s+(\d+))?$/, (msg, match) => {
    const chatId = msg.chat.id;
    const mes = match[1];                   // opcional, p.ej. "2025-08"
    const limit = parseInt(match[2]) || 10; // opcional, por defecto 10
    const userId = msg.from.id;

    let where = 'WHERE user_id = ?';
    const params = [userId];

    if (mes) {
        where = " AND strftime('%Y-%m', fecha) = ?";
        params.push(mes);
    }

    const sql = `
    SELECT categoria,
           SUM(CASE WHEN tipo='gasto' THEN monto ELSE 0 END) AS total_gastos,
           SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END) AS total_ingresos,
           COUNT(*) AS veces
    FROM movimientos
    ${where}
    GROUP BY categoria
    ORDER BY veces DESC
    LIMIT ?
  `;

    params.push(limit);

    db.all(sql, params, (err, rows) => {
        if (err) return bot.sendMessage(chatId, '❌ Error al obtener categorías.');

        if (!rows || rows.length === 0) {
            const sin = mes ? `No hay movimientos en ${mes}.` : 'No hay categorías registradas.';
            return bot.sendMessage(chatId, `ℹ️ ${sin}`);
        }

        let header = mes ? `📂 Categorías — ${mes}\n\n` : `📂 Categorías (totales)\n\n`;
        let respuesta = header;

        rows.forEach((r, i) => {
            const totalG = r.total_gastos || 0;
            const totalI = r.total_ingresos || 0;
            const neto = totalI - totalG;
            respuesta += `${i + 1}. ${r.categoria} — ${r.veces} mov. — G: ${formatearMoneda(totalG)} / I: ${formatearMoneda(totalI)} — Neto: ${formatearMoneda(neto)}\n`;
        });

        bot.sendMessage(chatId, respuesta);
    });
});

bot.onText(/^\/topgastos(?:\s+([0-9]{4}-[0-9]{2}))?(?:\s+(\d+))?$/, (msg, match) => {
    const chatId = msg.chat.id;
    const mes = match[1] || dayjs().format('YYYY-MM'); // Por defecto mes actual
    const limit = parseInt(match[2]) || 5;             // Por defecto top 5
    const userId = msg.from.id;

    const sql = `
    SELECT categoria, monto, fecha
    FROM movimientos
    WHERE user_id = ? AND tipo = 'gasto' AND strftime('%Y-%m', fecha) = ?
    ORDER BY monto DESC
    LIMIT ?
  `;

    db.all(sql, [userId, mes, limit], (err, rows) => {
        if (err) return bot.sendMessage(chatId, '❌ Error al obtener el top de gastos.');

        if (!rows || rows.length === 0) {
            return bot.sendMessage(chatId, `ℹ️ No hay gastos registrados en ${mes}.`);
        }

        let mensaje = `🏆 Top ${rows.length} gastos — ${mes}\n\n`;
        rows.forEach((r, i) => {
            mensaje += `${i + 1}. ${r.categoria} — $${r.monto.toLocaleString('es-CO')} — ${dayjs(r.fecha).format('DD/MM/YYYY')}\n`;
        });

        const mensajeSeguro = mensaje.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
        bot.sendMessage(chatId, mensajeSeguro, { parse_mode: 'MarkdownV2' });
    });
});

bot.onText(/^\/ultimos(?:\s+(\d+))?$/, (msg, match) => {
    const chatId = msg.chat.id;
    const limit = parseInt(match[1]) || 5;
    const userId = msg.from.id;

    const sql = `
        SELECT id, tipo, categoria, monto, fecha
        FROM movimientos
        WHERE user_id = ?
        ORDER BY fecha DESC
        LIMIT ?
    `;

    db.all(sql, [userId, limit], (err, rows) => {
        if (err) return bot.sendMessage(chatId, '❌ Error al obtener movimientos.');

        if (!rows.length) {
            return bot.sendMessage(chatId, 'ℹ️ No tienes movimientos registrados.');
        }

        let mensaje = `📜 Últimos ${rows.length} movimientos:\n\n`;
        rows.forEach((r, i) => {
            const emoji = r.tipo === 'gasto' ? '💸' : '💵';
            mensaje += `${i + 1}. ${emoji} ID: ${r.id} ${r.categoria} — ${formatearMoneda(r.monto)} — ${dayjs(r.fecha).format('DD/MM/YYYY')}\n`;
        });

        const mensajeSeguro = mensaje.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
        bot.sendMessage(chatId, mensajeSeguro, { parse_mode: 'MarkdownV2' });
    });
});

bot.onText(/^\/resumen(?:\s+([0-9]{4}-[0-9]{2}))?$/, (msg, match) => {
    const chatId = msg.chat.id;
    const mes = match[1] || dayjs().format('YYYY-MM');
    const userId = msg.from.id;

    const sql = `
        SELECT 
            SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END) as total_ingresos,
            SUM(CASE WHEN tipo='gasto' THEN monto ELSE 0 END) as total_gastos
        FROM movimientos
        WHERE user_id = ? AND strftime('%Y-%m', fecha) = ?
    `;

    db.get(sql, [userId, mes], (err, row) => {
        if (err) return bot.sendMessage(chatId, '❌ Error al obtener resumen.');

        const ingresos = row.total_ingresos || 0;
        const gastos = row.total_gastos || 0;
        const balance = ingresos - gastos;

        let mensaje = `📅 Resumen — ${mes}\n\n`;
        mensaje += `💵 Ingresos: ${formatearMoneda(ingresos)}\n`;
        mensaje += `💸 Gastos: ${formatearMoneda(gastos)}\n`;
        mensaje += `💰 Balance: ${formatearMoneda(balance)}\n`;

        const mensajeSeguro = mensaje.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
        bot.sendMessage(chatId, mensajeSeguro, { parse_mode: 'MarkdownV2' });
    });
});

bot.onText(/^\/exportar$/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    db.all(
        `SELECT fecha, tipo, categoria, monto 
         FROM movimientos
         WHERE user_id = ?
         ORDER BY fecha ASC`,
        [userId],
        (err, rows) => {
            if (err) {
                console.error(err);
                return bot.sendMessage(chatId, '❌ Error al exportar tus movimientos.');
            }

            if (!rows.length) {
                return bot.sendMessage(chatId, '📭 No tienes movimientos registrados para exportar.');
            }

            // Crear contenido CSV
            let csvContent = "Fecha,Tipo,Categoría,Monto\n";
            rows.forEach(row => {
                csvContent += `${row.fecha},${row.tipo},${row.categoria},${row.monto}\n`;
            });

            // Guardar CSV temporalmente
            const filePath = path.join(__dirname, `movimientos_${userId}.csv`);
            fs.writeFileSync(filePath, csvContent, 'utf8');

            // Enviar archivo a Telegram
            bot.sendDocument(chatId, filePath, {
                caption: '📄 Aquí tienes el historial de tus movimientos en formato CSV.'
            }).then(() => {
                // Eliminar archivo temporal después de enviarlo
                fs.unlinkSync(filePath);
            }).catch(err => {
                console.error(err);
                bot.sendMessage(chatId, '❌ Ocurrió un error al enviar el archivo.');
            });
        }
    );
});

bot.onText(/^\/buscar (.+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const texto = match[1];

    db.all(
        `SELECT id, tipo, categoria, monto, fecha
         FROM movimientos
         WHERE user_id = ? AND categoria LIKE ? 
         ORDER BY fecha DESC LIMIT 10`,
        [userId, `%${texto}%`],
        (err, rows) => {
            if (err) return bot.sendMessage(chatId, 'Error al buscar movimientos.');
            if (rows.length === 0) return bot.sendMessage(chatId, 'No se encontraron movimientos.');

            let respuesta = `Resultados de búsqueda para "${texto}":\n`;
            rows.forEach(r => {
                respuesta += `ID: ${r.id} | ${r.tipo} - ${r.categoria} - $${r.monto} - ${r.fecha}\n`;
            });

            bot.sendMessage(chatId, respuesta);
        }
    );
});

bot.onText(/^\/eliminar (\d+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const id = parseInt(match[1]);

    db.run(
        `DELETE FROM movimientos WHERE id = ? AND user_id = ?`,
        [id, userId],
        function (err) {
            if (err) return bot.sendMessage(chatId, 'Error al eliminar el movimiento.');
            if (this.changes === 0) return bot.sendMessage(chatId, 'No se encontró el movimiento.');
            bot.sendMessage(chatId, `Movimiento con ID ${id} eliminado correctamente.`);
        }
    );
});

bot.onText(/^\/editar (\d+) (\w+) (\d+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const id = parseInt(match[1]);
    const nuevaCategoria = match[2];
    const nuevoMonto = parseInt(match[3]);

    db.run(
        `UPDATE movimientos
         SET categoria = ?, monto = ?
         WHERE id = ? AND user_id = ?`,
        [nuevaCategoria, nuevoMonto, id, userId],
        function (err) {
            if (err) return bot.sendMessage(chatId, 'Error al editar el movimiento.');
            if (this.changes === 0) return bot.sendMessage(chatId, 'No se encontró el movimiento.');
            bot.sendMessage(chatId, `Movimiento con ID ${id} actualizado: ${nuevaCategoria} - $${nuevoMonto}`);
        }
    );
});

bot.onText(/^\/meta (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const meta = parseInt(match[1]);

    db.run(
        `INSERT INTO metas (user_id, monto_meta) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET monto_meta = excluded.monto_meta`,
        [userId, meta],
        function (err) {
            if (err) return bot.sendMessage(chatId, '❌ Error al guardar la meta.');
            bot.sendMessage(chatId, `🎯 Meta de ahorro fijada en $${meta}.`);
        }
    );
});

bot.onText(/^\/ayuda$/, (msg) => {
    const chatId = msg.chat.id;

    let mensaje = '📖 *Lista de comandos disponibles*\n\n';
    commands.forEach(c => {
        mensaje += `/${c.command} — ${c.description}\n`;
    });

    bot.sendMessage(chatId, mensaje, { parse_mode: 'Markdown' });
});

