const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelDir = 'm:\\SERVER_MANAGEMENT\\04 ISO\\ISO 9001\\9.  Bewertung der Leistung\\Wartungsplaene';
const file = 'Wartungsplan_Brünieren_1_2.xlsm';
const filePath = path.join(excelDir, file);

try {
    const workbook = xlsx.readFile(filePath);
    ['Plan', 'Lista_Segun_Matriz', 'Journal'].forEach(name => {
        const sheet = workbook.Sheets[name];
        if (!sheet) return;
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`--- Sheet: ${name} ---`);
        rows.forEach((r, idx) => {
            if (r && Array.isArray(r) && r.some(c => c && c.toString().toLowerCase().includes('bad'))) {
                console.log(`Row ${idx}: ${JSON.stringify(r)}`);
            }
        });
    });
} catch (e) {
    console.error(e);
}
