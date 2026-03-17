import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DepartmentView from './components/DepartmentView';
import SettingsView from './components/SettingsView';
import { mockData, isTaskPlanned } from './data/mockData';
import type { AppSettings } from './types/settings';
import { defaultSettings } from './types/settings';
import type { DepartmentData, Task } from './data/mockData';
import { APP_CONFIG } from './config';

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [initialTab, setInitialTab] = useState<string | undefined>(undefined);
  useTranslation();

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Initial Load from API (with LocalStorage fallback for migration)
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/data');
        const dbData = await response.json();

        let finalSettings = defaultSettings;
        let finalDepts = mockData;

        if (dbData) {
          // data exists in DB
          finalSettings = dbData.settings || defaultSettings;
          finalDepts = dbData.departments || mockData;
        } else {
          // DB is empty, try to migrate from LocalStorage
          const savedSettings = localStorage.getItem('appSettings');
          const savedDepts = localStorage.getItem('appDepartments');
          if (savedSettings) finalSettings = JSON.parse(savedSettings);
          if (savedDepts) finalDepts = JSON.parse(savedDepts);
        }

        // Apply Global Sync Logic (Injection of missing KW tasks)
        const CURRENT_KW = APP_CONFIG.CURRENT_KW;
        const syncedDepts = finalDepts.map((dept: any) => {
          const existingTaskKeys = new Set((dept.tasks || []).map((ti: any) => `${ti.anlage}-${ti.title}-${ti.kw}-${ti.year}`));
          const missingTasks: Task[] = [];

          (dept.planningTasks || []).forEach((pt: any) => {
            if (isTaskPlanned(pt, CURRENT_KW)) {
              const key = `${pt.anlage}-${pt.title}-${CURRENT_KW}-2026`;
              if (!existingTaskKeys.has(key)) {
                missingTasks.push({
                  id: `auto-${Date.now()}-${pt.id}`,
                  title: pt.title,
                  anlage: pt.anlage,
                  kw: CURRENT_KW,
                  year: 2026,
                  status: 'Open',
                  wer: pt.wer,
                  isLate: false
                });
              }
            }
          });

          const mergedTasks = [...(dept.tasks || []), ...missingTasks];
          const filteredTasks = mergedTasks.filter((taskItem: any) => (taskItem.year || taskItem.plannedYear || 2026) >= 2026);

          const geplant = filteredTasks.length;
          const erledigtPuenktlich = filteredTasks.filter((ti: any) => ti.status === 'Done' && !ti.isLate).length;
          const spaetErledigt = filteredTasks.filter((ti: any) => ti.status === 'Done' && ti.isLate).length;
          const rate = geplant > 0 ? Math.round((erledigtPuenktlich / geplant) * 100) : 100;

          return {
            ...dept,
            stats: {
              ...dept.stats,
              geplant,
              erledigt: filteredTasks.filter((ti: any) => ti.status === 'Done').length,
              erledigtPuenktlich,
              spaetErledigt,
              offen: filteredTasks.filter((ti: any) => ti.status !== 'Done').length,
              erfüllungsquote: rate
            },
            tasks: filteredTasks
          };
        });

        setSettings(finalSettings);
        setDepartments(syncedDepts);
        setIsLoaded(true);
      } catch (e) {
        console.error('Failed to load data from API', e);
        // Emergency fallback to local mock
        setDepartments(mockData);
        setIsLoaded(true);
      }
    };

    loadData();
  }, []);

  // 2. Persist to API whenever state changes
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      try {
        await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings, departments })
        });
      } catch (e) {
        console.error('Failed to save to database', e);
      }
    };

    const timer = setTimeout(saveData, 1000); // Debounce save
    return () => clearTimeout(timer);
  }, [settings, departments, isLoaded]);

  const activeDept = departments.find((d: DepartmentData) => d.id === activeView);

  const handleNavigate = (id: string, tab?: string) => {
    setActiveView(id);
    setInitialTab(tab);
  };

  return (
    <div className={`flex h-screen font-sans selection:bg-amber-500/30 transition-colors duration-500 theme-${settings.ui.theme}`}
      style={{
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text-main)'
      }}
    >
      <Sidebar
        activeId={activeView}
        onSelect={(id) => handleNavigate(id)}
        departments={departments}
      />

      <main className="flex-1 overflow-hidden relative">
        {activeView === 'dashboard' ? (
          <Dashboard
            onNavigate={handleNavigate}
            departments={departments}
            settings={settings}
          />
        ) : activeView === 'settings' ? (
          <SettingsView
            settings={settings}
            setSettings={setSettings}
            departments={departments}
            setDepartments={setDepartments}
          />
        ) : (
          activeDept && (
            <DepartmentView
              key={activeDept.id}
              data={activeDept}
              initialTab={initialTab}
              settings={settings}
            />
          )
        )}
      </main>
    </div>
  );
}

export default App;
