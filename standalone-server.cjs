const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const nodemailer = require('nodemailer'); // Still used for type/compat if needed, but we pivot to fetch
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

// EMAIL CONFIGURATION: Resend API (HTTP/HTTPS - Bypasses Railway SMTP blocks)
// Get your API Key at: https://resend.com/
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_VRfnWquM_7vpRFGnNejCFQy318XN9QtW7';

async function sendEmailResend(options) {
    console.log(`[Resend] Sending email to: ${options.to}`);
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: options.from || 'Wartungsplan <onboarding@resend.dev>',
                to: Array.isArray(options.to) ? options.to : options.to.split(',').map(e => e.trim()),
                subject: options.subject,
                html: options.html
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Resend API Error (${response.status}): ${JSON.stringify(data)}`);
        }
        console.log('[Resend] Success:', data.id);
        return { success: true, message: 'Email sent via Resend API', id: data.id };
    } catch (error) {
        console.error('[Resend] Failure:', error.message);
        throw error;
    }
}


// SMTP is no longer used, we now use Resend API.

const EMAIL_I18N = {
    de: {
        subject: 'Wartungsplan Statistik',
        greeting: 'Hallo Michael,',
        subtitle: 'hier ist die aktuelle Übersicht der Wartungs-Performance.',
        colDept: 'Abteilung',
        appTitle: 'Vollständiger Report in der App:',
        appButton: 'System öffnen',
        footer1: 'Bei Fragen stehen die Abteilungsleiter gerne zur Verfügung.',
        footer2: 'Vielen Dank und eine erfolgreiche Woche!',
        automated: '(Dies ist ein systemgenerierter automatischer Bericht, Versand jeden Montag um 03:00 Uhr)',
        metrics: {
            efficiency: 'Effizienz',
            'on-time': 'Pünktlich',
            late: 'Verzug',
            offen: 'Offen',
            erfüllungsquote: 'Quote'
        }
    },
    es: {
        subject: 'Estadísticas del Plan de Mantenimiento',
        greeting: 'Hola Michael,',
        subtitle: 'aquí tienes el resumen del rendimiento de mantenimiento.',
        colDept: 'Departamento',
        appTitle: 'Informe completo en la App:',
        appButton: 'Abrir Sistema',
        footer1: 'Si tiene preguntas, póngase en contacto con los jefes de departamento.',
        footer2: '¡Muchas gracias y que tenga una excelente semana!',
        automated: '(Informe automático generado por el sistema, enviado los lunes a las 03:00 AM)',
        metrics: {
            efficiency: 'Eficiencia',
            'on-time': 'Puntual',
            late: 'Retraso',
            offen: 'Pendiente',
            erfüllungsquote: 'Tasa %'
        }
    },
    tr: {
        subject: 'Bakım Planı İstatistikleri',
        greeting: 'Merhaba Michael,',
        subtitle: 'güncel bakım performans özetini burada bulabilirsiniz.',
        colDept: 'Departman',
        appTitle: 'Uygulamadaki tam rapor:',
        appButton: 'Sistemi Aç',
        footer1: 'Sorularınız için departman yöneticileriyle iletişime geçin.',
        footer2: 'Teşekkür eder, iyi haftalar dileriz!',
        automated: '(Otomatik sistem raporu, her Pazartesi saat 03:00\'te gönderilir)',
        metrics: {
            efficiency: 'Verimlilik',
            'on-time': 'Zamanında',
            late: 'Gecikme',
            offen: 'Bekleyen',
            erfüllungsquote: 'Uyum %'
        }
    },
    pt: {
        subject: 'Estatísticas do Plano de Manutenção',
        greeting: 'Olá Michael,',
        subtitle: 'aqui está o resumo do desempenho de manutenção.',
        colDept: 'Departamento',
        appTitle: 'Relatório completo na App:',
        appButton: 'Abrir Sistema',
        footer1: 'Dúvidas? Entre em contacto com os chefes de departamento.',
        footer2: 'Muito obrigado e tenha uma excelente semana!',
        automated: '(Relatório automático do sistema, enviado às segundas-feiras 03:00 AM)',
        metrics: {
            efficiency: 'Eficiência',
            'on-time': 'Pontual',
            late: 'Atraso',
            offen: 'Aberto',
            erfüllungsquote: 'Taxa %'
        }
    }
};

const getReportHtml = (appData, isAutomated = false, lang = 'de', recipientName = '') => {
    const t = EMAIL_I18N[lang] || EMAIL_I18N['de'];
    const greeting = recipientName ? `${t.greeting.split(' ')[0]} ${recipientName},` : t.greeting;
    const kw = appData.settings?.currentKw || 13;
    const appUrl = process.env.APP_URL || 'https://wartungsplan.up.railway.app';
    const departments = appData.departments || [];
    const stats = appData.stats || {};
    const reportMetrics = appData.settings?.notifications?.reportMetrics || {};

    // Identify which columns are active (selected in ANY department or central)
    const allPossibleMetrics = ['efficiency', 'on-time', 'late', 'offen', 'erfüllungsquote'];
    const activeMetrics = allPossibleMetrics.filter(mId => {
        if ((reportMetrics['central'] || []).includes(mId)) return true;
        return departments.some(d => (reportMetrics[d.id] || []).includes(mId));
    });

    // Default to a fallback if none selected
    const displayMetrics = activeMetrics.length > 0 ? activeMetrics : ['efficiency', 'on-time', 'late'];

    let tableHead = `<th style="padding: 12px; text-align: left; border-radius: 10px 0 0 0;">${t.colDept}</th>`;
    displayMetrics.forEach((mId, idx) => {
        const isLast = idx === displayMetrics.length - 1;
        tableHead += `<th style="padding: 12px; text-align: center; ${isLast ? 'border-radius: 0 10px 0 0;' : ''}">${t.metrics[mId] || mId}</th>`;
    });

    let deptRows = '';
    if (departments.length > 0) {
        departments.forEach(dept => {
            if (dept.hidden) return;
            const dStats = stats[dept.id] || {};
            const dMetrics = reportMetrics[dept.id] || reportMetrics['central'] || displayMetrics;

            deptRows += `<tr><td style="padding: 12px; border-bottom: 1px solid #edf2f7; font-size: 14px;"><strong>${dept.name}</strong></td>`;

            displayMetrics.forEach(mId => {
                let val = dStats[mId] !== undefined ? dStats[mId] : 0;
                let style = 'padding: 12px; border-bottom: 1px solid #edf2f7; text-align: center;';
                let displayVal = val;

                if (mId === 'efficiency' || mId === 'erfüllungsquote') {
                    displayVal = Math.round(val) + '%';
                    const color = val >= 90 ? '#10b981' : (val >= 70 ? '#f59e0b' : '#ef4444');
                    style += ` font-weight: bold; color: ${color};`;
                } else if (mId === 'late' && val > 0) {
                    style += ' color: #e53e3e; font-weight: bold;';
                }

                // If this specific department doesn't have this metric enabled, show it dimmed or as -
                const isEnabled = dMetrics.includes(mId);
                deptRows += `<td style="${style} ${isEnabled ? '' : 'opacity: 0.2;'}">${isEnabled ? displayVal : '-'}</td>`;
            });
            deptRows += `</tr>`;
        });
    }

    return `
    <html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #2d3748; background-color: #f7fafc; padding: 20px;">
        <div style="max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="margin: 0; color: #1a365d; font-size: 24px; letter-spacing: -0.02em;">Zentrale Statistik - KW ${kw}</h1>
                <p style="color: #718096; margin-top: 5px;">Härterei Blessing AG • Monitoring Report</p>
            </div>

            <p>${greeting}</p>
            <p>${t.subtitle}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 25px 0; background: #ffffff;">
                <thead>
                    <tr style="background: #edf2f7; color: #4a5568; text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em;">
                        ${tableHead}
                    </tr>
                </thead>
                <tbody>
                    ${deptRows || `<tr><td colspan="${displayMetrics.length + 1}" style="padding: 20px; text-align: center; color: #a0aec0;">Keine Abteilungsdaten verfügbar</td></tr>`}
                </tbody>
            </table>

            <div style="background: #ebf8ff; padding: 25px; border-radius: 15px; margin: 30px 0; border: 1px solid #bee3f8; text-align: center;">
                <p style="margin: 0 0 15px 0; font-weight: bold; color: #2b6cb0;">${t.appTitle}</p>
                <a href="${appUrl}" style="display: inline-block; padding: 14px 28px; background: #3182ce; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; shadow: 0 4px 14px rgba(49,130,206,0.4);">${t.appButton}</a>
            </div>

            <p style="font-size: 0.9em; color: #4a5568;">
                ${t.footer1}<br>
                ${t.footer2}
            </p>
            
            <div style="margin-top: 40px; border-top: 1px solid #edf2f7; pt: 20px;">
                <p style="font-size: 0.85em; color: #718096; line-height: 1.4;">
                    Freundliche Grüsse<br>
                    <strong style="color: #1a365d;">Michael Jenni</strong><br>
                    Härterei Blessing AG
                </p>
            </div>
            ${isAutomated ? `<p style="font-size: 10px; color: #a0aec0; text-align: center; margin-top: 30px; font-style: italic;">${t.automated}</p>` : ''}
        </div>
    </body>
    </html>
    `;
};

const sendReport = async (isAutomated = false, providedData = null) => {
    return new Promise((resolve, reject) => {
        const handleData = async (dataToUse) => {
            try {
                const appData = providedData || JSON.parse(dataToUse);

                const emails = appData.settings?.notifications?.emails || [];

                if (emails.length === 0) {
                    console.log('No email recipients configured.');
                    return resolve({ success: false, message: 'No hay destinatarios configurados en los Ajustes' });
                }

                const kw = appData.settings?.currentKw || 13;
                const lang = appData.lang || 'de';
                const t = EMAIL_I18N[lang] || EMAIL_I18N['de'];

                const results = [];
                for (const email of emails) {
                    try {
                        // Extract name from email: nicolas.schweizer@... -> Nicolas
                        const prefix = email.split('@')[0];
                        const firstName = prefix.split('.')[0];
                        const capitalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

                        const mailOptions = {
                            from: 'Wartungsplan <onboarding@resend.dev>',
                            to: email,
                            subject: `${t.subject} - KW ${kw}${isAutomated ? ' [Auto]' : ''}`,
                            html: getReportHtml(appData, isAutomated, lang, capitalizedName)
                        };

                        const result = await sendEmailResend(mailOptions);
                        results.push(result);
                    } catch (err) {
                        console.error(`Failed to send email to ${email}:`, err);
                    }
                }

                resolve({ success: true, count: results.length });
            } catch (e) {
                console.error('Email processing error:', e);
                reject(e);
            }
        };

        if (providedData) {
            handleData(null);
        } else {
            db.get('SELECT data FROM app_state ORDER BY id DESC LIMIT 1', (err, row) => {
                if (err) return reject(err);
                if (!row) {
                    // Minimo fallback para evitar crash si no hay nada en DB
                    handleData(JSON.stringify({
                        settings: { currentKw: 13, notifications: { emails: ['michael.jenni@blessing.ch'] } },
                        departments: []
                    }));
                } else {
                    handleData(row.data);
                }
            });
        }
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

app.get('/api/translate', async (req, res) => {
    const { text, to } = req.query;
    if (!text || !to) return res.status(400).json({ error: 'Missing text or to' });
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        // Google Translate unofficial API returns a nested array
        const translatedText = data[0].map(x => x[0]).join('');
        res.json({ translatedText });
    } catch (e) {
        console.error('Translation error:', e);
        res.status(500).json({ error: 'Translation failed' });
    }
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
        const providedData = req.body && Object.keys(req.body).length > 0 ? req.body : null;
        const result = await sendReport(false, providedData);
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
