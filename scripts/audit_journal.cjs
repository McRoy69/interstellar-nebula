const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelDir = 'C:\\Users\\Michael.Jenni\\Wartungsplan';
const file = 'Wartungsplan_Brünieren_1_2.xlsm';
const filePath = path.join(excelDir, file);

try {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets['Journal'];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log('--- Journal Sample Rows ---');
    rows.forEach((r, idx) => {
        if (r && Array.isArray(r) && r.some(c => c && c.toString().includes('Bad'))) {
            console.log(`Journal Row ${idx}: ${JSON.stringify(r)}`);
        }
    });
} catch (e) {
    console.error(e);
}
