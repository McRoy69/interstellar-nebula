const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// SQLite Database Setup
const sqlite3 = require('sqlite3').verbose();
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');

// Ensure directory exists for DB if a custom path is provided
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    console.log(`Creating directory for database: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('CRITICAL: Error opening database:', err.message);
        process.exit(1); // Exit if DB cannot be opened
    } else {
        console.log(`Connected to the SQLite database at: ${dbPath}`);
        // Initialize table for state persistence
        db.run(`CREATE TABLE IF NOT EXISTS app_state (
            id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            } else {
                console.log('Database schema verified.');
            }
        });
    }
});

app.use(express.json({ limit: '50mb' }));

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
} else {
    console.warn('WARNING: "dist" folder not found. Frontend might not load.');
}

// API Endpoints
app.get('/api/data', (req, res) => {
    db.get('SELECT data FROM app_state ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) {
            console.error('DB Get Error:', err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.json(null);
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
            console.error('DB Post Error:', err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true, id: this.lastID });
    });
});

// For SPA support: redirect all other requests to index.html
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Application build (dist/index.html) not found. Please run "npm run build" first.');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    const url = `http://localhost:${PORT}`;
    console.log(`====================================================`);
    console.log(`   PLAN DE MANTENIMIENTO - SERVIDOR CLOUD/PORTABLE`);
    console.log(`====================================================`);
    console.log(`Servidor iniciado en Puerto: ${PORT}`);
    console.log(`Binding: 0.0.0.0`);
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
        console.log(`Servidor de producción listo.`);
    }
});
