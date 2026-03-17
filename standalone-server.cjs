const fs = require('fs');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

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

// SMTP Configuration (Metanet)
const transporter = nodemailer.createTransport({
    host: 'futura.metanet.ch',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: 'michael.jenni@blessing.ch',
        pass: '16MnCrS5?'
    }
});

const getReportHtml = (appData, isAutomated = false) => {
    const kw = appData.settings?.currentKw || 12;
    const appUrl = process.env.APP_URL || 'https://wartungsplan.up.railway.app';

    return `
    <html>
    <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2c3e50;">Zentrale Statistik - KW ${kw}</h2>
            <p>Guten Morgen zusammen,</p>
            <p>anbei sende ich euch die aktuelle Statistik aller Abteilungen (Flop-2 Verspätungen).</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold;">Direkter Link zur App:</p>
                <a href="${appUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Wartungsplan öffnen</a>
            </div>

            <p style="font-size: 0.9em; color: #666;">
                Bei Fragen einfach kurz melden.<br>
                Vielen Dank und einen erfolgreichen Tag!
            </p>
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 0.8em; color: #999;">
                Freundliche Grüsse<br>
                <strong>Michael Jenni</strong><br>
                Härterei Blessing AG
            </p>
            ${isAutomated ? '<p style="font-size: 0.7em; color: #ccc;">(Dies ist ein automatisch generierter Bericht, jeden Montag um 03:00)</p>' : ''}
        </div>
    </body>
    </html>
    `;
};

const sendReport = async (isAutomated = false) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT data FROM app_state ORDER BY id DESC LIMIT 1', async (err, row) => {
            if (err || !row) {
                console.error('Error fetching data for email:', err);
                return reject(err || new Error('No data found'));
            }

            try {
                const appData = JSON.parse(row.data);
                const emails = appData.settings?.notifications?.emails || [];

                if (emails.length === 0) {
                    console.log('No email recipients configured.');
                    return resolve({ success: false, message: 'No recipients' });
                }

                const kw = appData.settings?.currentKw || 12;
                const mailOptions = {
                    from: '"Michael Jenni | Blessing AG" <michael.jenni@blessing.ch>',
                    to: emails.join(', '),
                    subject: `Zentrale_Statistik - KW ${kw}${isAutomated ? ' [Auto]' : ''}`,
                    html: getReportHtml(appData, isAutomated)
                };

                const info = await transporter.sendMail(mailOptions);
                console.log('Email sent: ' + info.response);
                resolve({ success: true, info });
            } catch (e) {
                console.error('Email processing error:', e);
                reject(e);
            }
        });
    });
};

// Cron Job: Every Monday at 03:00
cron.schedule('0 3 * * 1', () => {
    console.log('Running scheduled weekly report (Monday 03:00)...');
    sendReport(true).catch(err => console.error('Scheduled report failed:', err));
});

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

app.post('/api/send-report', async (req, res) => {
    try {
        const result = await sendReport(false);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// For SPA support: redirect all other requests to index.html
// Using middleware instead of wildcard to avoid PathError in modern Express
app.use((req, res, next) => {
    // Skip if it's an API call (already handled above)
    if (req.path.startsWith('/api')) {
        return next();
    }

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
