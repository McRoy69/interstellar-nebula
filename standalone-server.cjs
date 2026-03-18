const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

const dns = require('dns');
// Force IPv4 as priority to avoid IPv6 ENETUNREACH issues in cloud environments
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

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

// SMTP Configuration (Metanet) - Optimized for Cloud Environments (matches working VBA SSL setup)
const transporter = nodemailer.createTransport({
    host: '80.74.146.140', // Direct IPv4 for futura.metanet.ch to skip problematic IPv6
    port: 465,             // Port 465 for SSL (matching user's VBA config)
    secure: true,          // SSL/TLS (matching user's SMTP_USE_SSL = True)
    auth: {
        user: 'michael.jenni@blessing.ch',
        pass: '16MnCrS5?'
    },
    tls: {
        rejectUnauthorized: false, // Allow if cert hostname doesn't match IP (we use servername below)
        servername: 'futura.metanet.ch', // CRITICAL for certificate validation with IP host
        minVersion: 'TLSv1.2'
    },
    family: 4, // Force IPv4 explicitly
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    debug: true,
    logger: true
});

// Verify SMTP connection on startup with more logging
console.log('Starting SMTP verification for futura.metanet.ch:465...');
transporter.verify(function (error, success) {
    if (error) {
        console.error('CRITICAL: SMTP Verification Error DETAILS:', {
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode,
            stack: error.stack
        });
    } else {
        console.log('SUCCESS: SMTP Server is ready for futura.metanet.ch:465');
    }
});

const getReportHtml = (appData, isAutomated = false) => {
    const kw = appData.settings?.currentKw || 12;
    const appUrl = process.env.APP_URL || 'https://wartungsplan.up.railway.app';
    const departments = appData.departments || [];
    const stats = appData.stats || {}; // Assuming frontend sends stats or we use empty

    let deptRows = '';
    if (departments.length > 0) {
        departments.forEach(dept => {
            if (dept.hidden) return;
            const dStats = stats[dept.id] || { efficiency: 0, late: 0, executed: 0 };
            const effColor = dStats.efficiency >= 90 ? '#10b981' : (dStats.efficiency >= 70 ? '#f59e0b' : '#ef4444');

            deptRows += `
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #edf2f7; font-size: 14px;"><strong>${dept.name}</strong></td>
                    <td style="padding: 12px; border-bottom: 1px solid #edf2f7; text-align: center; font-weight: bold; color: ${effColor};">${Math.round(dStats.efficiency)}%</td>
                    <td style="padding: 12px; border-bottom: 1px solid #edf2f7; text-align: center;">${dStats.executed || 0}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #edf2f7; text-align: center; color: ${dStats.late > 0 ? '#e53e3e' : '#718096'};">${dStats.late || 0}</td>
                </tr>
            `;
        });
    }

    return `
    <html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #2d3748; background-color: #f7fafc; padding: 20px;">
        <div style="max-width: 650px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="margin: 0; color: #1a365d; font-size: 24px; letter-spacing: -0.02em;">Zentrale Statistik - KW ${kw}</h1>
                <p style="color: #718096; margin-top: 5px;">Härterei Blessing AG • Monitoring Report</p>
            </div>

            <p>Guten Morgen,</p>
            <p>anbei erhalten Sie die Übersicht der aktuellen Wartungs-Performance nach Abteilungen.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 25px 0; background: #ffffff;">
                <thead>
                    <tr style="background: #edf2f7; color: #4a5568; text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em;">
                        <th style="padding: 12px; text-align: left; border-radius: 10px 0 0 0;">Abteilung</th>
                        <th style="padding: 12px; text-align: center;">Effizienz</th>
                        <th style="padding: 12px; text-align: center;">Erledigt</th>
                        <th style="padding: 12px; text-align: center; border-radius: 0 10px 0 0;">Verzug</th>
                    </tr>
                </thead>
                <tbody>
                    ${deptRows || '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #a0aec0;">Keine Abteilungsdaten verfügbar</td></tr>'}
                </tbody>
            </table>

            <div style="background: #ebf8ff; padding: 25px; border-radius: 15px; margin: 30px 0; border: 1px solid #bee3f8; text-align: center;">
                <p style="margin: 0 0 15px 0; font-weight: bold; color: #2b6cb0;">Vollständiger Report in der App:</p>
                <a href="${appUrl}" style="display: inline-block; padding: 14px 28px; background: #3182ce; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; shadow: 0 4px 14px rgba(49,130,206,0.4);">System öffnen</a>
            </div>

            <p style="font-size: 0.9em; color: #4a5568;">
                Bei Fragen zu den Metriken wenden Sie sich bitte an die Abteilungsleiter.<br>
                Herzlichen Dank!
            </p>
            
            <div style="margin-top: 40px; border-top: 1px solid #edf2f7; pt: 20px;">
                <p style="font-size: 0.85em; color: #718096; line-height: 1.4;">
                    Freundliche Grüsse<br>
                    <strong style="color: #1a365d;">Michael Jenni</strong><br>
                    Härterei Blessing AG
                </p>
            </div>
            ${isAutomated ? '<p style="font-size: 10px; color: #a0aec0; text-align: center; margin-top: 30px; font-style: italic;">(Dies ist ein systemgenerierter automatischer Bericht, Versand jeden Montag um 03:00 Uhr)</p>' : ''}
        </div>
    </body>
    </html>
    `;
};

const sendReport = async (isAutomated = false) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT data FROM app_state ORDER BY id DESC LIMIT 1', async (err, row) => {
            if (err) {
                console.error('Error fetching data for email:', err);
                return reject(err);
            }

            try {
                let appData;
                if (!row) {
                    console.warn('No data found in DB, using fallback defaults for email');
                    appData = {
                        settings: {
                            currentKw: 13,
                            notifications: { emails: ['michael.jenni@blessing.ch'] }
                        }
                    };
                } else {
                    appData = JSON.parse(row.data);
                }

                const emails = appData.settings?.notifications?.emails || [];

                if (emails.length === 0) {
                    console.log('No email recipients configured.');
                    return resolve({ success: false, message: 'No hay destinatarios configurados en los Ajustes' });
                }

                const kw = appData.settings?.currentKw || 13;
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
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result); // result already has 'message'
        }
    } catch (error) {
        console.error('API send-report technical error:', error);
        res.status(500).json({
            success: false,
            message: `Error técnico al enviar el correo: ${error.message || 'Sin detalles'}`
        });
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
