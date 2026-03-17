const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelDir = 'C:\\Users\\Michael.Jenni\\Wartungsplan';
const file = 'Wartungsplan_INDH_1_2.xlsm';
const filePath = path.join(excelDir, file);

try {
    const workbook = xlsx.readFile(filePath);
    const archiveSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('journal_archiv'));
    if (archiveSheetName) {
        const sheet = workbook.Sheets[archiveSheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        let headerIdx = -1;
        for (let i = 0; i < 20; i++) {
            if (rows[i] && rows[i].includes('Aufgabe')) {
                headerIdx = i;
                break;
            }
        }

        if (headerIdx !== -1) {
            console.log(`Headers for ${file} [${archiveSheetName}]:`);
            console.log(rows[headerIdx].join(' | '));
            console.log('Sample Data (Row 1):');
            console.log(rows[headerIdx + 1].join(' | '));
        } else {
            console.log('Header "Aufgabe" not found in first 20 rows.');
            console.log('Row 0:', rows[0]);
        }
    } else {
        console.log('Journal_Archiv sheet not found.');
    }
} catch (e) {
    console.error(e);
}
