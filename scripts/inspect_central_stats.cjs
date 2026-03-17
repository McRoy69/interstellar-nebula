const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = 'C:\\Users\\Michael.Jenni\\Wartungsplan\\Zentrale_Statistik_1_0.xlsm';

console.log('Checking if file exists:', filePath);
if (!fs.existsSync(filePath)) {
    console.error('FILE DOES NOT EXIST');
    process.exit(1);
}
console.log('File size:', fs.statSync(filePath).size);

try {
    const workbook = xlsx.readFile(filePath);
    console.log('Successfully read workbook.');
    console.log('Sheet Names:', workbook.SheetNames);

    workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        if (!sheet) {
            console.log(`Sheet "${name}" is undefined.`);
            return;
        }
        console.log(`\n--- Sheet: ${name} ---`);
        console.log(`Range: ${sheet['!ref'] || 'Empty'}`);

        // Convert to JSON ignoring header for a raw look
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`Row count: ${data.length}`);

        if (data.length > 0) {
            console.log('Sample Data (First 10 rows):');
            data.slice(0, 10).forEach((row, i) => {
                if (Array.isArray(row)) {
                    console.log(`Row ${i}:`, row.map(c => (c === null || c === undefined) ? '' : c).join(' | '));
                } else {
                    console.log(`Row ${i} (not an array):`, row);
                }
            });
        }
    });

} catch (e) {
    console.error('Error reading workbook:', e.message);
    if (e.stack) console.error(e.stack);
}
