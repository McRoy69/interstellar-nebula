const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const file = 'C:\\Users\\Michael.Jenni\\Wartungsplan\\Wartungsplan_QPQ_1_2.xlsm';
try {
    const workbook = xlsx.readFile(file, { cellFormula: true, cellVBA: true, bookVBA: true });
    console.log('Sheet Names:', workbook.SheetNames);

    if (workbook.vbaraw) {
        console.log('VBA Raw Data is present.');
        // Extracting VBA is complex with just xlsx, but we can look at the Journal sheet formulas
    } else {
        console.log('No VBA Raw data found by xlsx parser.');
    }

    const journalSheetName = workbook.SheetNames.find(s => s === 'Journal' || s.toLowerCase().includes('journal'));
    if (journalSheetName) {
        console.log(`\nFound Journal sheet: ${journalSheetName}`);
        const sheet = workbook.Sheets[journalSheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });

        console.log('\nJournal Sheet (First 30 rows):');
        console.dir(data.slice(0, 30), { depth: null });
    }

} catch (e) {
    console.error(e);
}
