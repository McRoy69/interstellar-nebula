const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) {
    console.error("Please provide a file path.");
    process.exit(1);
}

try {
    const workbook = XLSX.readFile(filePath);
    const result = {};

    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        result[sheetName] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    });

    const jsonString = JSON.stringify(result, null, 2);
    const outputPath = process.argv[3];

    if (outputPath) {
        fs.writeFileSync(outputPath, jsonString, 'utf8');
        console.log(`Data written to ${outputPath}`);
    } else {
        process.stdout.write(jsonString);
    }
} catch (error) {
    console.error("Error reading Excel file:", error.message);
    process.exit(1);
}
