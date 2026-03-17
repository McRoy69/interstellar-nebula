const fs = require('fs');
const xlsx = require('xlsx');
const dir = 'C:/Users/Michael.Jenni/Wartungsplan';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsm') && !f.startsWith('~$'));
const wb = xlsx.readFile(dir + '/' + files[0]);

console.log('Sheets:', wb.SheetNames);
const archiveName = wb.SheetNames.find(s => s.toLowerCase().includes('archiv'));
if (archiveName) {
    const sheet = wb.Sheets[archiveName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    let hIdx = -1;
    for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i].includes('Aufgabe')) {
            hIdx = i; break;
        }
    }
    console.log('Archive Headers:', data[hIdx]);
    console.log('Sample Row:', data[hIdx + 1]);
} else {
    console.log('No archive sheet found in', files[0]);
}
