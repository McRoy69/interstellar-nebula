const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Improved date helper to return YYYY-MM-DD for <input type="date">
function formatToInputDate(val) {
    if (!val) return "";
    let d = null;
    if (val instanceof Date) {
        d = val;
    } else if (typeof val === 'string') {
        const parts = val.split('.');
        if (parts.length === 3) {
            d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
            // Try standard JS parse
            const parsed = new Date(val);
            if (!isNaN(parsed.getTime())) d = parsed;
        }
    } else if (typeof val === 'number') {
        // Excel serial date bug: SheetJS handles this if cellDates: true, 
        // but if we get a number here, we can try to convert it (Excel starts 1900-01-01)
        d = new Date((val - 25569) * 86400 * 1000);
    }

    if (d && !isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }
    return val.toString();
}

// Separate helper for internal week calculation
function parseToDateObj(val) {
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
        const parts = val.split('.');
        if (parts.length === 3) {
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
    }
    return null;
}

// Helper to calculate getWeek
function getWeek(date) {
    if (!date) return 1;
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

const excelDir = 'C:\\Users\\Michael.Jenni\\Wartungsplan';
const files = fs.readdirSync(excelDir).filter(f => f.endsWith('.xlsm') && !f.startsWith('~$') && !f.startsWith('Zentrale_Statistik'));

// Operator names per department (provided by user)
const verantwortlicherMapping = {
    'Brünieren': 'Javier Lucar',
    'QPQ': 'Walter Landmeier',
    'Armoloy': 'Nazmi Özkan',
    'Plasmanitrieren': 'Thilakshan Atputharasa',
    'INDH': 'Kiruvakaran Sivalingam',
    'Vakuumhärten': 'David Born',
    'Härten': 'Semir Adilic',
};

const deptMapping = {
    'Wartungsplan_Brünieren_1_2.xlsm': { id: '1', name: 'Brünieren' },
    'Wartungsplan_QPQ_1_2.xlsm': { id: '2', name: 'QPQ' },
    'Wartungsplan_SwissArmoloy_1_2.xlsm': { id: '3', name: 'Armoloy' },
    'Wartungsplan_Plani_1_2.xlsm': { id: '4', name: 'Plasmanitrieren' },
    'Wartungsplan_INDH_1_2.xlsm': { id: '5', name: 'INDH' },
    'Wartungsplan_Vakuumhärten_1_2.xlsm': { id: '6', name: 'Vakuumhärten' },
    'Wartungsplan_Härten_1_2.xlsm': { id: '7', name: 'Härten' }
};

const allData = [];
// Track unique tasks across Journal and Archiv for each department to prevent duplicates
const processedTaskKeys = new Set();
// Current mock date in the app is ~ March 19, 2026 (KW 12)
const CURRENT_KW = 12;

console.log(`Found ${files.length} files in ${excelDir}`);

files.forEach(file => {
    console.log(`Processing file: ${file}`);
    let mapping = deptMapping[file];

    // Fallback mapping
    if (!mapping) {
        if (file.includes('Brünieren') || file.includes('Brunieren')) mapping = { id: '1', name: 'Brünieren' };
        else if (file.includes('QPQ')) mapping = { id: '2', name: 'QPQ' };
        else if (file.includes('Armoloy')) mapping = { id: '3', name: 'Armoloy' };
        else if (file.includes('Plani') || file.includes('Plasma')) mapping = { id: '4', name: 'Plasmanitrieren' };
        else if (file.includes('INDH')) mapping = { id: '5', name: 'INDH' };
        else if (file.includes('Vakuum')) mapping = { id: '6', name: 'Vakuumhärten' };
        else if (file.includes('Härten')) mapping = { id: '7', name: 'Härten' };
        else return;
    }

    const { id, name } = mapping;
    const filePath = path.join(excelDir, file);
    try {
        const workbook = xlsx.readFile(filePath, { cellDates: true });

        const deptBlock = {
            id,
            name,
            verantwortlicher: verantwortlicherMapping[name] || 'Javier Lopez',
            stats: { geplant: 0, erledigt: 0, offen: 0, erfüllungsquote: 0 },
            tasks: [],
            planningTasks: []
        };
        let duplicateCount = 0;
        processedTaskKeys.clear();

        // 1. EXTRACT PLANNING MATRIX
        const matrizSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('matriz') || s.toLowerCase().includes('matrix') || s.toLowerCase().includes('lista'));
        if (matrizSheetName) {
            const sheet = workbook.Sheets[matrizSheetName];
            const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            const planningMap = {};

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const aufgabe = row[0];
                const kw = row[1];
                const geplant = row[2];
                let frequenz = row[3] || 'Einmalig';
                let anlage = row[4] || 'Allgemeines System';
                let wer = row[7] || 'MA';

                if (!aufgabe || aufgabe.toString().trim() === '') continue;

                const key = `${aufgabe}_${anlage}_${frequenz}_${wer}`;
                if (!planningMap[key]) {
                    planningMap[key] = {
                        id: `PLAN-${id}-${Object.keys(planningMap).length}`,
                        anlage: anlage.toString(),
                        title: aufgabe.toString(),
                        wer: wer.toString(),
                        frequenz: frequenz.toString(),
                        weeks: {}
                    };
                }

                const kwNum = parseInt(kw);
                if (!isNaN(kwNum)) {
                    planningMap[key].weeks[kwNum] = !!geplant;
                }
            }
            deptBlock.planningTasks = Object.values(planningMap);
        }

        // 2. EXTRACT OPERATIVE JOURNAL
        const journalSheetName = workbook.SheetNames.find(s => s === 'Journal' || (s.toLowerCase().includes('journal') && !s.toLowerCase().includes('archiv')));
        if (journalSheetName) {
            const sheet = workbook.Sheets[journalSheetName];
            const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });

            let headerIdx = -1;
            for (let i = 0; i < rows.length; i++) {
                if (rows[i] && rows[i].includes('Aufgabe')) { headerIdx = i; break; }
            }

            if (headerIdx !== -1) {
                const headers = rows[headerIdx];
                const idxAufgabe = headers.indexOf('Aufgabe');
                const idxAnlage = headers.indexOf('Anlage');
                const idxKwStr = headers.indexOf('KW_Montag');
                const idxWer = headers.indexOf('Wer');
                const idxDatum = headers.indexOf('Datum');
                const idxVisum = headers.indexOf('Visum');

                for (let i = headerIdx + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    const aufgabe = row[idxAufgabe];
                    const anlage = idxAnlage !== -1 ? row[idxAnlage] : 'System';
                    const kwStr = idxKwStr !== -1 ? row[idxKwStr] : null;
                    const wer = idxWer !== -1 ? row[idxWer] : 'MA';
                    const datumRaw = idxDatum !== -1 ? row[idxDatum] : null;
                    const visum = idxVisum !== -1 ? row[idxVisum] : '';

                    if (!aufgabe) continue;

                    let plannedKw = CURRENT_KW;
                    let plannedYear = 2026;
                    let status = 'Open';
                    let doneKw = null;
                    let doneYear = null;

                    const pDate = parseToDateObj(kwStr);
                    if (pDate) {
                        plannedKw = getWeek(pDate);
                        plannedYear = pDate.getFullYear();
                    }

                    const datumStr = formatToInputDate(datumRaw);
                    let isLate = false;
                    let delayWeeks = 0;

                    if (datumStr || visum) {
                        status = 'Done';
                        const d = parseToDateObj(datumRaw);
                        if (d) {
                            doneKw = getWeek(d);
                            doneYear = d.getFullYear();
                            if (doneYear > plannedYear || (doneYear === plannedYear && doneKw > plannedKw)) {
                                isLate = true;
                                delayWeeks = (doneYear - plannedYear) * 52 + (doneKw - plannedKw);
                            }
                        }
                    } else {
                        // Open task but check if it's already late
                        if (plannedYear < 2026 || (plannedYear === 2026 && plannedKw < CURRENT_KW)) {
                            status = 'Late';
                            isLate = true;
                            delayWeeks = (2026 - plannedYear) * 52 + (CURRENT_KW - plannedKw);
                        } else {
                            status = 'Open';
                        }
                    }

                    const taskObj = {
                        id: `T-${id}-${deptBlock.tasks.length + 100}`,
                        title: aufgabe.toString(),
                        kw: plannedKw,
                        plannedKw,
                        plannedYear,
                        year: plannedYear,
                        anlage: anlage ? anlage.toString() : 'N/A',
                        status: status,
                        visum: visum ? visum.toString() : "",
                        datum: datumStr,
                        doneKw,
                        doneYear,
                        wer: wer ? wer.toString() : 'MA',
                        isLate,
                        delayWeeks
                    };

                    const taskKey = `${taskObj.title.toLowerCase()}|${taskObj.anlage.toLowerCase()}|${taskObj.plannedKw}|${taskObj.plannedYear}`;
                    if (!processedTaskKeys.has(taskKey)) {
                        processedTaskKeys.add(taskKey);
                        deptBlock.tasks.push(taskObj);
                    } else {
                        duplicateCount++;
                    }
                }
            }
        }

        // 3. EXTRACT ARCHIVE (Journal_Archiv)
        const archiveSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('journal_archiv') || s.toLowerCase().includes('journal archiv'));
        if (archiveSheetName) {
            const sheet = workbook.Sheets[archiveSheetName];
            const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // Header 1 to get raw objects or arrays

            let headerIdx = -1;
            for (let i = 0; i < rows.length; i++) {
                if (rows[i] && rows[i].includes('Aufgabe')) { headerIdx = i; break; }
            }

            if (headerIdx !== -1) {
                const headers = rows[headerIdx];
                const idxAufgabe = headers.indexOf('Aufgabe');
                const idxAnlage = headers.indexOf('Anlage');
                const idxJahr = headers.indexOf('Jahr');
                const idxKw = headers.indexOf('KW');
                const idxWer = headers.indexOf('Wer');
                const idxDatumDone = headers.indexOf('Abschluss_Datum');
                const idxVisum = headers.indexOf('Visum');

                // Punctuality columns (header might vary due to encoding)
                const idxLate = headers.findIndex(h => h && (h.toString().includes('Verspätet') || h.toString().includes('VerspŠtet') || h.toString().includes('Versp_tet')));

                for (let i = headerIdx + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    const aufgabe = row[idxAufgabe];
                    const anlage = idxAnlage !== -1 ? row[idxAnlage] : 'System';
                    const plannedYear = idxJahr !== -1 ? parseInt(row[idxJahr]) : 2025;
                    const plannedKw = idxKw !== -1 ? parseInt(row[idxKw]) : 1;
                    const wer = idxWer !== -1 ? row[idxWer] : 'MA';
                    const datumRaw = idxDatumDone !== -1 ? row[idxDatumDone] : null;
                    const visum = idxVisum !== -1 ? row[idxVisum] : '';
                    const delayVal = idxLate !== -1 ? parseInt(row[idxLate]) : 0;

                    if (!aufgabe) continue;

                    const datumStr = formatToInputDate(datumRaw);
                    let doneKw = null;
                    let doneYear = null;
                    let isLate = false;
                    let delayWeeks = 0;

                    const d = parseToDateObj(datumRaw);
                    if (d) {
                        doneKw = getWeek(d);
                        doneYear = d.getFullYear();
                        // Real delay calculation
                        if (doneYear > plannedYear || (doneYear === plannedYear && doneKw > plannedKw)) {
                            isLate = true;
                            delayWeeks = (doneYear - plannedYear) * 52 + (doneKw - plannedKw);
                        }
                    }

                    // Fallback to Excel's Verspätet flag if our calculation didn't find delay but Excel says there is one
                    if (!isLate && delayVal > 0) {
                        isLate = true;
                        delayWeeks = delayVal;
                    }

                    const taskObj = {
                        id: `T-${id}-${deptBlock.tasks.length + 100}`,
                        title: aufgabe.toString(),
                        kw: plannedKw,
                        plannedKw,
                        plannedYear,
                        year: plannedYear,
                        anlage: anlage ? anlage.toString() : 'N/A',
                        status: 'Done',
                        visum: visum ? visum.toString() : "",
                        datum: datumStr,
                        doneKw,
                        doneYear,
                        wer: wer ? wer.toString() : 'MA',
                        isLate,
                        delayWeeks
                    };

                    const taskKey = `${taskObj.title.toLowerCase()}|${taskObj.anlage.toLowerCase()}|${taskObj.plannedKw}|${taskObj.plannedYear}`;
                    // Archiv entries take precedence over live journal if they exist in both
                    if (!processedTaskKeys.has(taskKey)) {
                        processedTaskKeys.add(taskKey);
                        deptBlock.tasks.push(taskObj);
                    } else {
                        duplicateCount++;
                    }
                }
            }
        }

        // Sort tasks by date (newest first for better archive display)
        deptBlock.tasks.sort((a, b) => {
            // Priority: Date string, then Year/KW
            if (a.datum && b.datum) return b.datum.localeCompare(a.datum);
            if (a.year !== b.year) return b.year - a.year;
            return b.kw - a.kw;
        });

        // Calc basic stats based on tasks
        const allDoneTasks = deptBlock.tasks.filter(t => t.status === 'Done');
        const erledigt = allDoneTasks.length;
        const erledigtPuenktlich = allDoneTasks.filter(t => !t.isLate).length;

        // For efficiency, we count everything that is done + everything that is still open but was planned for the past or now.
        const offenAndDue = deptBlock.tasks.filter(t =>
            t.status !== 'Done' &&
            (t.plannedYear < 2026 || (t.plannedYear === 2026 && t.plannedKw <= CURRENT_KW))
        );

        const totalPlannedUntilNow = erledigt + offenAndDue.length;

        deptBlock.stats.geplant = totalPlannedUntilNow;
        deptBlock.stats.erledigt = erledigt;
        deptBlock.stats.erledigtPuenktlich = erledigtPuenktlich;
        deptBlock.stats.offen = offenAndDue.length;

        if (deptBlock.stats.geplant > 0) {
            // Efficiency is now specifically "On-Time Executed" / "Total Planned"
            deptBlock.stats.erfüllungsquote = Math.round((erledigtPuenktlich / deptBlock.stats.geplant) * 100);
        } else {
            deptBlock.stats.erfüllungsquote = 0;
        }

        // --- Bottleneck Analysis (Top 2 Delayed Tasks) ---
        const taskDelays = new Map();
        deptBlock.tasks.forEach(t => {
            if (t.isLate) {
                const title = t.title.trim();
                const existing = taskDelays.get(title) || { count: 0, totalDelay: 0, maxDelay: 0 };
                existing.count++;
                existing.totalDelay += (t.delayWeeks || 0);
                existing.maxDelay = Math.max(existing.maxDelay, (t.delayWeeks || 0));
                taskDelays.set(title, existing);
            }
        });

        const sortedDelays = Array.from(taskDelays.entries())
            .map(([title, stats]) => ({
                title,
                count: stats.count,
                avgDelay: Math.round((stats.totalDelay / stats.count) * 10) / 10,
                maxDelay: stats.maxDelay
            }))
            .sort((a, b) => b.count - a.count || b.maxDelay - a.maxDelay)
            .slice(0, 10);

        deptBlock.bottlenecks = sortedDelays;
        deptBlock.stats.spaetErledigt = deptBlock.tasks.filter(t => t.status === 'Done' && t.isLate).length;

        allData.push(deptBlock);
        console.log(`Parsed ${file} -> ${deptBlock.planningTasks.length} plan tasks, ${deptBlock.tasks.length} journal tasks. (Skipped ${duplicateCount} duplicates)`);
    } catch (e) {
        console.error(`Error processing ${file}:`, e);
    }
});

const outputPath = path.join(__dirname, '../src/data/realData.json');
fs.writeFileSync(outputPath, JSON.stringify(allData, null, 2));
console.log(`\nWritten updated JSON data to ${outputPath}`);
