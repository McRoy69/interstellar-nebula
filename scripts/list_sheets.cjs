const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'C:\\Users\\Michael.Jenni\\Wartungsplan\\Zentrale_Statistik_1_0.xlsm';

try {
    const workbook = xlsx.readFile(filePath);
    console.log('SHEETS:' + workbook.SheetNames.join(','));
} catch (e) {
    console.log('ERROR:' + e.message);
}
