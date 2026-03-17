const xlsx = require('xlsx');

const file = 'C:\\Users\\Michael.Jenni\\Wartungsplan\\Wartungsplan_QPQ_1_2.xlsm';
try {
    const workbook = xlsx.readFile(file);
    console.log('Sheet Names:', workbook.SheetNames);

    // Try to find the lista_Segun_Matriz sheet or Similar
    const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('matriz') || s.toLowerCase().includes('matrix') || s.toLowerCase().includes('lista'));
    if (sheetName) {
        console.log(`\nFound target sheet: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        console.log('\nFirst 20 rows of data:');
        console.dir(data.slice(0, 20), { depth: null });
    } else {
        console.log('\nCould not find a sheet containing matriz, matrix, or lista.');
    }
} catch (e) {
    console.error('Error reading file:', e);
}
