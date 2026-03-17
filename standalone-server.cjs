const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// SQLite Database Setup
const sqlite3 = require('sqlite3').verbose();
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Initialize table for state persistence
        db.run(`CREATE TABLE IF NOT EXISTS app_state (
            id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error('Error creating table:', err.message);
        });
    }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// API Endpoints
app.get('/api/data', (req, res) => {
    db.get('SELECT data FROM app_state ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.json(null); // No data yet
            return;
        }
        try {
            res.json(JSON.parse(row.data));
        } catch (e) {
            res.status(500).json({ error: 'Failed to parse database data' });
        }
    });
});

app.post('/api/data', (req, res) => {
    const data = JSON.stringify(req.body);
    db.run('INSERT INTO app_state (data, updated_at) VALUES (?, CURRENT_TIMESTAMP)', [data], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true, id: this.lastID });
    });
});

// For SPA support: redirect all other requests to index.html
app.get('*', (req, res) => {
    const distPath = path.join(__dirname, 'dist');
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`====================================================`);
    console.log(`   PLAN DE MANTENIMIENTO - SERVIDOR PORTABLE`);
    console.log(`====================================================`);
    console.log(`Servidor iniciado en: ${url}`);
    console.log(`Para compartir en red, usa la IP de este equipo.`);
    console.log(`Presiona Ctrl+C para cerrar el servidor.`);
    console.log(`====================================================`);

    // Use native Windows command to open browser - Skip if in cloud (DATABASE_PATH is set)
    if (!process.env.DATABASE_PATH) {
        const command = `start ${url}`;
        exec(command, (err) => {
            if (err) {
                console.log(`Por favor, abre manualmente: ${url}`);
            } else {
                console.log(`Abriendo navegador automáticamente...`);
            }
        });
    } else {
        console.log(`Servidor listo. Accede en: ${url}`);
    }
});
