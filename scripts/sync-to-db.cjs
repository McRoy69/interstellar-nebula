const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const realDataPath = path.join(__dirname, '../src/data/realData.json');
const dbPath = path.join(__dirname, '../database.sqlite');

if (!fs.existsSync(realDataPath)) {
    console.error('Error: src/data/realData.json not found. Run extract-all.cjs first.');
    process.exit(1);
}

const freshData = JSON.parse(fs.readFileSync(realDataPath, 'utf8'));

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }

    console.log('Connected to database for sync.');

    // Create table if missing to prevent "no such table" error
    db.run(`CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
            process.exit(1);
        }

        db.get('SELECT data FROM app_state ORDER BY id DESC LIMIT 1', (err, row) => {
            if (err) {
                console.error('Error reading from DB:', err.message);
                process.exit(1);
            }

            let currentState = { departments: [], settings: {} };
            if (row && row.data) {
                try {
                    currentState = JSON.parse(row.data);
                    console.log('Current state loaded from DB.');
                } catch (e) {
                    console.warn('Could not parse current DB data, starting fresh.');
                }
            }

            // Merge: Update departments but keep settings (unless they are missing)
            currentState.departments = freshData;

            const updatedDataStr = JSON.stringify(currentState);

            db.run('INSERT INTO app_state (data, updated_at) VALUES (?, CURRENT_TIMESTAMP)', [updatedDataStr], function (err) {
                if (err) {
                    console.error('Error updating DB:', err.message);
                    process.exit(1);
                }
                console.log(`Success! Database updated with ${freshData.length} departments. (Entry ID: ${this.lastID})`);
                db.close();
            });
        });
    });
});
