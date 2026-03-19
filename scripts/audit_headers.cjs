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
            let headerRow = rows.find(r => r && Array.isArray(r) && r.includes('Aufgabe'));
            if (headerRow) {
                console.log(`Sheet: ${name} | Headers: ${JSON.stringify(headerRow)}`);
            } else {
                // Try to find any row with some content
                let contentRow = rows.find(r => r && Array.isArray(r) && r.some(c => c));
                console.log(`Sheet: ${name} | Sample row: ${JSON.stringify(contentRow)}`);
            }
        }
    });
} catch (e) {
    console.error(e);
}
