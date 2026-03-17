// Read xlsm as zip using xlsx internal CFB reader, then extract text strings from vbaProject.bin
const fs = require('fs');
const path = require('path');

const excelDir = 'C:\\Users\\Michael.Jenni\\Wartungsplan';
const files = fs.readdirSync(excelDir).filter(f => f.endsWith('.xlsm') && !f.startsWith('~$') && !f.startsWith('Zentrale_Statistik'));

// Helper: extract printable ASCII strings from a buffer (like `strings` command on unix)
function extractStrings(buf, minLen = 4) {
    const results = [];
    let current = '';
    for (let i = 0; i < buf.length; i++) {
        const c = buf[i];
        // Printable ASCII
        if (c >= 0x20 && c < 0x7F) {
            current += String.fromCharCode(c);
        } else {
            if (current.length >= minLen) results.push(current);
            current = '';
        }
    }
    if (current.length >= minLen) results.push(current);
    return results;
}

// Also extract UTF-16LE strings (common in VBA)
function extractStringsUTF16(buf, minLen = 4) {
    const results = [];
    let current = '';
    for (let i = 0; i < buf.length - 1; i += 2) {
        const lo = buf[i], hi = buf[i + 1];
        if (hi === 0 && lo >= 0x20 && lo < 0x7F) {
            current += String.fromCharCode(lo);
        } else {
            if (current.length >= minLen) results.push(current);
            current = '';
        }
    }
    if (current.length >= minLen) results.push(current);
    return results;
}

files.forEach(file => {
    const filePath = path.join(excelDir, file);
    try {
        // Use xlsx internal zip reader
        const xlsx = require('xlsx');
        const wb = xlsx.readFile(filePath, { bookVBA: true });

        console.log(`\n=== ${file} ===`);

        if (wb.vbaraw) {
            console.log('  VBA raw found, size:', wb.vbaraw.length);
            const buf = Buffer.from(wb.vbaraw);

            // Extract ASCII strings
            const strings = extractStrings(buf, 4);
            // Extract UTF-16 strings
            const strings16 = extractStringsUTF16(buf, 4);

            // Filter for name-like strings (First Last pattern)
            const allStrings = [...new Set([...strings, ...strings16])];
            const namelike = allStrings.filter(s =>
                s.match(/^[A-ZÁÄÖÜ][a-záäöü]+ [A-ZÁÄÖÜ][a-záäöüß]+$/) &&
                s.length > 5 && s.length < 40
            );

            console.log('  Name-like strings:', namelike);

            // Also show strings containing "Titel" or "Verantwortl"
            const relevant = allStrings.filter(s =>
                s.toLowerCase().includes('titel') ||
                s.toLowerCase().includes('verantwortl') ||
                s.toLowerCase().includes('name')
            );
            console.log('  Relevant strings:', relevant.slice(0, 20));
        } else {
            console.log('  No VBA raw data found');
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
});
