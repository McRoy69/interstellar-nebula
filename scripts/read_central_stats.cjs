const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'C:\\Users\\Michael.Jenni\\Wartungsplan\\Zentrale_Statistik_1_0.xlsm';

try {
    const workbook = xlsx.readFile(filePath);

    ['Config', 'Zentrale_Statistik', 'Top2_Late_Aufgaben'].forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
            console.log(`\n--- ${sheetName} ---`);
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            data.slice(0, 20).forEach((row, i) => {
                console.log(`Row ${i}:`, row);
            });
        }
    });
} catch (e) {
    console.log('ERROR:' + e.message);
}
