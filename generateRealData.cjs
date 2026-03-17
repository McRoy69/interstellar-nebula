const fs = require('fs');

const statsPath = 'c:/tmp/stats.json';
const departmentsMap = {
    'Brünieren': 'c:/tmp/brunieren.json',
    'QPQ': 'c:/tmp/qpq.json',
    'Armoloy': 'c:/tmp/armoloy.json',
    'Plasmanitrieren': 'c:/tmp/plani.json',
    'INDH': 'c:/tmp/indh.json',
    'Vakuumhärten': 'c:/tmp/vakuum.json',
    'Härten': 'c:/tmp/haerten.json'
};

const excelDateToJS = (serial) => {
    if (!serial || isNaN(serial)) return null;
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
};

const getKW = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

try {
    const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    const globalStats = statsData['Zentrale_Statistik (2)'];

    const finalData = globalStats.map((dept, index) => {
        const deptName = dept.Abteilung;
        const filePath = departmentsMap[deptName];
        let tasks = [];
        let planningTasks = [];

        if (filePath && fs.existsSync(filePath)) {
            const deptData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const journal = deptData.Journal || [];
            const planMatrix = deptData.Kalender_KW || [];

            // Map Journal Tasks
            tasks = journal.slice(1).filter(t => t.__EMPTY_1).map((t, tid) => {
                const plannedDate = excelDateToJS(t.__EMPTY_6);
                const doneDate = excelDateToJS(t.__EMPTY_4);

                let status = 'Open'; // Internally standardized
                if (doneDate) {
                    status = 'Done';
                } else if (plannedDate && plannedDate < new Date()) {
                    status = 'Late';
                }

                return {
                    id: `${deptName.substring(0, 3).toUpperCase()}-${tid + 100}`,
                    title: t.__EMPTY_1 || 'Maintenance Task',
                    kw: plannedDate ? getKW(plannedDate) : 0,
                    year: plannedDate ? plannedDate.getFullYear() : 2026,
                    anlage: t.__EMPTY || 'Allgemein',
                    status: status,
                    visum: t.__EMPTY_5 || '',
                    datum: doneDate ? doneDate.toISOString().split('T')[0] : ''
                };
            }).slice(-100);

            // Map Planning Matrix Tasks
            planningTasks = planMatrix.slice(3).filter(p => p['Kalender (Aufgabe x KW)']).map((p, pid) => {
                const weeks = {};
                for (let i = 1; i <= 52; i++) {
                    const key = i === 1 ? '__EMPTY' : `__EMPTY_${i - 1}`;
                    if (p[key] === 'x' || p[key] === 'b') {
                        weeks[i] = true;
                    }
                }
                return {
                    id: `PLAN-${pid}`,
                    anlage: 'N/A', // Usually task contains anlage info in string
                    title: p['Kalender (Aufgabe x KW)'],
                    wer: 'MA',
                    frequenz: 'Wöchentlich',
                    weeks: weeks
                };
            });
        }

        return {
            id: (index + 1).toString(),
            name: deptName,
            stats: {
                geplant: dept.Geplant || 0,
                erledigt: dept.Erledigt || 0,
                offen: dept.Offen || 0,
                erfüllungsquote: Math.round((dept['Erfüllungsquote'] || 0) * 100)
            },
            tasks: tasks,
            planningTasks: planningTasks
        };
    });

    const outputContent = `
export interface Task {
    id: string;
    title: string;
    kw: number;
    year: number;
    anlage: string;
    status: 'Open' | 'Done' | 'Late';
    visum?: string;
    datum?: string;
}

export interface PlanningTask {
    id: string;
    anlage: string;
    title: string;
    wer: string;
    frequenz: string;
    weeks: { [key: number]: boolean };
}

export interface DepartmentData {
    id: string;
    name: string;
    stats: {
        geplant: number;
        erledigt: number;
        offen: number;
        erfüllungsquote: number;
    };
    tasks: Task[];
    planningTasks: PlanningTask[];
}

export const mockData: DepartmentData[] = ${JSON.stringify(finalData, null, 2)};
`;

    fs.writeFileSync('src/data/mockData.ts', outputContent, 'utf8');
    console.log('Real data file generated successfully in src/data/mockData.ts');

} catch (error) {
    console.error('Error generating real data:', error);
    process.exit(1);
}
