import realData from './realData.json';
import { APP_CONFIG } from '../config';
import { getFrequencyBuffer } from '../utils/dateUtils';

export interface Task {
  id: string;
  title: string;
  kw: number;
  year: number;
  anlage: string;
  status: 'Open' | 'Done' | 'Late';
  visum?: string;
  datum?: string;
  wer?: string;
  frequenz?: string;
  isLate?: boolean;
  delayWeeks?: number;
  doneKw?: number;
  doneYear?: number;
  translations?: {
    [lang: string]: { title: string; anlage: string; }
  };
  planningTaskId?: string;
}

export interface PlanningTask {
  id: string;
  anlage: string;
  title: string;
  wer: string;
  frequenz: string;
  weeks: { [key: number]: boolean };
  abKw?: number;
  overrides?: { [key: number]: boolean };
  translations?: {
    [lang: string]: { title: string; anlage: string; }
  };
}

export const isTaskPlanned = (task: PlanningTask, kw: number) => {
  // 1. Overrides from MatrixView clicks (highest priority)
  if (task.overrides && task.overrides[kw] !== undefined) return task.overrides[kw];

  // 2. Algorithm priority: If start week (abKw) is set OR if we have a frequency, it defines the schedule
  const freq = task.frequenz?.toLowerCase() || '';
  // Default to 1 if frequency is set but abKw is missing
  const startKw = task.abKw !== undefined ? Number(task.abKw) : (freq ? 1 : undefined);

  if (startKw !== undefined && freq) {
    if (kw < startKw) return false;

    // For "Once" tasks, it only happens on the start week
    if (freq.includes('einmalig')) return kw === startKw;

    // For periodic tasks, follow the cycle
    let step = 1;
    if (freq.includes('wöchentlich') || freq.includes('weekly')) step = 1;
    else if (freq.includes('alle 2 wochen') || freq.includes('biweekly')) step = 2;
    else if (freq.includes('monatlich') || freq.includes('monthly')) step = 4;
    else if (freq.includes('vierteljährlich') || freq.includes('quarterly')) step = 13;
    else if (freq.includes('halbjährlich') || freq.includes('semi-annually')) step = 26;
    else if (freq.includes('jährlich') || freq.includes('annually')) step = 52;
    else if (freq.includes('täglich') || freq.includes('daily')) step = 1;

    return (kw - startKw) % step === 0;
  }

  // 3. Fallback to explicit manual weeks (from Excel source) only if abKw is missing
  if (task.weeks && task.weeks[kw] !== undefined) return task.weeks[kw];

  return false;
};

export interface DepartmentData {
  id: string;
  name: string;
  verantwortlicher?: string;
  stats: {
    geplant: number;
    erledigt: number;
    erledigtPuenktlich: number;
    offen: number;
    erfüllungsquote: number;
    spaetErledigt?: number;
  };
  tasks: Task[];
  planningTasks: PlanningTask[];
  bottlenecks?: {
    title: string;
    count: number;
    avgDelay: number;
    maxDelay: number;
    translations?: {
      [lang: string]: {
        title: string;
        anlage: string;
      }
    };
  }[];
}

const calculateBottlenecks = (tasks: Task[]) => {
  const currentKw = APP_CONFIG.CURRENT_KW;
  
  // Group all LATE tasks by title to find systemic bottlenecks
  const groups: Record<string, { title: string, count: number, totalDelay: number, maxDelay: number, translations?: any }> = {};
  
  tasks.forEach(t => {
      if (t.status === 'Done') return; 
      
      const delta = currentKw - (t.kw || 0);
      const buffer = getFrequencyBuffer(t.frequenz || '');
      const currentDelay = delta - buffer;
      
      if (currentDelay >= 0) { // It's past its frequency-based buffer
          const key = t.title;
          if (!groups[key]) {
              groups[key] = { title: t.title, count: 0, totalDelay: 0, maxDelay: 0, translations: t.translations };
          }
          groups[key].count++;
          groups[key].totalDelay += Math.max(0, currentDelay);
          groups[key].maxDelay = Math.max(groups[key].maxDelay, currentDelay);
      }
  });
  
  return Object.values(groups)
      .sort((a, b) => (b.count - a.count) || (b.maxDelay - a.maxDelay))
      .map(g => ({
          title: g.title,
          count: g.count,
          avgDelay: Math.round((g.totalDelay / g.count) * 10) / 10,
          maxDelay: g.maxDelay,
          translations: g.translations
      }))
      .slice(0, 3); // FLOP-3
};

export const recalculateDepartment = (dept: any): DepartmentData => {
  // Only keeping tasks from 2026 onwards
  const filteredTasks = (dept.tasks || []).filter((t: any) => {
    const year = t.year || t.plannedYear; // Handle both schemas
    return year >= 2026;
  });

  // Recalculate Statistics
  const currentKw = APP_CONFIG.CURRENT_KW;
  const currentYear = APP_CONFIG.CURRENT_YEAR;

  const relevantForEfficiency = filteredTasks.filter((t: any) => {
    if (t.status === 'Done') return true;
    // If open, check if it's already past the buffer
    const tYear = t.year || t.plannedYear || currentYear;
    if (tYear < currentYear) return true;
    if (tYear > currentYear) return false;

    const delta = currentKw - (t.kw || t.plannedKw || 1);
    const buffer = getFrequencyBuffer(t.frequenz || '');
    return delta >= buffer;
  });

  const geplant = relevantForEfficiency.length;
  const totalErledigtTasks = filteredTasks.filter((t: any) => t.status === 'Done');
  
  // A task is "punctual" if it was done within its frequency buffer
  const erledigtPuenktlich = totalErledigtTasks.filter((t: any) => {
      const dKw = t.doneKw || t.kw;
      const pKw = t.kw || t.plannedKw || dKw;
      const delta = dKw - pKw;
      const buffer = getFrequencyBuffer(t.frequenz || '');
      return delta < buffer;
  }).length;

  const spaetErledigt = totalErledigtTasks.length - erledigtPuenktlich;
  const offen = relevantForEfficiency.filter((t: any) => t.status !== 'Done').length;
  const rate = geplant > 0 ? Math.round((totalErledigtTasks.length / geplant) * 100) : 100;

  const bottlenecks = calculateBottlenecks(filteredTasks);

  return {
    ...dept,
    stats: {
      geplant,
      erledigt: totalErledigtTasks.length,
      erledigtPuenktlich,
      offen,
      erfüllungsquote: rate,
      spaetErledigt
    },
    tasks: filteredTasks,
    bottlenecks
  };
};

const filterAndRecalculate = (data: any[]): DepartmentData[] => {
  return data.map(dept => recalculateDepartment(dept));
};

export const mockData: DepartmentData[] = filterAndRecalculate(realData);
