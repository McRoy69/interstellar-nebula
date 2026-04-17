/**
 * ISO 8601 week calculation logic.
 * The week number is the number of weeks since the first Thursday of the year.
 */

export function getISOWeek(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

export function getISOYear(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

export function getFrequencyBuffer(frequenz: string = ''): number {
  const f = frequenz.toLowerCase();
  if (f.includes('jährlich') || f.includes('annually') || f.includes('jahrlich')) return 52;
  if (f.includes('halbjährlich') || f.includes('semi-annually') || f.includes('halbjahrlich')) return 26;
  if (f.includes('vierteljährlich') || f.includes('quarterly') || f.includes('vierteljahr')) return 13;
  if (f.includes('monatlich') || f.includes('monthly')) return 4;
  if (f.includes('alle 2 wochen') || f.includes('biweekly')) return 2;
  return 1; // Default for daily/weekly
}

/**
 * Calculates a unique week index to handle multi-year comparisons.
 */
export function getAbsoluteWeek(year: number, week: number): number {
  return (year * 53) + Number(week);
}

export function parseTaskDate(dateStr: string): { date: Date, kw: number, year: number } | null {
  if (!dateStr) return null;
  
  let d: Date | null = null;

  // Handle German format (DD.MM.YYYY)
  if (dateStr.includes('.')) {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      d = new Date(year, month, day);
    }
  } else {
    // Native parsing for ISO (YYYY-MM-DD)
    d = new Date(dateStr);
  }
  
  if (!d || isNaN(d.getTime())) return null;

  return {
    date: d,
    kw: getISOWeek(d),
    year: getISOYear(d)
  };
}

export function calculateTaskPunctuality(task: { kw: number, year?: number, status: string, datum?: string, doneKw?: number, doneYear?: number, frequenz?: string }, currentKw: number): { isLate: boolean, delayWeeks: number } {
  const buffer = getFrequencyBuffer(task.frequenz || '');
  let isLate = false;
  let delayWeeks = 0;

  const currentYear = new Date().getFullYear(); // Baseline
  const plannedYear = Number(task.year || currentYear);
  const plannedKw = Number(task.kw || 0);
  const plannedAbsolute = getAbsoluteWeek(plannedYear, plannedKw);

  if (task.status === 'Done') {
    let dKw = task.doneKw;
    let dYear = task.doneYear || plannedYear;
    
    // Derived from completion date if available
    if (task.datum) {
      const parsed = parseTaskDate(task.datum);
      if (parsed) {
        dKw = parsed.kw;
        dYear = parsed.year;
      }
    }
    
    const finalDoneKw = Number(dKw || plannedKw);
    const finalDoneYear = Number(dYear || plannedYear);
    const doneAbsolute = getAbsoluteWeek(finalDoneYear, finalDoneKw);
    
    const delta = doneAbsolute - plannedAbsolute;
    
    // Consistent logic: if delta is EQUAL to or GREATER than buffer, it is LATE.
    // Example: Weekly task (buffer 1) planned for KW 14. 
    // If done in KW 15: delta 1. 1 >= 1 is TRUE -> Late.
    // If you want to be more generous, use delta > buffer.
    // Based on user feedback, KW 14 done in KW 16 is definitely late.
    if (delta >= buffer) {
      isLate = true;
      delayWeeks = delta;
    }
  } else {
    // For OPEN tasks
    const currentAbsolute = getAbsoluteWeek(currentYear, currentKw);
    const delta = currentAbsolute - plannedAbsolute;
    
    if (delta >= buffer) {
      isLate = true;
      delayWeeks = Math.max(0, delta);
    }
  }

  return { isLate, delayWeeks };
}
