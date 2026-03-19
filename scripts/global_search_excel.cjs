const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelDir = 'm:\\SERVER_MANAGEMENT\\04 ISO\\ISO 9001\\9.  Bewertung der Leistung\\Wartungsplaene';

try {
    const files = fs.readdirSync(excelDir).filter(f => f.endsWith('.xlsm'));
    files.forEach(file => {
        const filePath = path.join(excelDir, file);
        try {
            const workbook = xlsx.readFile(filePath);
            workbook.SheetNames.forEach(name => {
                const sheet = workbook.Sheets[name];
                const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
                rows.forEach((r, idx) => {
                    if (r && Array.isArray(r) && r.some(c => c && c.toString().toLowerCase().includes('badsteuerung'))) {
                        console.log(`FOUND in File: ${file} | Sheet: ${name} | Row ${idx}: ${JSON.stringify(r)}`);
                    }
                });
            });
        } catch (err) {
            // console.error(`Error reading ${file}: ${err.message}`);
        }
    });
} catch (e) {
    console.error(e);
}
