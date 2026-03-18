import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

        // Merge defaults, DB settings, and local UI overrides
        const localUiPrefs = localStorage.getItem('wartungsplan-ui-prefs');
        const parsedLocalUi = localUiPrefs ? JSON.parse(localUiPrefs) : {};

        const mergedSettings = {
          ...defaultSettings,
          ...finalSettings,
          thresholds: { ...defaultSettings.thresholds, ...(finalSettings.thresholds || {}) },
          ui: { ...defaultSettings.ui, ...(finalSettings.ui || {}), ...parsedLocalUi },
          notifications: { ...defaultSettings.notifications, ...(finalSettings.notifications || {}) }
        };
        finalSettings = mergedSettings;

        // Apply Global Sync Logic (Injection of missing KW tasks)
        const CURRENT_KW = APP_CONFIG.CURRENT_KW;
        let syncedDepts = finalDepts.map((dept: any) => {
          // Hardcore fix for "Armoloy" name - prevent any accidental translation or renaming
          if (String(dept.id) === '3' || dept.name.toLowerCase().includes('waffe') || dept.name.toLowerCase().includes('armo')) {
            dept.name = 'Armoloy';
          }

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
                  isLate: false,
                  translations: pt.translations
                });
              }
            }
          });

          const mergedTasks = [...(dept.tasks || []), ...missingTasks];
          const filteredTasks = mergedTasks.filter((taskItem: any) => (taskItem.year || taskItem.plannedYear || 2026) >= 2026);

          const geplant = Number(filteredTasks.length) || 0;
          const erledigtPuenktlich = Number(filteredTasks.filter((ti: any) => ti.status === 'Done' && !ti.isLate).length) || 0;
          const spaetErledigt = Number(filteredTasks.filter((ti: any) => ti.status === 'Done' && ti.isLate).length) || 0;
          const rate = geplant > 0 ? Math.round((erledigtPuenktlich / geplant) * 100) : 100;

          // Dynamic bottleneck calculation
          const taskGroups: Record<string, { count: number; delays: number[]; translations?: any }> = {};
          filteredTasks.forEach(t => {
            if (t.status !== 'Done') {
              const title = t.title;
              if (!taskGroups[title]) taskGroups[title] = { count: 0, delays: [], translations: t.translations };
              taskGroups[title].count++;
              taskGroups[title].delays.push(Math.max(0, CURRENT_KW - (t.kw || CURRENT_KW)));
            }
          });

          const dynamicBottlenecks = Object.entries(taskGroups)
            .map(([title, data]) => ({
              title,
              count: data.count,
              avgDelay: data.delays.length > 0 ? Math.round(data.delays.reduce((a, b) => a + b, 0) / data.delays.length) : 0,
              maxDelay: data.delays.length > 0 ? Math.max(...data.delays) : 0,
              translations: data.translations
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          return {
            ...dept,
            stats: {
              ...dept.stats,
              geplant,
              erledigt: Number(filteredTasks.filter((ti: any) => ti.status === 'Done').length) || 0,
              erledigtPuenktlich,
              spaetErledigt,
              offen: Number(filteredTasks.filter((ti: any) => ti.status !== 'Done').length) || 0,
              erfüllungsquote: rate
            },
            tasks: filteredTasks,
            bottlenecks: dynamicBottlenecks
          };
        });

        // Absolute sorting: Armoloy always last, others alphabetical
        syncedDepts.sort((a, b) => {
          if (a.name === 'Armoloy') return 1;
          if (b.name === 'Armoloy') return -1;
          return a.name.localeCompare(b.name);
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
        // Save UI prefs locally only
        localStorage.setItem('wartungsplan-ui-prefs', JSON.stringify(settings.ui));

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleUpdateDepartment = (updatedDept: DepartmentData) => {
    setDepartments(prev => prev.map(d => d.id === updatedDept.id ? updatedDept : d));
  };

  const activeDept = departments.find((d: DepartmentData) => d.id === activeView);

  const handleNavigate = (id: string, tab?: string) => {
    setActiveView(id);
    setInitialTab(tab);
    setIsSidebarOpen(false); // Close sidebar on mobile after navigation
  };

  return (
    <div className={`flex min-h-[100dvh] h-[100dvh] font-sans selection:bg-amber-500/30 transition-colors duration-500 theme-${settings.ui.theme} notranslate overflow-hidden`}
      translate="no"
      style={{
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text-main)'
      }}
    >
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="xl:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <Sidebar
        activeId={activeView}
        onSelect={(id) => handleNavigate(id)}
        departments={departments}
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={() => setIsSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Mobile Menu Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="xl:hidden fixed top-6 right-6 z-[60] w-12 h-12 rounded-xl shadow-2xl flex items-center justify-center border transition-all active:scale-95"
        style={{
          backgroundColor: 'var(--color-accent)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-bg-sidebar)',
          boxShadow: '0 8px 20px -5px var(--color-accent-glow)'
        }}
      >
        <div className="flex flex-col gap-1.5 pointer-events-none">
          <div className={`w-5 h-0.5 bg-current transition-all duration-300 ${isSidebarOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <div className={`w-5 h-0.5 bg-current transition-all duration-300 ${isSidebarOpen ? 'opacity-0' : ''}`} />
          <div className={`w-5 h-0.5 bg-current transition-all duration-300 ${isSidebarOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </div>
      </button>

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
              onUpdate={handleUpdateDepartment}
            />
          )
        )}
      </main>
    </div>
  );
}

export default App;
