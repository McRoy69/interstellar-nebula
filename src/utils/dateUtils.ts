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

export function parseTaskDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Handle DD.MM.YYYY format
  if (dateStr.includes('.')) {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // Fallback to native parsing (e.g. YYYY-MM-DD)
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}
