import React, { useState } from 'react';
import type { DepartmentData, Task, PlanningTask } from '../data/mockData';
import type { AppSettings } from '../types/settings';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ClipboardList, Archive, BarChart3, Settings as Tools, Search,
    CheckCircle2, Clock, AlertTriangle, ChevronRight, Download,
    Calendar, User, Plus, Info, Activity, X, Filter
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isTaskPlanned } from '../data/mockData';
import { APP_CONFIG } from '../config';

interface DepartmentViewProps {
    data: DepartmentData;
    initialTab?: string;
    settings: AppSettings;
    onUpdate?: (updatedDept: DepartmentData) => void;
}

type TabType = 'Plan' | 'Journal' | 'Archiv' | 'Anlagen' | 'Statistik';


const DepartmentView: React.FC<DepartmentViewProps> = ({ data, initialTab, settings, onUpdate }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>((initialTab as TabType) || 'Journal');
    const [verantwortlicher, setVerantwortlicher] = useState(data.verantwortlicher || 'MA');
    const [searchQuery, setSearchQuery] = useState('');
    const [localTasks, setLocalTasks] = useState(data.tasks);
    const [localPlanningTasks, setLocalPlanningTasks] = useState(data.planningTasks || []);

    const currentKw = APP_CONFIG.CURRENT_KW; // Baseline for color logic

    React.useEffect(() => {
        setLocalTasks(data.tasks);
        setLocalPlanningTasks(data.planningTasks || []);
        setVerantwortlicher(data.verantwortlicher || 'MA');
    }, [data.id, data.tasks, data.planningTasks]);

    // Bubble up changes to parent
    React.useEffect(() => {
        if (!onUpdate) return;

        const filteredTasks = localTasks.filter((taskItem: any) => (taskItem.year || taskItem.plannedYear || 2026) >= 2026);
        const geplant = Number(filteredTasks.length) || 0;
        const erledigtPuenktlich = Number(filteredTasks.filter((ti: any) => ti.status === 'Done' && !ti.isLate).length) || 0;
        const spaetErledigt = Number(filteredTasks.filter((ti: any) => ti.status === 'Done' && ti.isLate).length) || 0;
        const rate = geplant > 0 ? Math.round((erledigtPuenktlich / geplant) * 100) : 100;

        const updated: DepartmentData = {
            ...data,
            verantwortlicher,
            tasks: localTasks,
            planningTasks: localPlanningTasks,
            stats: {
                ...data.stats,
                geplant,
                erledigt: Number(filteredTasks.filter((ti: any) => ti.status === 'Done').length) || 0,
                erledigtPuenktlich,
                spaetErledigt,
                offen: Number(filteredTasks.filter((ti: any) => ti.status !== 'Done').length) || 0,
                erfüllungsquote: rate
            }
        };

        // Only trigger if data actually changed to avoid infinite loops
        if (JSON.stringify(updated) !== JSON.stringify(data)) {
            onUpdate(updated);
        }
    }, [localTasks, localPlanningTasks, verantwortlicher, data, onUpdate]);


    const tabs = [
        { id: 'Plan', label: t('department.tabs.Plan'), icon: <Calendar size={16} /> },
        { id: 'Journal', label: t('department.tabs.Journal'), icon: <ClipboardList size={16} /> },
        { id: 'Archiv', label: t('department.tabs.Archiv'), icon: <Archive size={16} /> },
        { id: 'Anlagen', label: t('department.tabs.Anlagen'), icon: <Tools size={16} /> },
        { id: 'Statistik', label: t('department.tabs.Statistik'), icon: <BarChart3 size={16} /> },
    ];


    const getFrequencyPriority = (freq: string): number => {
        const f = freq.toLowerCase();
        if (f.includes('täglich')) return 1;
        if (f.includes('wöchentlich')) return 2;
        if (f.includes('alle 2 wochen')) return 3;
        if (f.includes('monatlich')) return 4;
        if (f.includes('vierteljährlich')) return 5;
        if (f.includes('halbjährlich')) return 6;
        if (f.includes('jährlich')) return 7;
        return 10;
    };

    const sortedPlanningTasks = [...localPlanningTasks].sort((a, b) => {
        return getFrequencyPriority(a.frequenz) - getFrequencyPriority(b.frequenz);
    });

    const getStatusInfo = (task: Task) => {
        if (task.status === 'Done') {
            return { label: t('department.statusLabels.done'), color: 'text-emerald-500', bg: 'bg-emerald-500' };
        }

        const delta = currentKw - task.kw;
        if (delta >= settings.thresholds.criticalWeeks) return { label: t('department.statusLabels.late3w'), color: 'text-orange-500', bg: 'bg-orange-500' };
        if (delta >= 1) return { label: t('department.statusLabels.late13w'), color: 'text-amber-500', bg: 'bg-amber-500' };
        return { label: t('department.statusLabels.current'), color: 'text-emerald-500', bg: 'bg-emerald-500' };
    };

    const handleAbschliessen = (taskId: string) => {
        setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Done' } : t));
    };


    const handleAddTask = (title: string, anlage: string, wer: string, frequenz: string, abKw: number) => {
        const newPlanningTask: PlanningTask = {
            id: `p-${Date.now()}`,
            title,
            anlage,
            wer: wer || 'MA',
            frequenz,
            weeks: {},
            abKw,
            overrides: {}
        };
        setLocalPlanningTasks(prev => [...prev, newPlanningTask]);
    };

    const handleUpdatePlanningTask = (taskId: string, updates: Partial<PlanningTask>) => {
        setLocalPlanningTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    };

    const handleToggleWeek = (taskId: string, kw: number) => {
        setLocalPlanningTasks(prev => prev.map(task => {
            if (task.id !== taskId) return task;

            // Logic for toggling: 
            // 1. Calculate if it WAS planned by default
            const startKw = task.abKw || 1;
            const freq = task.frequenz;
            let step = 1;
            const f = freq.toLowerCase();
            if (f.includes('alle 2 wochen')) step = 2;
            else if (f.includes('monatlich')) step = 4;
            else if (f.includes('vierteljährlich')) step = 13;
            else if (f.includes('halbjährlich')) step = 26;
            else if (f.includes('jährlich')) step = 52;

            const isDefaultPlanned = kw >= startKw && (kw - startKw) % step === 0;

            // 2. Toggle the override
            const currentOverrides = task.overrides || {};
            const isCurrentlyActive = currentOverrides[kw] !== undefined ? currentOverrides[kw] : isDefaultPlanned;

            return {
                ...task,
                overrides: {
                    ...currentOverrides,
                    [kw]: !isCurrentlyActive
                }
            };
        }));
    };

    const exportToPDF = () => {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a3'
        });

        const pageWidth = doc.internal.pageSize.width;
        const drawHeader = (title: string, subtitle: string) => {
            doc.setFillColor(15, 23, 42); // slate-900
            doc.rect(0, 0, pageWidth, 45, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(28);
            doc.setFont('helvetica', 'bold');
            doc.text(title, 20, 20);
            doc.setFontSize(12);
            doc.setTextColor(245, 158, 11); // amber-500
            doc.text(subtitle, 20, 32);
        };

        if (activeTab === 'Plan') {
            drawHeader(`${t('pdf.maintenancePlan')}: ${data.name}`, `${t('pdf.annualMatrix')} ${new Date().getFullYear()} - KW ${currentKw}`);

            const headers = [t('pdf.anlage'), t('department.matrix.taskMachine').split('/')[0].trim(), t('pdf.who'), t('department.matrix.freq'), t('pdf.planned'), ...Array.from({ length: 52 }, (_, i) => (i + 1).toString())];
            const tableData = sortedPlanningTasks.map(task => {
                const row = [task.anlage, task.title, task.wer, task.frequenz, (task.abKw || 1).toString()];
                for (let kw = 1; kw <= 52; kw++) {
                    const status = isTaskPlanned(task, kw);
                    row.push(status ? 'X' : '');
                }
                return row;
            });

            autoTable(doc, {
                head: [headers],
                body: tableData,
                startY: 50,
                theme: 'grid',
                styles: { fontSize: 6, cellPadding: 0.8, halign: 'center', valign: 'middle', lineWidth: 0.1, lineColor: [200, 200, 200] },
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 }, 1: { halign: 'left', cellWidth: 55 } },
                didParseCell: (d) => {
                    if (d.section === 'body' && d.column.index >= 5 && d.cell.text[0] === 'X') {
                        d.cell.styles.textColor = [217, 119, 6]; d.cell.styles.fontStyle = 'bold'; d.cell.styles.fontSize = 7;
                    }
                    if (d.section === 'body' && d.column.index === (currentKw + 4)) d.cell.styles.fillColor = [254, 243, 199];
                }
            });
        } else if (activeTab === 'Journal' || activeTab === 'Archiv') {
            const title = activeTab === 'Journal' ? t('pdf.productiveJournal') : t('pdf.historicalArchive');
            drawHeader(`${title}: ${data.name}`, `${t('pdf.executionReport')} - ${new Date().toLocaleDateString()}`);

            const currentTasks = localTasks.filter(t => (activeTab === 'Archiv' ? t.status === 'Done' : t.status !== 'Done'));
            const headers = ['ID', t('pdf.task'), t('pdf.anlage'), t('pdf.who'), t('pdf.planned'), t('department.journal.dateReal').split('(')[0].trim(), t('department.journal.visa'), t('department.journal.status')];
            const tableData = currentTasks.map(t => [
                t.id, t.title, t.anlage, t.wer || 'MA', `KW ${t.kw}`, t.datum || '-', t.visum || '-', getStatusInfo(t).label
            ]);

            autoTable(doc, {
                head: [headers],
                body: tableData,
                startY: 50,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 4, halign: 'left' },
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: { 0: { fontStyle: 'bold', textColor: [217, 119, 6], cellWidth: 20 } }
            });
        } else if (activeTab === 'Statistik') {
            drawHeader(`${t('pdf.metricsPerformance')}: ${data.name}`, `${t('pdf.statisticalReport')} - ${new Date().toLocaleDateString()}`);

            // Calculate statistics for PDF
            const erledigt = localTasks.filter(task => task.status === 'Done').length;
            const offen = localTasks.filter(task => task.status !== 'Done').length;
            const totalTasks = localTasks.length;
            const quote = totalTasks > 0 ? Math.round((erledigt / totalTasks) * 100) : 0;
            const lateTasks = localTasks.filter(task => task.status !== 'Done' && currentKw > task.kw);

            // KPI Summary
            doc.setFillColor(30, 41, 59);
            doc.roundedRect(20, 55, pageWidth - 40, 40, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.text(`${quote}%`, 40, 82);
            doc.setFontSize(10);
            doc.text(t('pdf.totalPerformance'), 40, 68);

            doc.setFontSize(18);
            doc.text(`${erledigt}`, 120, 82);
            doc.setFontSize(10);
            doc.text(t('pdf.executed'), 120, 68);

            doc.setFontSize(18);
            doc.text(`${offen}`, 200, 82);
            doc.setFontSize(10);
            doc.text(t('pdf.open'), 200, 68);

            doc.setFontSize(18);
            doc.setTextColor(225, 29, 72); // rose-600
            doc.text(`${lateTasks.length}`, 280, 82);
            doc.setFontSize(10);
            doc.text(t('pdf.late'), 280, 68);

            if (lateTasks.length > 0) {
                doc.setTextColor(15, 23, 42);
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(t('pdf.lateDetail'), 20, 110);

                const lateHeaders = ['ID', t('pdf.task'), t('pdf.anlage'), t('pdf.who'), t('pdf.delayWeeks')];
                const lateData = lateTasks.map(t => [t.id, t.title, t.anlage, t.wer, currentKw - t.kw]);

                autoTable(doc, {
                    head: [lateHeaders],
                    body: lateData as any,
                    startY: 115,
                    theme: 'grid',
                    styles: { fontSize: 10, cellPadding: 3 },
                    headStyles: { fillColor: [225, 29, 72] }
                });
            }
        }
        try {
            const safeTab = activeTab.toLowerCase().replace(/[^a-z0-9]/gi, '_');
            const safeName = data.name.toLowerCase().replace(/[^a-z0-9]/gi, '_');
            const timestamp = new Date().getTime();
            const filename = `plan_${safeTab}_${safeName}_${timestamp}.pdf`;

            doc.save(filename);
            console.log('PDF export successful:', filename);
        } catch (error: any) {
            console.error('PDF EXPORT FATAL ERROR:', error);
            alert(`Error al exportar PDF: ${error.message || 'Error desconocido'}`);
        }
    };

    const compact = settings.ui.compactMode;

    return (
        <div className="h-full bg-transparent flex flex-col overflow-hidden relative font-sans">
            {/* Elegant Background Thermal Glows */}
            <div className="absolute top-0 right-0 w-[50%] h-[50%] rounded-full blur-[100px] pointer-events-none"
                style={{ backgroundColor: 'var(--color-accent-glow)' }}
            />
            <div className="absolute bottom-0 left-0 w-[40%] h-[40%] rounded-full blur-[100px] pointer-events-none"
                style={{ backgroundColor: 'var(--color-accent-glow)', opacity: 0.3 }}
            />

            {/* Sub-Header */}
            <div className={`backdrop-blur-xl border-b ${compact ? 'px-6 lg:px-8 py-4 lg:py-6' : 'px-6 lg:px-12 py-6 lg:py-10'} relative z-10 w-full shadow-lg transition-all`}
                style={{
                    backgroundColor: 'var(--color-bg-header)',
                    borderColor: 'var(--color-border)'
                }}
            >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 max-w-[2000px] mx-auto w-full">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-black tracking-[0.2em] mb-2"
                            style={{ color: 'var(--color-accent)' }}
                        >
                            <span>{t('department.productionUnit')}</span>
                            <ChevronRight size={14} />
                            <span style={{ color: 'var(--color-text-dim)' }}>{t('department.operativeControl')}</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <h1 className={`${compact ? 'text-4xl' : 'text-6xl'} font-black tracking-tight font-sans transition-all`}
                                style={{ color: 'var(--color-text-main)' }}
                            >{data.name}</h1>
                            <div className="flex items-center gap-3 px-4 py-2 rounded-lg group transition-all shadow-inner focus-within:ring-2 focus-within:ring-opacity-50"
                                style={{
                                    backgroundColor: 'var(--color-field-bg)',
                                    borderColor: 'var(--color-border)',
                                    borderWidth: '1px'
                                }}
                            >
                                <User size={18} className="transition-colors" style={{ color: 'var(--color-text-dim)' }} />
                                <input
                                    value={verantwortlicher}
                                    onChange={(e) => setVerantwortlicher(e.target.value)}
                                    className="bg-transparent border-none text-base font-bold outline-none min-w-[200px] w-auto placeholder-slate-500 focus:outline-none focus:ring-0"
                                    style={{ color: 'var(--color-text-main)' }}
                                    placeholder={t('department.responsible')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Quick Metrics */}
                    <div className="flex flex-wrap gap-4 lg:gap-6">
                        <div className="px-6 lg:px-8 py-3 lg:py-4 rounded-xl shadow-lg text-center relative overflow-hidden group border flex-1 min-w-[120px]"
                            style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border)'
                            }}
                        >
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                style={{ backgroundColor: 'var(--color-accent-glow)' }}
                            />
                            <div className="text-[10px] uppercase font-black tracking-[0.2em] mb-1 relative z-10"
                                style={{ color: 'var(--color-accent)' }}
                            >
                                {t('department.stats.currentKw')}
                            </div>
                            <div className="flex items-center justify-center gap-3 mt-1 lg:mt-2 relative z-10">
                                <span className="text-3xl lg:text-4xl font-mono font-black transition-colors"
                                    style={{
                                        color: 'var(--color-text-main)',
                                        textShadow: '0 0 15px var(--color-accent-glow)'
                                    }}
                                >
                                    {currentKw}
                                </span>
                            </div>
                        </div>
                        <div className="px-6 lg:px-8 py-3 lg:py-4 rounded-xl shadow-lg text-center min-w-[120px] flex-1 border"
                            style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border)'
                            }}
                        >
                            <div className="text-[10px] uppercase font-black tracking-[0.2em] mb-1"
                                style={{ color: 'var(--color-text-dim)' }}
                            >{t('department.efficiency')}</div>
                            <span className={`text-2xl lg:text-3xl font-mono font-black block leading-tight ${data.stats.erfüllungsquote >= settings.thresholds.efficiencyTarget ? 'text-emerald-500' : data.stats.erfüllungsquote >= settings.thresholds.efficiencyTarget * 0.85 ? 'text-amber-500' : 'text-rose-500'}`}>{data.stats.erfüllungsquote}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className={`${compact ? 'px-8 mt-6' : 'px-12 mt-10'} max-w-[2000px] w-full mx-auto relative z-10 transition-all`}>
                <div className="flex gap-2 p-2 rounded-2xl w-fit border shadow-lg"
                    style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderColor: 'var(--color-border)'
                    }}
                >
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 ${activeTab === tab.id
                                ? 'text-white shadow-lg transform scale-[1.02]'
                                : 'hover:bg-black/5'
                                }`}
                            style={{
                                backgroundColor: activeTab === tab.id ? 'var(--color-accent)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--color-bg-sidebar)' : 'var(--color-text-dim)'
                            }}
                        >
                            {React.cloneElement(tab.icon as React.ReactElement<any>, { size: 20 })}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className={`flex-1 ${compact ? 'px-4 lg:px-8 pt-4 pb-8' : 'px-6 lg:px-12 pt-6 lg:pt-8 pb-10 lg:pb-16'} overflow-y-auto overflow-x-hidden custom-scrollbar relative z-10 transition-all`}>
                <div className="max-w-[2000px] w-full mx-auto h-full flex flex-col">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 15, scale: 0.99 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="flex-1 flex flex-col h-full overflow-hidden"
                        >
                            <div className="panel flex flex-col flex-1 overflow-hidden shadow-lg h-full">
                                <div className={`panel-header glass-header sticky top-0 z-10 ${compact ? 'p-4' : 'p-8'} flex items-center justify-between transition-all`}
                                    style={{
                                        backgroundColor: 'var(--color-bg-header)',
                                        borderColor: 'var(--color-border)'
                                    }}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border"
                                            style={{
                                                backgroundColor: 'var(--color-field-bg)',
                                                borderColor: 'var(--color-border)',
                                                color: 'var(--color-field-text)'
                                            }}
                                        >
                                            {React.cloneElement(tabs.find(t => t.id === activeTab)?.icon as React.ReactElement<any>, { size: 24 })}
                                        </div>
                                        <h3 className="text-base font-black uppercase tracking-[0.2em]"
                                            style={{ color: 'var(--color-text-main)' }}
                                        >
                                            {activeTab === 'Journal' ? t('department.titles.Journal') :
                                                activeTab === 'Plan' ? t('department.titles.Plan') :
                                                    t(`department.titles.${activeTab}`)}
                                        </h3>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="relative group">
                                            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--color-text-dim)' }} />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder={t('department.filter')}
                                                className="rounded-xl pl-12 pr-6 py-2.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-opacity-20 w-80 transition-all border shadow-inner"
                                                style={{
                                                    backgroundColor: 'var(--color-field-bg)',
                                                    borderColor: 'var(--color-border)',
                                                    color: 'var(--color-field-text)',
                                                    '--tw-ring-color': 'var(--color-accent)'
                                                } as any}
                                            />
                                        </div>
                                        <button
                                            onClick={exportToPDF}
                                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 border"
                                            style={{
                                                backgroundColor: 'var(--color-field-bg)',
                                                borderColor: 'var(--color-border)',
                                                color: 'var(--color-text-main)'
                                            }}
                                        >
                                            <Download size={20} />
                                            {t('department.export')}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 min-h-0 flex flex-col">
                                    {activeTab === 'Plan' ? (
                                        <MatrixView
                                            tasks={sortedPlanningTasks} // Use sorted tasks here
                                            onAddTask={handleAddTask}
                                            onUpdateTask={handleUpdatePlanningTask}
                                            onDeleteTask={(id) => setLocalPlanningTasks(prev => prev.filter(t => t.id !== id))}
                                            onToggleWeek={handleToggleWeek}
                                            currentKw={currentKw}
                                        />
                                    ) : activeTab === 'Journal' || activeTab === 'Archiv' ? (
                                        <JournalTable
                                            tasks={localTasks
                                                .filter(t => (activeTab === 'Archiv' ? t.status === 'Done' : t.status !== 'Done'))
                                                .filter(t => {
                                                    if (!searchQuery) return true;
                                                    const q = searchQuery.toLowerCase();
                                                    return t.title.toLowerCase().includes(q) ||
                                                        t.anlage.toLowerCase().includes(q) ||
                                                        t.id.toLowerCase().includes(q);
                                                })
                                                .sort((a, b) => {
                                                    // Calculate delay priority
                                                    const delayA = currentKw - a.kw;
                                                    const delayB = currentKw - b.kw;

                                                    // Sort by delay (descending) - most delayed first
                                                    if (delayB !== delayA) return delayB - delayA;

                                                    // Then by Year (desc) then KW (desc)
                                                    if (b.year !== a.year) return b.year - a.year;
                                                    return b.kw - a.kw;
                                                })
                                            }
                                            getStatusInfo={getStatusInfo}
                                            onAbschliessen={handleAbschliessen}
                                        />
                                    ) : activeTab === 'Statistik' ? (
                                        <StatisticsView localTasks={localTasks} settings={settings} />
                                    ) : activeTab === 'Anlagen' ? (
                                        <AnlagenView tasks={localTasks} planningTasks={localPlanningTasks} settings={settings} />
                                    ) : (
                                        <div className="p-12 text-center text-slate-500 font-mono text-sm uppercase tracking-widest">
                                            {t('department.loading', { tab: activeTab })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Aligned Bottom Instructions */}
                            <div className="mt-auto pt-6 border-t border-white/5 w-full">
                                {activeTab === 'Plan' ? (
                                    <InstructionCard
                                        title={t('department.instructions.planTitle')}
                                        items={[
                                            t('department.instructions.plan1'),
                                            t('department.instructions.plan2'),
                                            t('department.instructions.plan3'),
                                            t('department.instructions.plan4')
                                        ]}
                                    />
                                ) : activeTab === 'Journal' ? (
                                    <InstructionCard
                                        title={t('department.instructions.journalTitle')}
                                        items={[
                                            t('department.instructions.journal1')
                                                .replace('1-3W', `1-${settings.thresholds.criticalWeeks - 1}W`)
                                                .replace('>3W', `≥${settings.thresholds.criticalWeeks}W`),
                                            t('department.instructions.journal2'),
                                            t('department.instructions.journal3'),
                                            t('department.instructions.journal4')
                                        ]}
                                    />
                                ) : null}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div >
    );
};

// --- Sub-Components ---

const MatrixView = ({ tasks, onAddTask, onUpdateTask, onDeleteTask, onToggleWeek, currentKw }: {
    tasks: PlanningTask[],
    onAddTask: (t: string, a: string, w: string, f: string, kw: number) => void,
    onUpdateTask: (id: string, updates: Partial<PlanningTask>) => void,
    onDeleteTask: (id: string) => void,
    onToggleWeek: (id: string, kw: number) => void,
    currentKw: number
}) => {
    const { t } = useTranslation();
    const [newTitle, setNewTitle] = useState('');
    const [newAnlage, setNewAnlage] = useState('');
    const [newWer, setNewWer] = useState('MA');
    const [newFreq, setNewFreq] = useState('Wöchentlich');
    const [newAbKw, setNewAbKw] = useState(1);

    const handleAdd = () => {
        if (!newTitle || !newAnlage) return;
        onAddTask(newTitle, newAnlage, newWer, newFreq, newAbKw);
        setNewTitle('');
        setNewAnlage('');
    };

    return (
        <div className="p-0 overflow-auto flex-1 custom-scrollbar shadow-xl border rounded-b-xl"
            style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border)'
            }}
        >
            <table className="w-full border-collapse"
                style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
                <thead>
                    <tr className="border-b-2" style={{ backgroundColor: 'var(--color-bg-header)', borderColor: 'var(--color-border)' }}>
                        <th className="p-4 text-left text-[11px] font-black uppercase tracking-widest sticky left-0 z-20 shadow-[2px_0_10px_rgba(0,0,0,0.1)] w-[280px]"
                            style={{ backgroundColor: 'var(--color-bg-header)', color: 'var(--color-text-dim)' }}
                        >{t('department.matrix.taskMachine')}</th>
                        <th className="p-4 text-center text-[11px] font-black uppercase tracking-widest border-l w-[60px]"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
                        >{t('department.matrix.who')}</th>
                        <th className="p-4 text-center text-[11px] font-black uppercase tracking-widest border-l w-[110px]"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
                        >{t('department.matrix.freq')}</th>
                        <th className="p-4 text-center text-[11px] font-black uppercase tracking-widest border-l-2" colSpan={2}
                            style={{ width: '80px', borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
                        >{t('department.matrix.start')}</th>
                        {Array.from({ length: 52 }, (_, i) => (
                            <th key={`kw-head-${i + 1}`} className={`p-0 text-center text-[9px] font-mono font-bold border-l w-[24px] transition-all duration-500 relative ${i + 1 === currentKw ? 'text-white' : ''}`}
                                style={{
                                    borderColor: 'var(--color-border)',
                                    backgroundColor: i + 1 === currentKw ? 'var(--color-accent)' : 'transparent',
                                    color: i + 1 === currentKw ? 'var(--color-bg-sidebar)' : 'var(--color-text-dim)'
                                }}
                            >
                                {i + 1}
                                {i + 1 === currentKw && <div className="absolute top-0 left-0 right-0 h-0.5 bg-white opacity-50" />}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {tasks.map(task => (
                        <tr key={task.id} className="hover:bg-black/5 group transition-colors">
                            <td className="p-4 border-r sticky left-0 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.1)] transition-colors"
                                style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
                            >
                                <div className="flex items-center gap-4">
                                    <button onClick={() => onDeleteTask(task.id)} className="transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-orange-500/10" style={{ color: 'var(--color-text-dim)' }} title="Aufgabe löschen">
                                        <Tools size={16} />
                                    </button>
                                    <div>
                                        <div className="text-sm font-bold leading-tight" style={{ color: 'var(--color-text-main)' }}>{task.title}</div>
                                        <div className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: 'var(--color-accent)' }}>{task.anlage}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-1 border-r" style={{ borderColor: 'var(--color-border)' }}>
                                <select
                                    value={task.wer}
                                    onChange={(e) => onUpdateTask(task.id, { wer: e.target.value })}
                                    className="w-full bg-transparent text-center text-xs font-black outline-none cursor-pointer hover:bg-black/5 py-2 rounded"
                                    style={{ color: 'var(--color-text-dim)' }}
                                >
                                    <option value="MA" style={{ backgroundColor: 'var(--color-bg-card)' }}>MA</option>
                                    <option value="U" style={{ backgroundColor: 'var(--color-bg-card)' }}>U</option>
                                    <option value="EX" style={{ backgroundColor: 'var(--color-bg-card)' }}>EX</option>
                                </select>
                            </td>
                            <td className="p-1 border-r" style={{ borderColor: 'var(--color-border)' }}>
                                <select
                                    value={task.frequenz}
                                    onChange={(e) => onUpdateTask(task.id, { frequenz: e.target.value })}
                                    className="w-full bg-transparent text-center text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-black/5 py-2 rounded leading-tight"
                                    style={{ color: 'var(--color-text-dim)' }}
                                >
                                    <option value="Täglich" style={{ backgroundColor: 'var(--color-bg-card)' }}>{t('department.matrix.freqs.daily') || 'Täglich'}</option>
                                    <option value="Wöchentlich" style={{ backgroundColor: 'var(--color-bg-card)' }}>{t('department.matrix.freqs.weekly') || 'Wöchentlich'}</option>
                                    <option value="Alle 2 Wochen" style={{ backgroundColor: 'var(--color-bg-card)' }}>{t('department.matrix.freqs.biweekly') || 'Alle 2 Wochen'}</option>
                                    <option value="Monatlich" style={{ backgroundColor: 'var(--color-bg-card)' }}>{t('department.matrix.freqs.monthly') || 'Monatlich'}</option>
                                    <option value="Vierteljährlich" style={{ backgroundColor: 'var(--color-bg-card)' }}>{t('department.matrix.freqs.quarterly') || 'Vierteljährlich'}</option>
                                    <option value="Halbjährlich" style={{ backgroundColor: 'var(--color-bg-card)' }}>{t('department.matrix.freqs.semi-annually') || 'Halbjährlich'}</option>
                                    <option value="Jährlich" style={{ backgroundColor: 'var(--color-bg-card)' }}>{t('department.matrix.freqs.annually') || 'Jährlich'}</option>
                                </select>
                            </td>
                            <td className="px-1 border-r text-center text-xs font-mono font-bold"
                                style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}
                            >KW</td>
                            <td className="px-1 border-r-2 text-center text-xs font-mono font-bold"
                                style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}
                            >
                                <input
                                    type="number"
                                    min={1}
                                    max={52}
                                    value={task.abKw || 1}
                                    onChange={(e) => onUpdateTask(task.id, { abKw: parseInt(e.target.value) || 1 })}
                                    className="w-10 bg-transparent text-center outline-none border-b border-transparent focus:border-amber-500 transition-colors"
                                />
                            </td>
                            {Array.from({ length: 52 }, (_, i) => {
                                const kw = i + 1;
                                return (
                                    <td key={`kw-${task.id}-${kw}`} className={`p-0 border-r border-slate-800/50 text-center relative group/cell ${kw === currentKw ? 'bg-white/[0.02]' : ''}`}>
                                        <div
                                            onClick={() => onToggleWeek(task.id, kw)}
                                            className={`mx-auto w-Full h-8 flex items-center justify-center cursor-pointer transition-colors ${isTaskPlanned(task, kw) ? 'bg-amber-600/20 text-amber-500 hover:bg-amber-600/40' : 'hover:bg-amber-500/5 text-transparent'}`}
                                        >
                                            <span className="text-[10px] font-black">x</span>
                                        </div>
                                        {kw === currentKw && <div className="absolute inset-y-0 left-0 w-px bg-amber-500/10 pointer-events-none" />}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    {/* Expanded Add Task Form Row */}
                    <tr className="border-t-2" style={{ backgroundColor: 'var(--color-bg-header)', borderColor: 'var(--color-border)' }}>
                        <td className="p-4 border-r sticky left-0 z-10 shadow-[2px_0_10px_rgba(245,158,11,0.05)]"
                            style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
                        >
                            <div className="space-y-3">
                                <input
                                    placeholder={t('department.matrix.machine')}
                                    value={newAnlage}
                                    onChange={(e) => setNewAnlage(e.target.value)}
                                    className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all font-medium shadow-inner border"
                                    style={{
                                        backgroundColor: 'var(--color-field-bg)',
                                        borderColor: 'var(--color-border)',
                                        color: 'var(--color-field-text)',
                                        '--tw-ring-color': 'var(--color-accent)'
                                    } as any}
                                />
                                <input
                                    placeholder={t('department.matrix.task')}
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all font-medium shadow-inner border"
                                    style={{
                                        backgroundColor: 'var(--color-field-bg)',
                                        borderColor: 'var(--color-border)',
                                        color: 'var(--color-field-text)',
                                        '--tw-ring-color': 'var(--color-accent)'
                                    } as any}
                                />
                            </div>
                        </td>
                        <td className="p-4 border-r" style={{ borderColor: 'var(--color-border)' }}>
                            <select
                                value={newWer}
                                onChange={(e) => setNewWer(e.target.value)}
                                className="w-full rounded-lg px-3 py-3 text-xs uppercase font-bold outline-none cursor-pointer border"
                                style={{
                                    backgroundColor: 'var(--color-field-bg)',
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-field-text)'
                                }}
                            >
                                <option value="MA" style={{ backgroundColor: 'var(--color-bg-card)' }}>MA</option>
                                <option value="U" style={{ backgroundColor: 'var(--color-bg-card)' }}>U</option>
                                <option value="EX" style={{ backgroundColor: 'var(--color-bg-card)' }}>EX</option>
                            </select>
                        </td>
                        <td className="p-4 border-r" style={{ borderColor: 'var(--color-border)' }}>
                            <select
                                value={newFreq}
                                onChange={(e) => setNewFreq(e.target.value)}
                                className="w-full rounded-lg px-3 py-3 text-xs uppercase font-bold outline-none cursor-pointer border"
                                style={{
                                    backgroundColor: 'var(--color-field-bg)',
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-field-text)'
                                }}
                            >
                                <option value="Täglich" style={{ backgroundColor: 'var(--color-bg-card)' }}>Täglich</option>
                                <option value="Wöchentlich" style={{ backgroundColor: 'var(--color-bg-card)' }}>Wöchentlich</option>
                                <option value="Alle 2 Wochen" style={{ backgroundColor: 'var(--color-bg-card)' }}>Alle 2 Wochen</option>
                                <option value="Monatlich" style={{ backgroundColor: 'var(--color-bg-card)' }}>Monatlich</option>
                                <option value="Vierteljährlich" style={{ backgroundColor: 'var(--color-bg-card)' }}>Vierteljährlich</option>
                                <option value="Halbjährlich" style={{ backgroundColor: 'var(--color-bg-card)' }}>Halbjährlich</option>
                                <option value="Jährlich" style={{ backgroundColor: 'var(--color-bg-card)' }}>Jährlich</option>
                            </select>
                        </td>
                        <td colSpan={2} className="px-5">
                            <input
                                type="number"
                                min={1}
                                max={52}
                                value={newAbKw}
                                onChange={(e) => setNewAbKw(parseInt(e.target.value))}
                                className="w-20 rounded-lg px-3 py-3 text-sm font-mono font-bold outline-none shadow-inner border"
                                style={{
                                    backgroundColor: 'var(--color-field-bg)',
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-text-main)'
                                }}
                            />
                        </td>
                        <td colSpan={50} className="px-8 flex-1">
                            <button
                                onClick={handleAdd}
                                className="flex items-center justify-center w-[80%] max-w-[400px] ml-auto gap-3 px-6 py-4 rounded-xl text-sm font-bold uppercase shadow-lg transition-all duration-300 active:scale-95"
                                style={{
                                    backgroundColor: 'var(--color-accent)',
                                    color: 'var(--color-bg-sidebar)',
                                    boxShadow: '0 10px 15px -3px var(--color-accent-glow)'
                                }}
                            >
                                <Plus size={20} /> {t('department.matrix.add')}
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

const JournalTable = ({ tasks, getStatusInfo, onAbschliessen }: {
    tasks: Task[],
    getStatusInfo: (t: Task) => any,
    onAbschliessen: (id: string) => void
}) => {
    const { t } = useTranslation();
    return (
        <div className="rounded-2xl shadow-xl overflow-y-auto flex-1 custom-scrollbar border"
            style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border)'
            }}
        >
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--color-bg-header)' }}>
                    <tr className="text-xs uppercase font-black tracking-[0.2em] border-b"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
                    >
                        <th className="py-6 pl-12">{t('department.journal.task')}</th>
                        <th className="py-6">{t('department.journal.machine')}</th>
                        <th className="py-6">{t('department.matrix.who')}</th>
                        <th className="py-6">{t('department.journal.dateReal')}</th>
                        <th className="py-6">{t('department.journal.visa')}</th>
                        <th className="py-6">{t('department.journal.status')}</th>
                        <th className="py-6 pr-10 text-right">{t('department.journal.action')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {tasks.map(task => {
                        const status = getStatusInfo(task);
                        return (
                            <tr key={task.id} className="hover:bg-black/5 group transition-colors">
                                <td className="py-6 pl-12">
                                    <div className="text-base font-bold" style={{ color: 'var(--color-text-main)' }}>{task.title}</div>
                                    <div className="text-xs font-black tracking-wider uppercase mt-1"
                                        style={{ color: 'var(--color-text-dim)' }}
                                    >KW {task.kw} / {task.year}</div>
                                </td>
                                <td className="py-6">
                                    <span className="text-sm font-medium px-3 py-1.5 rounded-md border"
                                        style={{
                                            backgroundColor: 'var(--color-field-bg)',
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-field-text)'
                                        }}
                                    >{task.anlage}</span>
                                </td>
                                <td className="py-6">
                                    <span className="text-sm font-black px-2 py-1 rounded border"
                                        style={{
                                            backgroundColor: 'var(--color-field-bg)',
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-field-text)'
                                        }}
                                    >{task.wer || 'MA'}</span>
                                </td>
                                <td className="py-6">
                                    <input
                                        type="date"
                                        defaultValue={task.datum}
                                        className="rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-opacity-20 transition-all outline-none font-medium shadow-inner w-44 border"
                                        style={{
                                            backgroundColor: 'var(--color-field-bg)',
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-field-text)',
                                            '--tw-ring-color': 'var(--color-accent)'
                                        } as any}
                                    />
                                </td>
                                <td className="py-6">
                                    <input
                                        placeholder={t('department.journal.visa')}
                                        defaultValue={task.visum}
                                        className="rounded-lg px-4 py-2.5 text-sm w-28 focus:ring-2 focus:ring-opacity-20 transition-all outline-none font-bold uppercase shadow-inner border"
                                        style={{
                                            backgroundColor: 'var(--color-field-bg)',
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-field-text)',
                                            '--tw-ring-color': 'var(--color-accent)'
                                        } as any}
                                    />
                                </td>
                                <td className="py-6">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${status.bg} shadow-[0_0_8px_currentColor] border border-transparent`} />
                                            <span className={`text-xs font-black uppercase tracking-widest ${status.color}`}>{status.label}</span>
                                        </div>
                                        {task.status === 'Done' && (
                                            <div className={`text-[10px] font-black px-2 py-0.5 rounded border inline-flex self-start uppercase tracking-wider ${task.isLate ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                                {task.isLate ? t('department.journal.lateWeeks', { weeks: task.delayWeeks || '?' }) : t('department.journal.onTime')}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="py-6 pr-10 text-right">
                                    {task.status !== 'Done' && (
                                        <button
                                            onClick={() => onAbschliessen(task.id)}
                                            className="px-6 py-3 rounded-xl text-xs font-black text-white uppercase tracking-wider shadow-lg transition-all hover:scale-105 active:scale-95"
                                            style={{
                                                backgroundColor: 'var(--color-success)',
                                                color: 'white',
                                                boxShadow: '0 10px 15px -3px var(--color-success-glow)'
                                            }}
                                        >
                                            {t('department.journal.complete')}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    )
};

const StatisticsView = ({ localTasks, settings }: { localTasks: Task[], settings: AppSettings }) => {
    const { t } = useTranslation();
    const [timeFilter, setTimeFilter] = useState<'Letzte Woche' | 'Letzter Monat' | 'Dieses Jahr' | 'Alle'>('Alle');
    const [selectedMetric, setSelectedMetric] = useState<'Done' | 'Pending' | 'Late' | null>(null);

    // Baseline for current date
    const CURRENT_KW = APP_CONFIG.CURRENT_KW;
    const year = APP_CONFIG.CURRENT_YEAR;

    const filteredTasks = localTasks.filter(task => {
        let startKw = 1;
        let endKw = 52;

        if (timeFilter === t('department.stats.filters.lastWeek')) {
            startKw = CURRENT_KW - 1;
            endKw = CURRENT_KW;
        } else if (timeFilter === t('department.stats.filters.lastMonth')) {
            startKw = CURRENT_KW - 4;
            endKw = CURRENT_KW;
        } else if (timeFilter === t('department.stats.filters.thisYear')) {
            startKw = 1;
            endKw = CURRENT_KW; // Only up to now for "Progress"
        } else if (timeFilter === t('department.stats.filters.all')) {
            return true;
        }

        const taskItem = task as any;
        const pKw = taskItem.plannedKw || taskItem.kw;
        const pYear = taskItem.plannedYear || taskItem.year;
        const dKw = taskItem.doneKw;
        const dYear = taskItem.doneYear;

        // If it was DONE: Did it finish in the target range?
        if (taskItem.status === 'Done' && dKw !== null) {
            return dYear === year && dKw >= startKw && dKw <= endKw;
        }

        // If it is NOT done (Open/Late): Was it planned for this range?
        return pYear === year && pKw >= startKw && pKw <= endKw;
    });

    const erledigtTasks = filteredTasks.filter(t => t.status === 'Done');
    const pendingTasks = filteredTasks.filter(t => t.status !== 'Done' && t.status !== 'Late');
    const lateTasks = localTasks.filter(t => t.status === 'Late');

    const totalErledigt = erledigtTasks.length;
    const totalOffen = pendingTasks.length + lateTasks.length;
    const quote = Math.round((totalErledigt / (totalErledigt + totalOffen)) * 100) || 0;

    const getModalConfig = () => {
        switch (selectedMetric) {
            case 'Done':
                return {
                    title: t('department.stats.executed'),
                    tasks: erledigtTasks,
                    color: 'text-emerald-500',
                    icon: <CheckCircle2 size={32} />,
                    itemBg: 'bg-emerald-500/5',
                    itemBorder: 'border-emerald-500/20'
                };
            case 'Pending':
                return {
                    title: t('department.stats.open'),
                    tasks: pendingTasks,
                    color: 'text-amber-500',
                    icon: <Clock size={32} />,
                    itemBg: 'bg-amber-500/5',
                    itemBorder: 'border-amber-500/20'
                };
            case 'Late':
                return {
                    title: t('department.stats.late'),
                    tasks: lateTasks,
                    color: 'text-rose-500',
                    icon: <AlertTriangle size={32} />,
                    itemBg: 'bg-rose-500/5',
                    itemBorder: 'border-rose-500/20'
                };
            default:
                return null;
        }
    };

    const modalConfig = getModalConfig();

    const statsTarget = settings.thresholds.efficiencyTarget;
    const isStatsMeetingTarget = quote >= statsTarget;
    const isStatsNearTarget = quote >= statsTarget * 0.85;

    const statsColor = isStatsMeetingTarget ? 'text-emerald-400' : isStatsNearTarget ? 'text-amber-400' : 'text-rose-400';
    const statsBg = isStatsMeetingTarget ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : isStatsNearTarget ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'bg-rose-500/5 hover:bg-rose-500/10';
    const statsBorder = isStatsMeetingTarget ? 'border-emerald-500/20' : isStatsNearTarget ? 'border-amber-500/20' : 'border-rose-500/20';

    return (
        <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start rounded-2xl shadow-xl border relative overflow-hidden"
            style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border)'
            }}
        >

            <AnimatePresence>
                {selectedMetric && modalConfig && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 z-50 backdrop-blur-3xl p-12 flex flex-col border rounded-[2rem] shadow-2xl"
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            borderColor: 'var(--color-border)'
                        }}
                    >
                        <div className="flex justify-between items-center mb-10 border-b pb-6"
                            style={{ borderColor: 'var(--color-border)' }}
                        >
                            <h3 className={`text-3xl font-black ${modalConfig.color} tracking-tight flex items-center gap-4`}>
                                {modalConfig.icon}
                                {modalConfig.title} ({modalConfig.tasks.length})
                            </h3>
                            <button onClick={() => setSelectedMetric(null)} className="p-3 hover:bg-black/5 rounded-xl transition-all active:scale-95 group">
                                <X size={28} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                            <div className="space-y-3">
                                {modalConfig.tasks.map(task => (
                                    <div key={task.id} className={`p-4 rounded-xl border ${modalConfig.itemBorder} ${modalConfig.itemBg} flex justify-between items-center hover:opacity-80 transition-all`}>
                                        <div>
                                            <div className="font-bold" style={{ color: 'var(--color-text-main)' }}>{task.title}</div>
                                            <div className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">{task.anlage} • Verantw.: {task.wer}</div>
                                        </div>
                                        <div className="text-right">
                                            {selectedMetric === 'Late' ? (
                                                <>
                                                    <div className="text-xl font-mono font-black text-rose-500">{CURRENT_KW - task.kw}W</div>
                                                    <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-1">{t('department.stats.delay')}</div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-xl font-mono font-black text-slate-400">KW {task.kw}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('pdf.planned')}</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {modalConfig.tasks.length === 0 && (
                                    <div className="text-center text-slate-500 font-bold py-10">{t('department.stats.noLateTasks')}</div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-12 h-full flex flex-col justify-center">
                <div className="grid grid-cols-2 gap-8">
                    <MetricBox
                        label={t('department.stats.executed')}
                        value={totalErledigt}
                        color="text-emerald-400"
                        icon={<CheckCircle2 size={32} />}
                        bg="bg-emerald-500/5 cursor-pointer shadow-[0_0_40px_rgba(16,185,129,0.05)]"
                        border="border-emerald-500/20"
                        iconColor="text-emerald-400"
                        onClick={() => setSelectedMetric('Done')}
                    />
                    <MetricBox
                        label={t('department.stats.open')}
                        value={totalOffen - lateTasks.length}
                        color="text-amber-400"
                        icon={<Clock size={32} />}
                        bg="bg-amber-500/5 cursor-pointer shadow-[0_0_40px_rgba(245,158,11,0.05)]"
                        border="border-amber-500/20"
                        iconColor="text-amber-400"
                        onClick={() => setSelectedMetric('Pending')}
                    />
                    <MetricBox
                        label={t('department.stats.late')}
                        value={lateTasks.length}
                        color="text-rose-400"
                        icon={<AlertTriangle size={32} />}
                        bg="bg-rose-500/5 cursor-pointer shadow-[0_0_40px_rgba(244,63,94,0.1)]"
                        border="border-rose-500/30"
                        iconColor="text-rose-400"
                        onClick={() => setSelectedMetric('Late')}
                    />
                    <MetricBox label={t('department.stats.rate')} value={`${quote}%`} color={statsColor} icon={<Activity size={32} />} bg={statsBg} border={statsBorder} iconColor={statsColor} />
                </div>
                <div className="p-8 rounded-[2rem] border shadow-inner space-y-8"
                    style={{
                        backgroundColor: 'var(--color-bg-header)',
                        borderColor: 'var(--color-border)'
                    }}
                >
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-5">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.2em]"
                                style={{ color: 'var(--color-text-dim)' }}
                            >{t('department.stats.progress')}</h4>
                            <div className="flex items-center gap-3 px-4 py-2 rounded-xl border shadow-sm transition-all focus-within:ring-2 focus-within:ring-opacity-20"
                                style={{
                                    backgroundColor: 'var(--color-bg-card)',
                                    borderColor: 'var(--color-border)',
                                    '--tw-ring-color': 'var(--color-accent)'
                                } as any}
                            >
                                <Filter size={16} style={{ color: 'var(--color-text-dim)' }} />
                                <select
                                    className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                                    value={timeFilter}
                                    onChange={(e) => setTimeFilter(e.target.value as any)}
                                    style={{ color: 'var(--color-text-main)' }}
                                >
                                    <option value="Alle" style={{ backgroundColor: 'var(--color-field-bg)' }}>{t('department.stats.filters.all')}</option>
                                    <option value="Dieses Jahr" style={{ backgroundColor: 'var(--color-field-bg)' }}>{t('department.stats.filters.thisYear')}</option>
                                    <option value="Letzter Monat" style={{ backgroundColor: 'var(--color-field-bg)' }}>{t('department.stats.filters.lastMonth')}</option>
                                    <option value="Letzte Woche" style={{ backgroundColor: 'var(--color-field-bg)' }}>{t('department.stats.filters.lastWeek')}</option>
                                </select>
                            </div>
                        </div>
                        <span className="text-base font-mono font-bold" style={{ color: 'var(--color-text-main)' }}>{quote}%</span>
                    </div>
                    <div className="h-4 w-full rounded-full overflow-hidden shadow-inner" style={{ backgroundColor: 'var(--color-bg)' }}>
                        <div className="h-full transition-all duration-1000 ease-out"
                            style={{
                                width: `${quote}%`,
                                backgroundColor: 'var(--color-accent)',
                                boxShadow: '0 0 10px var(--color-accent-glow)'
                            }}
                        />
                    </div>
                </div>
            </div>
            <div className="h-[500px] flex items-center justify-center p-10 rounded-[2rem] border relative shadow-inner"
                style={{
                    backgroundColor: 'var(--color-bg-header)',
                    borderColor: 'var(--color-border)'
                }}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={[
                                { name: 'Erledigt', value: totalErledigt },
                                { name: 'Offen', value: totalOffen },
                            ]}
                            innerRadius={140}
                            outerRadius={180}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            <Cell fill="var(--color-accent)" />
                            <Cell fill="var(--color-bg)" />
                        </Pie>
                        <RechartsTooltip
                            contentStyle={{
                                background: 'var(--color-bg-header)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '16px',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
                                padding: '16px'
                            }}
                            itemStyle={{
                                fontWeight: '900',
                                color: 'var(--color-text-main)',
                                fontSize: '18px'
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center">
                    <div className="text-6xl font-mono font-black tracking-tighter"
                        style={{ color: 'var(--color-text-main)' }}
                    >{quote}%</div>
                    <div className="text-sm font-black uppercase tracking-widest mt-2"
                        style={{ color: 'var(--color-text-dim)' }}
                    >{t('department.stats.livePerf')}</div>
                </div>
            </div>
        </div>
    );
};

const MetricBox = ({ label, value, color, icon, bg, border, iconColor, onClick }: { label: string, value: any, color: string, icon: any, bg: string, border: string, iconColor: string, onClick?: () => void }) => (
    <div onClick={onClick} className={`p-8 ${bg} border ${border} rounded-[2rem] backdrop-blur-xl transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:-translate-y-1 group relative overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}>
        {/* Subtle decorative background icon */}
        <div className={`absolute -right-6 -top-10 ${iconColor} opacity-5 group-hover:opacity-10 scale-[6] group-hover:scale-[7] group-hover:-rotate-12 transition-all duration-1000 pointer-events-none`}>
            {icon}
        </div>
        <div className={`flex items-center gap-4 mb-8 text-[11px] font-black ${iconColor} uppercase tracking-[0.2em]`}>
            <div className="p-2 rounded-lg bg-white/5 border border-white/5 shadow-inner">
                {React.cloneElement(icon as React.ReactElement<any>, { size: 18 })}
            </div>
            {label}
        </div>
        <div className={`text-6xl font-mono font-black tracking-tight ${color} drop-shadow-[0_0_15px_rgba(255,255,255,0.05)] text-center lg:text-left`}>{value}</div>
    </div>
);

const InstructionCard = ({ title, items }: { title: string, items: string[] }) => (
    <div className="p-6 border shadow-xl rounded-2xl relative overflow-hidden group hover:shadow-2xl transition-all w-full"
        style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border)'
        }}
    >
        <div className="flex flex-col md:flex-row md:items-center gap-6">
            <h4 className="text-[13px] font-black uppercase tracking-widest flex items-center gap-3 min-w-[200px]"
                style={{ color: 'var(--color-accent)' }}
            >
                <Info size={18} />
                {title}
            </h4>
            <ul className="flex flex-wrap gap-x-8 gap-y-2">
                {items.map((item, idx) => (
                    <li key={idx} className="flex gap-2 text-[12px] font-bold transition-colors"
                        style={{ color: 'var(--color-text-dim)' }}
                    >
                        <span className="font-black" style={{ color: 'var(--color-accent)' }}>•</span>
                        <span className="leading-relaxed">{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

// --- AnlagenView Component ---
const AnlagenView = ({ tasks, planningTasks, settings }: { tasks: Task[], planningTasks: PlanningTask[], settings: AppSettings }) => {
    const { t } = useTranslation();
    const [selectedAnlage, setSelectedAnlage] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Generic/non-specific anlage names to filter out
    const GENERIC_NAMES = new Set(['System', 'Alle', 'Alle Strahlanlagen', 'N/A', '', 'Allgemeines System']);

    // Derive unique machines only from real journal/archive tasks
    const machineMap = React.useMemo(() => {
        const map: Record<string, { name: string; totalTasks: number; doneTasks: number; openTasks: number; lateTasks: number; lastService: string; nextTasks: string[] }> = {};
        const CURRENT_KW = 12;

        // Build machine list ONLY from tasks (not planningTasks) and skip generic names
        tasks.forEach(t => {
            const name = t.anlage;
            if (!name || GENERIC_NAMES.has(name.trim())) return;
            if (!map[name]) map[name] = { name, totalTasks: 0, doneTasks: 0, openTasks: 0, lateTasks: 0, lastService: '-', nextTasks: [] };

            map[name].totalTasks++;
            if (t.status === 'Done') {
                map[name].doneTasks++;
                // Track most recent service date
                if (t.datum && (map[name].lastService === '-' || t.datum > map[name].lastService)) {
                    map[name].lastService = t.datum;
                }
            } else {
                map[name].openTasks++;
                if (CURRENT_KW > t.kw) map[name].lateTasks++;
            }
        });

        // Populate nextTasks from planning tasks (by matching anlage name)
        planningTasks.forEach(t => {
            if (!t.anlage || GENERIC_NAMES.has(t.anlage.trim())) return;
            if (map[t.anlage] && !map[t.anlage].nextTasks.includes(t.title)) {
                map[t.anlage].nextTasks.push(t.title);
            }
        });

        return map;
    }, [tasks, planningTasks]);

    const machines = Object.values(machineMap).filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selected = selectedAnlage ? machineMap[selectedAnlage] : null;

    return (
        <div className="flex h-full overflow-hidden">
            {/* Machine List */}
            <div className="w-1/3 border-r overflow-y-auto custom-scrollbar"
                style={{ borderColor: 'var(--color-border)' }}
            >
                <div className="p-4 border-b sticky top-0 z-10"
                    style={{
                        backgroundColor: 'var(--color-bg-header)',
                        borderColor: 'var(--color-border)'
                    }}
                >
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors"
                            style={{ color: 'var(--color-text-dim)' }}
                        />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t('department.anlagen.searchPlaceholder')}
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-1 transition-all"
                            style={{
                                backgroundColor: 'var(--color-field-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-main)',
                                '--tw-ring-color': 'var(--color-accent)'
                            } as any}
                        />
                    </div>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {machines.length === 0 && (
                        <div className="text-center text-slate-500 py-10 font-mono text-sm">{t('department.anlagen.noResults')}</div>
                    )}
                    {machines.map(m => {
                        const rate = m.totalTasks > 0 ? Math.round((m.doneTasks / m.totalTasks) * 100) : 100;
                        const isSelected = selectedAnlage === m.name;
                        return (
                            <button
                                key={m.name}
                                onClick={() => setSelectedAnlage(isSelected ? null : m.name)}
                                className={`w-full text-left p-5 transition-all group hover:bg-black/5 ${isSelected ? 'border-l-4' : 'border-l-4 border-transparent'
                                    }`}
                                style={{
                                    backgroundColor: isSelected ? 'var(--color-accent-glow)' : 'transparent',
                                    borderLeftColor: isSelected ? 'var(--color-accent)' : 'transparent'
                                }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold truncate transition-colors"
                                            style={{ color: isSelected ? 'var(--color-accent)' : 'var(--color-text-main)' }}
                                        >{m.name}</div>
                                        <div className="flex gap-4 mt-2">
                                            <span className="text-xs font-bold text-emerald-500">{m.doneTasks} {t('department.anlagen.done')}</span>
                                            <span className="text-xs font-bold" style={{ color: 'var(--color-text-dim)' }}>{m.openTasks} {t('department.anlagen.open')}</span>
                                            {m.lateTasks > 0 && <span className="text-xs font-bold text-rose-500">{m.lateTasks} {t('department.anlagen.late')}</span>}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className={`text-lg font-mono font-black ${rate >= settings.thresholds.efficiencyTarget ? 'text-emerald-500' : rate >= settings.thresholds.efficiencyTarget * 0.7 ? 'text-amber-500' : 'text-rose-500'
                                            }`}>{rate}%</div>
                                        <div className="text-[10px] uppercase font-bold tracking-widest"
                                            style={{ color: 'var(--color-text-dim)' }}
                                        >{t('department.anlagen.performance')}</div>
                                    </div>
                                </div>
                                <div className="mt-3 h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}>
                                    <div
                                        className={`h-full transition-all duration-700 ${rate >= settings.thresholds.efficiencyTarget ? 'bg-emerald-500' : rate >= settings.thresholds.efficiencyTarget * 0.7 ? 'bg-amber-500' : 'bg-rose-500'
                                            }`}
                                        style={{ width: `${rate}%` }}
                                    />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Detail Panel */}
            <div className="flex-1 overflow-y-auto custom-scrollbar"
                style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
                {!selected ? (
                    <div className="flex h-full items-center justify-center flex-col gap-4" style={{ color: 'var(--color-text-dim)' }}>
                        <Tools size={48} className="opacity-30" />
                        <p className="font-bold uppercase tracking-widest text-sm">{t('department.anlagen.selectHint')}</p>
                    </div>
                ) : (
                    <div className="p-8 space-y-8">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-3xl font-black" style={{ color: 'var(--color-text-main)' }}>{selected.name}</h2>
                                <p className="text-sm font-bold uppercase tracking-widest mt-1"
                                    style={{ color: 'var(--color-accent)' }}
                                >{t('department.anlagen.systemLabel')}</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="px-5 py-3 rounded-xl text-center border shadow-sm"
                                    style={{
                                        backgroundColor: 'var(--color-field-bg)',
                                        borderColor: 'var(--color-border)'
                                    }}
                                >
                                    <div className="text-xs font-bold uppercase tracking-widest mb-1"
                                        style={{ color: 'var(--color-text-dim)' }}
                                    >{t('department.anlagen.lastService')}</div>
                                    <div className="text-base font-mono font-black"
                                        style={{ color: 'var(--color-text-main)' }}
                                    >{selected.lastService}</div>
                                </div>
                                <div className="px-5 py-3 rounded-xl text-center border shadow-sm"
                                    style={{
                                        backgroundColor: 'var(--color-field-bg)',
                                        borderColor: 'var(--color-border)'
                                    }}
                                >
                                    <div className="text-xs font-bold uppercase tracking-widest mb-1"
                                        style={{ color: 'var(--color-text-dim)' }}
                                    >{t('department.anlagen.totalTasks')}</div>
                                    <div className="text-base font-mono font-black"
                                        style={{ color: 'var(--color-text-main)' }}
                                    >{selected.totalTasks}</div>
                                </div>
                            </div>
                        </div>

                        {/* KPI boxes */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
                                <div className="text-3xl font-mono font-black text-emerald-400">{selected.doneTasks}</div>
                                <div className="text-xs text-emerald-500/80 font-bold uppercase tracking-widest mt-2">{t('department.anlagen.kpiDone')}</div>
                            </div>
                            <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center">
                                <div className="text-3xl font-mono font-black text-amber-400">{selected.openTasks}</div>
                                <div className="text-xs text-amber-500/80 font-bold uppercase tracking-widest mt-2">{t('department.anlagen.kpiOpen')}</div>
                            </div>
                            <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center">
                                <div className="text-3xl font-mono font-black text-rose-400">{selected.lateTasks}</div>
                                <div className="text-xs text-rose-500/80 font-bold uppercase tracking-widest mt-2">{t('department.anlagen.kpiLate')}</div>
                            </div>
                        </div>

                        {/* Planned tasks */}
                        {selected.nextTasks.length > 0 && (
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2"
                                    style={{ color: 'var(--color-text-dim)' }}
                                >
                                    <Calendar size={14} style={{ color: 'var(--color-accent)' }} />
                                    {t('department.anlagen.plannedTitle')}
                                </h4>
                                <div className="space-y-2">
                                    {selected.nextTasks.slice(0, 10).map((task, i) => (
                                        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm"
                                            style={{
                                                backgroundColor: 'var(--color-field-bg)',
                                                borderColor: 'var(--color-border)'
                                            }}
                                        >
                                            <div className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: 'var(--color-accent)' }}
                                            />
                                            <span className="text-sm font-medium"
                                                style={{ color: 'var(--color-text-main)' }}
                                            >{task}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Task History */}
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2"
                                style={{ color: 'var(--color-text-dim)' }}
                            >
                                <ClipboardList size={14} style={{ color: 'var(--color-accent)' }} />
                                {t('department.anlagen.historyTitle')}
                            </h4>
                            <div className="space-y-2">
                                {tasks.filter(t => t.anlage === selected.name).map(t => (
                                    <div key={t.id} className={`flex items-center gap-4 px-4 py-3 rounded-xl border shadow-sm ${t.status === 'Done'
                                        ? 'bg-emerald-500/5 border-emerald-500/20'
                                        : ''
                                        }`}
                                        style={{
                                            backgroundColor: t.status === 'Done' ? 'var(--color-bg)' : 'var(--color-field-bg)',
                                            borderColor: t.status === 'Done' ? 'rgba(16, 185, 129, 0.2)' : 'var(--color-border)'
                                        }}
                                    >
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'Done' ? 'bg-emerald-500' : ''
                                            }`}
                                            style={{ backgroundColor: t.status === 'Done' ? 'bg-emerald-500' : 'var(--color-accent)' }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold truncate"
                                                style={{ color: 'var(--color-text-main)' }}
                                            >{t.title}</div>
                                            <div className="text-xs font-mono mt-0.5"
                                                style={{ color: 'var(--color-text-dim)' }}
                                            >KW {t.kw} • {t.wer || 'MA'}</div>
                                        </div>
                                        <div className={`text-xs font-black uppercase tracking-widest ${t.status === 'Done' ? 'text-emerald-500' : ''
                                            }`}
                                            style={{ color: t.status === 'Done' ? 'text-emerald-500' : 'var(--color-accent)' }}
                                        >{t.status}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DepartmentView;
