import React, { useState, useEffect, useRef } from 'react';
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
import { getFrequencyBuffer } from './utils/dateUtils';

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [initialTab, setInitialTab] = useState<string | undefined>(undefined);
  useTranslation();

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const isSyncingRef = useRef(false);

  // 1. Initial Load from API (with LocalStorage fallback for migration)
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/data');
        const dbData = await response.json();

        let finalSettings = defaultSettings;
        let finalDepts = mockData;

        if (dbData) {
          finalSettings = dbData.settings || defaultSettings;
          finalDepts = dbData.departments || mockData;
        } else {
          const savedSettings = localStorage.getItem('appSettings');
          const savedDepts = localStorage.getItem('appDepartments');
          if (savedSettings) finalSettings = JSON.parse(savedSettings);
          if (savedDepts) finalDepts = JSON.parse(savedDepts);
        }

        const localUiPrefs = localStorage.getItem('wartungsplan-ui-prefs');
        const parsedLocalUi = localUiPrefs ? JSON.parse(localUiPrefs) : {};

        const mergedSettings = {
          ...defaultSettings,
          ...finalSettings,
          thresholds: { ...defaultSettings.thresholds, ...(finalSettings.thresholds || {}) },
          ui: { ...defaultSettings.ui, ...(finalSettings.ui || {}), ...parsedLocalUi },
          notifications: { ...defaultSettings.notifications, ...(finalSettings.notifications || {}) }
        };

        if (mergedSettings.thresholds.criticalWeeks === 1) {
          mergedSettings.thresholds.criticalWeeks = 3;
        }

        setSettings(mergedSettings);
        setDepartments(finalDepts);
        setIsLoaded(true);
      } catch (e) {
        console.error('Failed to load data from API', e);
        setDepartments(mockData);
        setIsLoaded(true);
      }
    };

    loadData();
  }, []);

  // 1. Core Synchronization: Planning Matrix -> Operating Journal
  useEffect(() => {
    if (!isLoaded) return;
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    const syncedDepts = departments.map(dept => {
      const deptCopy = JSON.parse(JSON.stringify(dept));
      const CURRENT_KW = APP_CONFIG.CURRENT_KW;

      // Standardize name if necessary
      if (String(deptCopy.id) === '3' || deptCopy.name.toLowerCase().includes('waffe') || deptCopy.name.toLowerCase().includes('armo')) {
        deptCopy.name = 'Armoloy';
      }

      const existingTaskKeys = new Set();
      const cleanExistingTasks = (deptCopy.tasks || []).filter((ti: any) => {
        const t = (ti.title || "").toLowerCase().trim();
          const a = (ti.anlage || "").toLowerCase().trim();
          const kw = ti.kw;
          const y = ti.year || APP_CONFIG.CURRENT_YEAR;
          const ptId = ti.planningTaskId;

          const pt = (dept.planningTasks || []).find((p: any) => 
            ptId ? p.id === ptId : (
              (p.title || "").toLowerCase().trim() === t && 
              (p.anlage || "").toLowerCase().trim() === a
            )
          );

          if (pt) {
            if (!isTaskPlanned(pt, kw)) {
              if (ti.id?.startsWith('auto-') && !ti.datum && !ti.visum) {
                return false;
              }
            }
          } else if (ti.id?.startsWith('auto-')) {
            return false;
          }

        existingTaskKeys.add(`${a}-${t}-${kw}-${y}`);
        return true;
      });

      const missingTasks: Task[] = [];
      (deptCopy.planningTasks || []).forEach((pt: any) => {
        for (let kw = 1; kw <= CURRENT_KW; kw++) {
          if (isTaskPlanned(pt, kw)) {
            const t = (pt.title || "").toLowerCase().trim();
            const a = (pt.anlage || "").toLowerCase().trim();
            const key = `${a}-${t}-${kw}-${APP_CONFIG.CURRENT_YEAR}`;

            if (!existingTaskKeys.has(key)) {
              const buffer = getFrequencyBuffer(pt.frequenz);
              missingTasks.push({
                id: `auto-${deptCopy.id}-${pt.id}-${kw}`,
                planningTaskId: pt.id,
                title: pt.title,
                anlage: pt.anlage,
                kw: kw,
                year: APP_CONFIG.CURRENT_YEAR,
                status: 'Open',
                wer: pt.wer,
                frequenz: pt.frequenz,
                isLate: (CURRENT_KW - kw) >= buffer,
                translations: pt.translations
              });
              existingTaskKeys.add(key);
            }
          }
        }
      });

      if (missingTasks.length === 0 && cleanExistingTasks.length === (dept.tasks || []).length) {
        return dept;
      }

      return {
        ...deptCopy,
        tasks: [...cleanExistingTasks, ...missingTasks].filter((ti: any) => (ti.year || APP_CONFIG.CURRENT_YEAR) >= APP_CONFIG.CURRENT_YEAR)
      };
    });

    if (JSON.stringify(syncedDepts) !== JSON.stringify(departments)) {
      setDepartments(syncedDepts);
    }
    
    // Release lock after a short delay to allow state to settle
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 100);
  }, [departments, isLoaded, settings.thresholds.criticalWeeks]);

  // 2. Persist to API whenever state changes
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      try {
        // Save redundant copy to LocalStorage
        localStorage.setItem('appSettings', JSON.stringify(settings));
        localStorage.setItem('appDepartments', JSON.stringify(departments));
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
