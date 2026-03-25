import realData from './realData.json';
import { APP_CONFIG } from '../config';

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

const filterAndRecalculate = (data: any[]): DepartmentData[] => {
  return data.map(dept => {
    // Only keeping tasks from 2026 onwards
    const filteredTasks = (dept.tasks || []).filter((t: any) => {
      const year = t.year || t.plannedYear; // Handle both schemas
      return year >= 2026;
    });

    // Recalculate Statistics
    // Only count tasks towards "Efficiency" if they are either DONE or LATE (Open but past due)
    const currentKw = APP_CONFIG.CURRENT_KW;
    const currentYear = APP_CONFIG.CURRENT_YEAR;

    const relevantForEfficiency = filteredTasks.filter((t: any) => {
      if (t.status === 'Done') return true;
      // If open, check if it's already late
      const tYear = t.year || t.plannedYear || currentYear;
      const tKw = t.kw || t.plannedKw || 1;
      if (tYear < currentYear) return true;
      if (tYear === currentYear && tKw < currentKw) return true;
      return false;
    });

    const geplant = relevantForEfficiency.length;
    const erledigt = filteredTasks.filter((t: any) => t.status === 'Done').length;
    const erledigtPuenktlich = filteredTasks.filter((t: any) => t.status === 'Done' && !t.isLate).length;
    const spaetErledigt = filteredTasks.filter((t: any) => t.status === 'Done' && t.isLate).length;
    const offen = filteredTasks.filter((t: any) => t.status !== 'Done').length;
    const rate = geplant > 0 ? Math.round((erledigtPuenktlich / geplant) * 100) : 100;

    return {
      ...dept,
      stats: {
        geplant,
        erledigt,
        erledigtPuenktlich,
        offen,
        erfüllungsquote: rate,
        spaetErledigt
      },
      tasks: filteredTasks
    };
  });
};

export const mockData: DepartmentData[] = filterAndRecalculate(realData);
