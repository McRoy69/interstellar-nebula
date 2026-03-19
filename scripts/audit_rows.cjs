const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelDir = 'C:\\Users\\Michael.Jenni\\Wartungsplan';
const file = 'Wartungsplan_INDH_1_2.xlsm';
const filePath = path.join(excelDir, file);

try {
    const workbook = xlsx.readFile(filePath);

    // Check Journal
    const journalSheetName = workbook.SheetNames.find(s => s === 'Journal' || (s.toLowerCase().includes('journal') && !s.toLowerCase().includes('archiv')));
    if (journalSheetName) {
        const sheet = workbook.Sheets[journalSheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        let contentRows = 0;
        let doneRows = 0;
        let start = false;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i].includes('Aufgabe')) { start = true; continue; }
            if (start && rows[i] && rows[i][1]) {
                contentRows++;
                const aufgabe = rows[i][1];
                const datum = rows[i][4];
                const visum = rows[i][5];
                const kwStr = rows[i][2]; // Check if KW is here
                if (datum || visum) doneRows++;

                // Inspect KW 3 and 4 specifically
                if (kwStr && (kwStr.toString().includes('.03.2026') || kwStr.toString().includes('.01.2026'))) {
                    // Wait, KW 3 is Jan, KW 10 is March.
                }
                console.log(`Row: ${aufgabe} | KW: ${kwStr} | Datum: ${datum} | Visum: ${visum}`);
            }
        }
        console.log(`[Journal] Total: ${contentRows}, Done: ${doneRows}`);
    }

    // Check Journal_Archiv
    const archiveSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('journal_archiv'));
    if (archiveSheetName) {
        const sheet = workbook.Sheets[archiveSheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        let contentRows = 0;
        let start = false;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i].includes('Aufgabe')) { start = true; continue; }
            if (start && rows[i] && rows[i].some(c => c)) {
                contentRows++;
            }
        }
        console.log(`[Archive] Total: ${contentRows}`);
    }
} catch (e) {
    console.error(e);
}
