import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, ShieldCheck, AlertTriangle, Cpu, TrendingUp, ArrowUpRight, Info, CheckCircle2, Download } from 'lucide-react';
import type { DepartmentData } from '../data/mockData';
import type { AppSettings } from '../types/settings';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_CONFIG } from '../config';

interface DashboardProps {
    onNavigate: (id: string, tab?: string) => void;
    departments: DepartmentData[];
    settings: AppSettings;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, departments, settings }) => {
    const { t } = useTranslation();
    const compact = settings.ui.compactMode;

    // Stats calculated from departments state with extreme robustness
    const safeSum = (arr: DepartmentData[], key: keyof DepartmentData['stats']) =>
        arr.reduce((acc, d) => {
            const val = Number(d.stats?.[key]);
            return acc + (isNaN(val) ? 0 : val);
        }, 0);

    const totalGeplant = safeSum(departments, 'geplant');
    const totalPuenktlich = safeSum(departments, 'erledigtPuenktlich');
    const totalVerspaetet = safeSum(departments, 'spaetErledigt');

    // Final defensive calculation for global efficiency
    const globalEfficiencyRaw = totalGeplant > 0 ? (totalPuenktlich / totalGeplant) * 100 : 0;
    const globalEfficiency = isNaN(globalEfficiencyRaw) ? 0 : Math.round(globalEfficiencyRaw);

    const CURRENT_KW = APP_CONFIG.CURRENT_KW;
    const target = settings.thresholds.efficiencyTarget;
    const isMeetingTarget = globalEfficiency >= target;
    const isNearTarget = globalEfficiency >= target * 0.85; // Within 15% range

    const efficiencyColor = isMeetingTarget ? 'text-emerald-400' : isNearTarget ? 'text-amber-400' : 'text-rose-500';
    const efficiencyAccent = isMeetingTarget ? 'text-emerald-500' : isNearTarget ? 'text-amber-500' : 'text-rose-600';
    const efficiencyBg = isMeetingTarget ? 'bg-emerald-500/10' : isNearTarget ? 'bg-amber-500/10' : 'bg-rose-500/10';

    const getCriticalTasksCount = (dept: DepartmentData) => {
        return dept.tasks.filter(t =>
            t.status !== 'Done' && (CURRENT_KW - t.kw) >= settings.thresholds.criticalWeeks
        ).length;
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.width;

        const drawHeader = (title: string, subtitle: string) => {
            doc.setFillColor(15, 23, 42); // slate-900
            doc.rect(0, 0, pageWidth, 45, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text(title, 15, 20);
            doc.setFontSize(10);
            doc.setTextColor(245, 158, 11); // amber-500
            doc.text(subtitle, 15, 30);
        };

        drawHeader(t('dashboard.centralStats'), `${t('pdf.reportTitle')} - KW ${CURRENT_KW} / ${new Date().getFullYear()}`);

        // KPI Section - 2x2 grid for portrait
        doc.setFillColor(30, 41, 59);
        doc.roundedRect(15, 50, pageWidth - 30, 45, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);

        // Efficiency & Pünktlich
        doc.setFontSize(9);
        doc.text(t('pdf.efficiency'), 25, 62);
        doc.setFontSize(18);
        doc.text(`${globalEfficiency}%`, 25, 75);

        doc.setFontSize(9);
        doc.text(t('pdf.onTime'), 110, 62);
        doc.setFontSize(18);
        doc.text(`${totalPuenktlich}`, 110, 75);

        // Verspätet & Abteilungen
        doc.setFontSize(9);
        doc.text(t('pdf.late'), 25, 82);
        doc.setFontSize(18);
        doc.text(`${totalVerspaetet}`, 25, 92);

        doc.setFontSize(9);
        doc.text(t('pdf.units'), 110, 82);
        doc.setFontSize(18);
        doc.text(`${departments.length}`, 110, 92);

        // Department Table
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(t('pdf.overview'), 15, 115);

        const headers = ['ID', t('pdf.dept'), t('pdf.planned'), t('pdf.ok'), t('pdf.lateShort'), t('pdf.rate'), t('pdf.crit')];
        const tableData = departments.map(d => [
            d.id,
            d.name,
            d.stats.geplant,
            d.stats.erledigtPuenktlich,
            d.stats.spaetErledigt,
            `${d.stats.erfüllungsquote}%`,
            getCriticalTasksCount(d)
        ]);

        autoTable(doc, {
            head: [headers],
            body: tableData as any,
            startY: 120,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 10 },
                1: { cellWidth: 50 },
                6: { fontStyle: 'bold', textColor: [225, 29, 72] }
            }
        });

        try {
            const timestamp = new Date().getTime();
            const filename = `CentralStats_KW${CURRENT_KW}_${timestamp}.pdf`;
            doc.save(filename);
            console.log('PDF export successful from Dashboard:', filename);
        } catch (error: any) {
            console.error('PDF EXPORT FATAL ERROR:', error);
            alert(`Error al exportar PDF: ${error.message || 'Error desconocido'}`);
        }
    };

    return (
        <div className={`h-full bg-transparent overflow-y-auto overflow-x-hidden custom-scrollbar relative font-sans ${compact ? 'px-4 lg:px-6 py-4' : 'px-6 lg:px-10 py-6'} transition-all duration-500`}>
            <div className="max-w-[2000px] mx-auto w-full">
                {/* Header Section */}
                <div className={`flex flex-col md:flex-row justify-between items-start md:items-center ${compact ? 'mb-2 p-3' : 'mb-6 p-4'} gap-4 rounded-3xl border backdrop-blur-md transition-all`}
                    style={{
                        backgroundColor: 'var(--color-bg-header)',
                        borderColor: 'var(--color-border)'
                    }}
                >
                    <div className="flex items-center gap-6">
                        <div className="p-4 rounded-2xl shadow-[0_0_20px_var(--color-accent-glow)]"
                            style={{ backgroundColor: 'var(--color-accent)' }}
                        >
                            <Activity size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className={`${compact ? 'text-2xl' : 'text-3xl'} font-black tracking-tight leading-none tech-font uppercase`}
                                style={{ color: 'var(--color-text-main)' }}
                            >{t('dashboard.centralStats')}</h1>
                            <p className="mt-1 font-bold uppercase tracking-[0.3em] text-[9px] opacity-70"
                                style={{ color: 'var(--color-text-dim)' }}
                            >{APP_CONFIG.BRAND_NAME} • {APP_CONFIG.SUBTITLE}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 px-6 py-3 rounded-xl border"
                            style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border)'
                            }}
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none"
                                style={{ color: 'var(--color-text-dim)' }}
                            >{t('dashboard.liveDataflow')}</span>
                        </div>
                        <div className="px-6 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest leading-none"
                            style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-accent)',
                                color: 'var(--color-accent)'
                            }}
                        >
                            {t('dashboard.period')}
                        </div>
                        <button
                            onClick={handleExportPDF}
                            className="flex items-center gap-3 px-6 py-3 text-white rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95"
                            style={{
                                backgroundColor: 'var(--color-accent)',
                                borderColor: 'var(--color-accent)',
                                boxShadow: '0 10px 15px -3px var(--color-accent-glow)'
                            }}
                        >
                            <Download size={16} />
                            {t('department.export')}
                        </button>
                    </div>
                </div>

                {/* KPI Overview */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-4 ${compact ? 'gap-3 mb-4' : 'gap-4 mb-8'} transition-all`}>
                    {[
                        {
                            label: t('department.efficiency'),
                            value: `${globalEfficiency}%`,
                            subValue: isMeetingTarget ? `✓ ${t('dashboard.targets.target')}` : isNearTarget ? `⚠ ${t('dashboard.targets.warn')}` : `✖ ${t('dashboard.targets.alert')}`,
                            color: efficiencyColor,
                            accent: efficiencyAccent,
                            bg: efficiencyBg,
                            icon: <TrendingUp size={compact ? 16 : 20} className={efficiencyAccent} />,
                            badge: <Activity className="text-slate-600 opacity-50" size={compact ? 14 : 16} />
                        },
                        {
                            label: t('dashboard.totalExecuted'),
                            value: totalPuenktlich,
                            subValue: null,
                            color: 'var(--color-text-main)',
                            accent: 'text-emerald-500',
                            bg: 'bg-emerald-500/10',
                            icon: <ShieldCheck size={compact ? 16 : 20} className="text-emerald-500" />,
                            badge: <ArrowUpRight className="opacity-50" size={compact ? 14 : 16} style={{ color: 'var(--color-text-dim)' }} />
                        },
                        {
                            label: t('dashboard.criticalPoints'),
                            value: totalVerspaetet,
                            subValue: null,
                            color: 'text-rose-600',
                            accent: 'text-rose-600',
                            bg: 'bg-rose-500/10',
                            icon: <AlertTriangle size={compact ? 16 : 20} className="text-rose-500" />,
                            badge: <Info className="text-slate-600 opacity-50" size={compact ? 14 : 16} />
                        },
                        {
                            label: t('dashboard.activeDepartments'),
                            value: departments.length,
                            subValue: null,
                            color: 'var(--color-text-main)',
                            accent: 'text-blue-500',
                            bg: 'bg-blue-500/10',
                            icon: <Cpu size={compact ? 16 : 20} className="text-blue-500" />,
                            badge: <Activity size={compact ? 14 : 16} className="opacity-50" style={{ color: 'var(--color-text-dim)' }} />
                        }
                    ].map((kpi, i) => (
                        <div key={i} className={`stats-card group ${compact ? 'p-3' : 'p-4'}`}>
                            <div className={`flex justify-between items-start ${compact ? 'mb-1' : 'mb-3'}`}>
                                <div className={`${compact ? 'p-1.5' : 'p-2'} ${kpi.bg} rounded-lg group-hover:bg-opacity-20 transition-colors`}>
                                    {kpi.icon}
                                </div>
                                {kpi.badge}
                            </div>
                            <div className={`${compact ? 'text-[8px]' : 'text-[9px]'} font-black uppercase tracking-widest mb-0.5 transition-all`}
                                style={{ color: kpi.label === t('department.efficiency') || kpi.label === t('dashboard.criticalPoints') ? undefined : 'var(--color-text-dim)' }}
                            >{kpi.label}</div>
                            <div className="flex items-baseline gap-1.5">
                                <span
                                    className={`${compact ? 'text-2xl' : 'text-3xl'} font-mono font-black transition-all ${!kpi.color.startsWith('var') ? kpi.color : ''}`}
                                    style={{ color: kpi.color.startsWith('var') ? kpi.color : undefined }}
                                >{kpi.value}</span>
                                {kpi.subValue && (
                                    <span className={`text-[10px] font-bold ${kpi.accent}`}>
                                        {kpi.subValue}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className={`grid grid-cols-1 xl:grid-cols-4 ${compact ? 'gap-4' : 'gap-8'} items-stretch h-fit transition-all`}>
                    {/* Charts & Bottlenecks Column (Left 3/4) */}
                    <div className={`xl:col-span-3 flex flex-col ${compact ? 'gap-4' : 'gap-8'} h-full transition-all`}>
                        {/* Performance Chart NEW (Lower height 300px) */}
                        <div className={`rounded-3xl overflow-hidden shadow-2xl flex flex-col ${compact ? 'h-[250px]' : 'h-[400px]'} transition-all border`}
                            style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border)'
                            }}
                        >
                            <div className="px-8 py-4 border-b flex justify-between items-center transition-all"
                                style={{
                                    backgroundColor: 'var(--color-bg-header)',
                                    borderColor: 'var(--color-border)'
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <TrendingUp size={18} style={{ color: 'var(--color-accent)' }} />
                                    <h3 className="text-xs font-black uppercase tracking-widest"
                                        style={{ color: 'var(--color-text-dim)' }}
                                    >{t('dashboard.performancePerDept')}</h3>
                                </div>
                                <ArrowUpRight size={18} style={{ color: 'var(--color-text-dim)' }} />
                            </div>
                            <div className="flex-1 p-6">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={departments
                                        .slice()
                                        .sort((a, b) => {
                                            if (a.name === 'Armoloy') return 1;
                                            if (b.name === 'Armoloy') return -1;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map(d => ({ name: d.name, value: d.stats?.erfüllungsquote || 0 }))
                                    } margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.05)" vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            stroke="#64748b"
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fill: 'var(--color-text-dim)', fontWeight: '700' }}
                                        />
                                        <YAxis
                                            stroke="#94a3b8"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fill: 'var(--color-text-dim)', fontWeight: '500' }}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-accent)', borderRadius: '12px' }}
                                            labelStyle={{ color: 'var(--color-accent)', fontWeight: '900', textTransform: 'uppercase', fontSize: '11px' }}
                                            itemStyle={{ color: 'var(--color-text-main)', fontWeight: '900', fontSize: '18px' }}
                                            formatter={(value: any) => [`${value}%`, t('department.efficiency')]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke="var(--color-accent)"
                                            strokeWidth={4}
                                            fillOpacity={1}
                                            fill="url(#colorPerf)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Bottlenecks / Flop-2 Section NEW */}
                        <div className="rounded-3xl overflow-hidden shadow-2xl flex flex-col flex-1 border"
                            style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border)'
                            }}
                        >
                            <div className="border-b p-8"
                                style={{
                                    backgroundColor: 'var(--color-bg-header)',
                                    borderColor: 'var(--color-border)'
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <AlertTriangle style={{ color: 'var(--color-accent)' }} size={20} />
                                    <h3 className="text-sm font-black uppercase tracking-widest"
                                        style={{ color: 'var(--color-text-main)' }}
                                    >{t('dashboard.bottlenecks')}</h3>
                                </div>
                            </div>
                            <div className={`p-8 grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 ${compact ? 'gap-3' : 'gap-6'} overflow-y-auto custom-scrollbar transition-all`}>
                                {departments
                                    .slice()
                                    .sort((a, b) => (a.stats?.erfüllungsquote || 0) - (b.stats?.erfüllungsquote || 0))
                                    .slice(0, 2)
                                    .map(dept => (
                                        <div key={dept.id} className={`rounded-xl ${compact ? 'p-3' : 'p-5'} border transition-all`}
                                            style={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                borderColor: 'var(--color-border)'
                                            }}
                                        >
                                            <div className="flex justify-between items-center mb-4 pb-2 border-b"
                                                style={{ borderColor: 'var(--color-border)' }}
                                            >
                                                <span className="text-xs font-black uppercase tracking-widest notranslate"
                                                    translate="no"
                                                    style={{ color: 'var(--color-accent)' }}
                                                >{dept.name}</span>
                                                <span className="text-[10px] font-mono font-bold tracking-tighter"
                                                    style={{ color: 'var(--color-text-dim)' }}
                                                >EQ: {dept.stats?.erfüllungsquote || 0}%</span>
                                            </div>
                                            <div className="space-y-3">
                                                {(dept.bottlenecks || []).slice(0, 2).map((item, idx) => (
                                                    <div key={idx} className="flex flex-col gap-1">
                                                        <div className="flex justify-between gap-2">
                                                            <span className="text-[11px] font-bold flex-1 leading-tight"
                                                                style={{ color: 'var(--color-text-main)' }}
                                                            >{item.title}</span>
                                                            <span className="text-[10px] font-black px-2 py-0.5 rounded border whitespace-nowrap"
                                                                style={{
                                                                    backgroundColor: 'var(--color-accent-glow)',
                                                                    color: 'var(--color-accent)',
                                                                    borderColor: 'var(--color-accent)'
                                                                }}
                                                            >
                                                                {item.count}x
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-1 rounded-full overflow-hidden"
                                                            style={{ backgroundColor: 'var(--color-border)' }}
                                                        >
                                                            <div
                                                                className="h-full rounded-full"
                                                                style={{
                                                                    width: `${Math.min(item.count * 10, 100)}%`,
                                                                    backgroundColor: 'var(--color-accent)',
                                                                    boxShadow: '0 0 8px var(--color-accent-glow)'
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ø {item.avgDelay} sem.</span>
                                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Max {item.maxDelay} sem.</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!dept.bottlenecks || dept.bottlenecks.length === 0) && (
                                                    <div className="text-[10px] text-slate-500 italic py-2">{t('dashboard.noBottlenecks')}</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>

                    {/* Critical Ranking Sidebar (Right 1/4) */}
                    <div className="xl:col-span-1 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full border"
                        style={{
                            backgroundColor: 'var(--color-bg-card)',
                            borderColor: 'var(--color-border)'
                        }}
                    >
                        <div className="px-8 py-5 border-b flex justify-between items-center"
                            style={{
                                backgroundColor: 'var(--color-bg-header)',
                                borderColor: 'var(--color-border)'
                            }}
                        >
                            <h3 className="text-sm font-black uppercase tracking-widest"
                                style={{ color: 'var(--color-text-main)' }}
                            >{t('dashboard.delayWarnings')}</h3>
                            <AlertTriangle size={18} style={{ color: 'var(--color-accent)' }} />
                        </div>
                        <div className={`p-8 ${compact ? 'space-y-3' : 'space-y-6'} flex-1 overflow-y-auto custom-scrollbar transition-all`}>
                            {departments
                                .map(dept => ({ ...dept, criticalCount: getCriticalTasksCount(dept) }))
                                .filter(dept => dept.criticalCount > 0)
                                .sort((a, b) => b.criticalCount - a.criticalCount)
                                .slice(0, 8)
                                .map((dept) => (
                                    <div
                                        key={dept.id}
                                        onClick={() => onNavigate(dept.id, 'Statistik')}
                                        className={`group ${compact ? 'p-4' : 'p-6'} border rounded-xl hover:bg-black/5 transition-all cursor-pointer relative`}
                                        style={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                            borderColor: 'var(--color-border)'
                                        }}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-sm font-mono font-bold text-slate-500 tracking-widest uppercase">ID_{dept.id}</span>
                                            <span className="text-[10px] px-3 py-1 bg-red-500/10 text-red-500 rounded-md border border-red-500/20 uppercase font-black tracking-widest">
                                                {t('dashboard.critical')}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <h4 className={`${compact ? 'text-lg' : 'text-xl'} font-black tracking-tight transition-all notranslate`}
                                                translate="no"
                                                style={{ color: 'var(--color-text-main)' }}
                                            >{dept.name}</h4>
                                            <div className="text-right">
                                                <div className={`${compact ? 'text-3xl' : 'text-4xl'} font-mono font-black transition-transform drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]`}
                                                    style={{ color: '#f43f5e' }}
                                                >
                                                    {dept.criticalCount}
                                                </div>
                                                <div className="text-[11px] uppercase font-black tracking-[0.2em] mt-1"
                                                    style={{ color: 'var(--color-text-dim)' }}
                                                >{t('dashboard.incidents')}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            {departments.filter(d => getCriticalTasksCount(d) > 0).length === 0 && (
                                <div className="text-center py-10">
                                    <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-4 opacity-20" />
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('dashboard.noBottlenecks')}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-8 border-t flex items-center gap-4"
                            style={{
                                borderColor: 'var(--color-border)',
                                backgroundColor: 'var(--color-bg-header)'
                            }}
                        >
                            <div className="p-2 rounded-lg bg-amber-500/10">
                                <Info size={16} style={{ color: 'var(--color-accent)' }} className="shrink-0" />
                            </div>
                            <p className="text-[10px] leading-relaxed italic"
                                style={{ color: 'var(--color-text-dim)' }}
                            >
                                {t('dashboard.analysisNote')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
