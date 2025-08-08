const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./finanzas.db');

db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      tipo TEXT CHECK(tipo IN ('gasto', 'ingreso')),
      categoria TEXT,
      monto REAL,
      fecha TEXT
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS metas (
    user_id INTEGER PRIMARY KEY,
    monto_meta INTEGER NOT NULL);`)
});


module.exports = db;
