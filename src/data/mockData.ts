import realData from './realData.json';

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
  isLate?: boolean;
  delayWeeks?: number;
  doneKw?: number;
  doneYear?: number;
  translations?: {
    [lang: string]: { title: string; anlage: string; }
  };
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
  const startKw = task.abKw || 1;
  const freq = task.frequenz;
  if (task.overrides && task.overrides[kw] !== undefined) return task.overrides[kw];
  if (kw < startKw) return false;
  let step = 1;

  // Use the standard German values that are currently used as 'value' in the select
  const f = freq.toLowerCase();
  if (f.includes('wöchentlich')) step = 1;
  else if (f.includes('alle 2 wochen')) step = 2;
  else if (f.includes('monatlich')) step = 4;
  else if (f.includes('vierteljährlich')) step = 13;
  else if (f.includes('halbjährlich')) step = 26;
  else if (f.includes('jährlich')) step = 52;
  else if (f.includes('täglich')) step = 1;

  return (kw - startKw) % step === 0;
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
    const geplant = filteredTasks.length;
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
