const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelDir = 'C:\\Users\\Michael.Jenni\\Wartungsplan';
const file = 'Wartungsplan_INDH_1_2.xlsm';
const filePath = path.join(excelDir, file);

try {
    const workbook = xlsx.readFile(filePath);
    const journalSheetName = workbook.SheetNames.find(s => s === 'Journal' || (s.toLowerCase().includes('journal') && !s.toLowerCase().includes('archiv')));
    if (journalSheetName) {
        const sheet = workbook.Sheets[journalSheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        let headerIdx = -1;
        for (let i = 0; i < 20; i++) {
            if (rows[i] && rows[i].includes('Aufgabe')) {
                headerIdx = i;
                break;
            }
        }

        if (headerIdx !== -1) {
            console.log(`Headers for ${file} [${journalSheetName}]:`);
            console.log(rows[headerIdx].join(' | '));
        } else {
            console.log('Header "Aufgabe" not found in Journal.');
        }
    } else {
        console.log('Journal sheet not found.');
    }
} catch (e) {
    console.error(e);
}
