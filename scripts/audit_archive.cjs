const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelDir = 'C:\\Users\\Michael.Jenni\\Wartungsplan';
const file = 'Wartungsplan_Brünieren_1_2.xlsm';
const filePath = path.join(excelDir, file);

try {
    const workbook = xlsx.readFile(filePath);
    workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length > 0) {
            if (name === 'Journal_Archiv') {
                console.log('--- Journal_Archiv Sample Rows ---');
                rows.forEach((r, idx) => {
                    // Try to find 2026 or 2025 rows
                    if (r && Array.isArray(r) && (r.includes(2026) || r.includes(2025))) {
                        console.log(`Archive Row ${idx}: ${JSON.stringify(r)}`);
                    }
                });
            }
        }
    });
} catch (e) {
    console.error(e);
}
