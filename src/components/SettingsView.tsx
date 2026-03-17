import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Settings,
    Monitor,
    Layers,
    Mail,
    Save,
    Plus,
    Trash2,
    ChevronRight,
    Target,
    Layout,
    Download,
    Upload,
    Send,
    AlertCircle
} from 'lucide-react';
import type { AppSettings } from '../types/settings';
import type { DepartmentData } from '../data/mockData';

interface SettingsViewProps {
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    departments: DepartmentData[];
    setDepartments: React.Dispatch<React.SetStateAction<DepartmentData[]>>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ settings, setSettings, departments, setDepartments }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'general' | 'ui' | 'depts' | 'export'>('general');
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    const handleThresholdChange = (key: keyof AppSettings['thresholds'], value: number) => {
        setSettings(prev => ({
            ...prev,
            thresholds: { ...prev.thresholds, [key]: value }
        }));
    };

    const handleUiChange = (key: keyof AppSettings['ui'], value: any) => {
        setSettings(prev => ({
            ...prev,
            ui: { ...prev.ui, [key]: value }
        }));
    };

    const addDepartment = () => {
        const newId = `dept_${Date.now()}`;
        const newDept: DepartmentData = {
            id: newId,
            name: 'New Department',
            stats: { geplant: 0, erledigt: 0, erledigtPuenktlich: 0, offen: 0, erfüllungsquote: 0 },
            tasks: [],
            planningTasks: []
        };
        setDepartments(prev => [...prev, newDept]);
    };

    const updateDeptName = (id: string, name: string) => {
        setDepartments(prev => prev.map(d => d.id === id ? { ...d, name } : d));
    };

    const deleteDept = (id: string) => {
        if (confirmingId === id) {
            setDepartments(prev => prev.filter(d => d.id !== id));
            setConfirmingId(null);
        }
    };

    const addEmail = () => {
        setSettings(prev => ({
            ...prev,
            notifications: {
                ...prev.notifications,
                emails: [...prev.notifications.emails, '']
            }
        }));
    };

    const updateEmail = (index: number, value: string) => {
        setSettings(prev => {
            const newEmails = [...prev.notifications.emails];
            newEmails[index] = value;
            return {
                ...prev,
                notifications: {
                    ...prev.notifications,
                    emails: newEmails
                }
            };
        });
    };

    const removeEmail = (index: number) => {
        setSettings(prev => ({
            ...prev,
            notifications: {
                ...prev.notifications,
                emails: prev.notifications.emails.filter((_, i) => i !== index)
            }
        }));
    };

    const toggleMetric = (targetId: string, metric: string) => {
        setSettings(prev => {
            const currentMetrics = prev.notifications.reportMetrics?.[targetId] || [];
            const newMetrics = currentMetrics.includes(metric)
                ? currentMetrics.filter(m => m !== metric)
                : [...currentMetrics, metric];
            return {
                ...prev,
                notifications: {
                    ...prev.notifications,
                    reportMetrics: {
                        ...(prev.notifications.reportMetrics || {}),
                        [targetId]: newMetrics
                    }
                }
            };
        });
    };

    const AVAILABLE_METRICS = [
        { id: 'efficiency', label: t('settings.metrics.efficiency') },
        { id: 'on-time', label: t('settings.metrics.onTime') },
        { id: 'late', label: t('settings.metrics.late') },
        { id: 'offen', label: t('settings.metrics.openTasks') },
        { id: 'erfüllungsquote', label: t('settings.metrics.complianceRate') }
    ];

    const [isSending, setIsSending] = useState(false);

    const handleSendTestEmail = async () => {
        if (settings.notifications.emails.length === 0) {
            alert(t('settings.export.noEmails'));
            return;
        }

        setIsSending(true);
        try {
            const response = await fetch('/api/send-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    alert('¡Informe enviado con éxito a los destinatarios configurados!');
                } else {
                    alert('Error del servidor: ' + (result.message || 'Error desconocido'));
                }
            } else {
                const errorText = await response.text();
                alert(`Error del Servidor (${response.status}): ${errorText.substring(0, 100)}...`);
            }
        } catch (error: any) {
            console.error('Send error:', error);
            alert('Error técnico/red: ' + (error.message || 'Fallo de conexión'));
        } finally {
            setIsSending(false);
        }
    };

    const handleExport = () => {
        try {
            const backupData = {
                settings,
                departments,
                version: '2.0',
                timestamp: new Date().toISOString()
            };
            const jsonString = JSON.stringify(backupData, null, 2);

            // Use Data URI instead of Blob URL for high-restriction environments
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);

            const link = document.createElement('a');
            link.setAttribute('href', dataUri);
            link.setAttribute('download', 'mantenimiento_backup.json');
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                document.body.removeChild(link);
            }, 500);

            console.log('Export JSON completed.');
        } catch (error) {
            console.error('Export error:', error);
            alert(t('settings.backup.errorExport'));
        }
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (data.settings && data.departments) {
                    setSettings(data.settings);
                    setDepartments(data.departments);
                    alert(t('settings.backup.success'));
                    window.location.reload();
                } else {
                    alert(t('settings.backup.invalidFile'));
                }
            } catch (err) {
                alert(t('settings.backup.errorReading'));
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="h-full flex flex-col p-12 overflow-y-auto custom-scrollbar animate-in fade-in duration-700"
            style={{ backgroundColor: 'transparent' }}
        >
            {/* Header */}
            <div className="flex items-center gap-6 mb-12">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-sidebar)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-accent)'
                    }}
                >
                    <Settings size={32} />
                </div>
                <div>
                    <h1 className="text-4xl font-black tracking-tight uppercase leading-none"
                        style={{ color: 'var(--color-text-main)' }}
                    >{t('sidebar.settings')}</h1>
                    <p className="mt-2 font-bold uppercase tracking-widest text-xs opacity-70"
                        style={{ color: 'var(--color-text-dim)' }}
                    >{t('settings.subtitle')}</p>
                </div>
            </div>

            <div className="flex gap-8 items-start">
                {/* Tabs Sidebar */}
                <div className="w-64 space-y-2 shrink-0">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-md ${activeTab === 'general' ? 'text-white' : 'hover:bg-black/5'}`}
                        style={{
                            backgroundColor: activeTab === 'general' ? 'var(--color-accent)' : 'var(--color-bg-card)',
                            color: activeTab === 'general' ? 'var(--color-bg-sidebar)' : 'var(--color-text-dim)',
                            borderColor: 'var(--color-border)',
                            borderWidth: '1px'
                        }}
                    >
                        <Target size={18} />
                        {t('settings.tabs.general')}
                    </button>
                    <button
                        onClick={() => setActiveTab('ui')}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-md ${activeTab === 'ui' ? 'text-white' : 'hover:bg-black/5'}`}
                        style={{
                            backgroundColor: activeTab === 'ui' ? 'var(--color-accent)' : 'var(--color-bg-card)',
                            color: activeTab === 'ui' ? 'var(--color-bg-sidebar)' : 'var(--color-text-dim)',
                            borderColor: 'var(--color-border)',
                            borderWidth: '1px'
                        }}
                    >
                        <Monitor size={18} />
                        {t('settings.tabs.ui')}
                    </button>
                    <button
                        onClick={() => setActiveTab('depts')}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-md ${activeTab === 'depts' ? 'text-white' : 'hover:bg-black/5'}`}
                        style={{
                            backgroundColor: activeTab === 'depts' ? 'var(--color-accent)' : 'var(--color-bg-card)',
                            color: activeTab === 'depts' ? 'var(--color-bg-sidebar)' : 'var(--color-text-dim)',
                            borderColor: 'var(--color-border)',
                            borderWidth: '1px'
                        }}
                    >
                        <Layers size={18} />
                        {t('settings.tabs.depts')}
                    </button>
                    <button
                        onClick={() => setActiveTab('export')}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-md ${activeTab === 'export' ? 'text-white' : 'hover:bg-black/5'}`}
                        style={{
                            backgroundColor: activeTab === 'export' ? 'var(--color-accent)' : 'var(--color-bg-card)',
                            color: activeTab === 'export' ? 'var(--color-bg-sidebar)' : 'var(--color-text-dim)',
                            borderColor: 'var(--color-border)',
                            borderWidth: '1px'
                        }}
                    >
                        <Mail size={18} />
                        {t('settings.tabs.export')}
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 border rounded-3xl p-10 min-h-[600px] backdrop-blur-md shadow-2xl"
                    style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderColor: 'var(--color-border)'
                    }}
                >
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                            <h2 className="text-2xl font-black mb-10 tracking-tight" style={{ color: 'var(--color-text-main)' }}>{t('settings.thresholds.title')}</h2>

                            <div className="space-y-6 max-w-lg">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-dim)' }}>{t('settings.thresholds.criticalTitle')}</label>
                                        <span className="text-xl font-mono font-black" style={{ color: 'var(--color-accent)' }}>{settings.thresholds.criticalWeeks}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="12"
                                        value={settings.thresholds.criticalWeeks}
                                        onChange={(e) => handleThresholdChange('criticalWeeks', parseInt(e.target.value))}
                                        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                                        style={{
                                            backgroundColor: 'rgba(0,0,0,0.1)',
                                            accentColor: 'var(--color-accent)'
                                        }}
                                    />
                                    <p className="text-[10px] italic" style={{ color: 'var(--color-text-dim)' }}>{t('settings.thresholds.criticalDesc')}</p>
                                </div>

                                <div className="space-y-3 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="flex justify-between items-end">
                                        <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-dim)' }}>{t('settings.thresholds.efficiencyTitle')}</label>
                                        <span className="text-xl font-mono font-black" style={{ color: 'var(--color-accent)' }}>{settings.thresholds.efficiencyTarget}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        value={settings.thresholds.efficiencyTarget}
                                        onChange={(e) => handleThresholdChange('efficiencyTarget', parseInt(e.target.value))}
                                        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                                        style={{
                                            backgroundColor: 'rgba(0,0,0,0.1)',
                                            accentColor: 'var(--color-accent)'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Backup & Restore */}
                            <div className="pt-10 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2"
                                    style={{ color: 'var(--color-text-dim)' }}
                                >
                                    <Save size={14} style={{ color: 'var(--color-accent)' }} />
                                    {t('settings.backup.title')}
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={handleExport}
                                        className="flex items-center justify-center gap-3 p-6 rounded-2xl border transition-all font-black uppercase text-xs tracking-widest group shadow-lg"
                                        style={{
                                            backgroundColor: 'var(--color-accent-glow)',
                                            borderColor: 'var(--color-accent)',
                                            color: 'var(--color-accent)'
                                        }}
                                    >
                                        <Download size={20} className="group-hover:scale-110 transition-transform" />
                                        {t('settings.backup.export')}
                                    </button>

                                    <label className="flex items-center justify-center gap-3 p-6 rounded-2xl border transition-all font-black uppercase text-xs tracking-widest cursor-pointer group shadow-lg"
                                        style={{
                                            backgroundColor: 'var(--color-field-bg)',
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-text-dim)'
                                        }}
                                    >
                                        <Upload size={20} className="group-hover:scale-110 transition-transform" />
                                        {t('settings.backup.restore')}
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={handleImport}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                                <p className="mt-4 text-[10px] italic" style={{ color: 'var(--color-text-dim)' }}>
                                    {t('settings.backup.description')}
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ui' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                            <h2 className="text-2xl font-black mb-10 tracking-tight" style={{ color: 'var(--color-text-main)' }}>{t('settings.ui.title')}</h2>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-dim)' }}>{t('settings.ui.displayMode')}</label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleUiChange('compactMode', false)}
                                            className={`flex-1 group p-6 rounded-2xl border transition-all shadow-md ${!settings.ui.compactMode ? '' : 'hover:border-opacity-50'}`}
                                            style={{
                                                backgroundColor: !settings.ui.compactMode ? 'var(--color-accent)' : 'var(--color-field-bg)',
                                                borderColor: !settings.ui.compactMode ? 'var(--color-accent)' : 'var(--color-border)',
                                                color: !settings.ui.compactMode ? 'var(--color-bg-sidebar)' : 'var(--color-text-main)'
                                            }}
                                        >
                                            <Layout size={24} className="mb-4" />
                                            <div className="font-black uppercase text-xs tracking-widest">{t('settings.ui.standard')}</div>
                                            <div className="text-[10px] mt-1 font-bold opacity-70">{t('settings.ui.standardDesc')}</div>
                                        </button>
                                        <button
                                            onClick={() => handleUiChange('compactMode', true)}
                                            className={`flex-1 group p-6 rounded-2xl border transition-all shadow-md ${settings.ui.compactMode ? '' : 'hover:border-opacity-50'}`}
                                            style={{
                                                backgroundColor: settings.ui.compactMode ? 'var(--color-accent)' : 'var(--color-field-bg)',
                                                borderColor: settings.ui.compactMode ? 'var(--color-accent)' : 'var(--color-border)',
                                                color: settings.ui.compactMode ? 'var(--color-bg-sidebar)' : 'var(--color-text-main)'
                                            }}
                                        >
                                            <Monitor size={24} className="mb-4" />
                                            <div className="font-black uppercase text-xs tracking-widest">{t('settings.ui.compact')}</div>
                                            <div className="text-[10px] mt-1 font-bold opacity-70">{t('settings.ui.compactDesc')}</div>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-dim)' }}>{t('settings.ui.colorTheme')}</label>
                                    <select
                                        value={settings.ui.theme}
                                        onChange={(e) => handleUiChange('theme', e.target.value)}
                                        className="w-full border rounded-xl p-4 text-sm font-bold uppercase tracking-widest outline-none transition-all shadow-inner"
                                        style={{
                                            backgroundColor: 'var(--color-field-bg)',
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-text-main)'
                                        }}
                                    >
                                        <option value="light" style={{ backgroundColor: 'var(--color-field-bg)' }}>{t('settings.ui.themes.light')}</option>
                                        <option value="dark" style={{ backgroundColor: 'var(--color-field-bg)' }}>{t('settings.ui.themes.dark')}</option>
                                        <option value="natura" style={{ backgroundColor: 'var(--color-field-bg)' }}>{t('settings.ui.themes.natura')}</option>
                                        <option value="vibrant" style={{ backgroundColor: 'var(--color-field-bg)' }}>{t('settings.ui.themes.vibrant')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'depts' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 flex flex-col h-full">
                            <div className="flex justify-between items-center mb-10">
                                <h2 className="text-2xl font-black mb-10 tracking-tight" style={{ color: 'var(--color-text-main)' }}>{t('settings.depts.title')}</h2>
                                <button
                                    onClick={addDepartment}
                                    className="px-6 py-3 rounded-xl flex items-center gap-3 font-black uppercase text-xs tracking-widest transition-all shadow-xl"
                                    style={{
                                        backgroundColor: 'var(--color-accent)',
                                        color: 'var(--color-bg-sidebar)'
                                    }}
                                >
                                    <Plus size={18} />
                                    {t('settings.depts.add')}
                                </button>
                            </div>

                            <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-4">
                                {departments.map(dept => (
                                    <div key={dept.id} className="group flex items-center gap-4 p-4 border rounded-2xl transition-all shadow-sm"
                                        style={{
                                            backgroundColor: 'var(--color-field-bg)',
                                            borderColor: 'var(--color-border)'
                                        }}
                                    >
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-black text-sm"
                                            style={{
                                                backgroundColor: 'rgba(0,0,0,0.1)',
                                                color: 'var(--color-text-dim)'
                                            }}
                                        >
                                            {dept.id.slice(0, 2).toUpperCase()}
                                        </div>
                                        <input
                                            value={dept.name}
                                            onChange={(e) => updateDeptName(dept.id, e.target.value)}
                                            placeholder={t('settings.depts.placeholder')}
                                            className="flex-1 bg-transparent border-none font-bold text-base focus:ring-0 notranslate"
                                            translate="no"
                                            style={{
                                                color: 'var(--color-text-main)',
                                                '--tw-placeholder-color': 'var(--color-text-dim)'
                                            } as any}
                                        />
                                        <div className="flex items-center gap-2">
                                            <button className="p-3 rounded-xl transition-all"
                                                style={{
                                                    backgroundColor: 'rgba(0,0,0,0.05)',
                                                    color: 'var(--color-text-dim)'
                                                }}
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setConfirmingId(dept.id);
                                                    deleteDept(dept.id);
                                                }}
                                                className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all ml-4 shadow-sm"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'export' && (
                        <div className="space-y-12 animate-in slide-in-from-right-4 duration-500 max-w-4xl">
                            <div>
                                <h2 className="text-2xl font-black mb-2 tracking-tight" style={{ color: 'var(--color-text-main)' }}>{t('settings.export.title')}</h2>
                                <p className="text-sm font-medium mb-10" style={{ color: 'var(--color-text-dim)' }}>{t('settings.export.subtitle')}</p>

                                <div className="space-y-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                        style={{ color: 'var(--color-text-dim)' }}
                                    >
                                        <Mail size={14} style={{ color: 'var(--color-accent)' }} />
                                        {t('settings.export.emailLabel')}
                                    </h3>

                                    <div className="space-y-3 p-6 border rounded-2xl shadow-inner"
                                        style={{
                                            backgroundColor: 'var(--color-field-bg)',
                                            borderColor: 'var(--color-border)'
                                        }}
                                    >
                                        {settings.notifications.emails.length === 0 ? (
                                            <div className="text-xs italic font-medium py-4 text-center" style={{ color: 'var(--color-text-dim)' }}>{t('settings.export.noEmails')}</div>
                                        ) : (
                                            settings.notifications.emails.map((email, idx) => (
                                                <div key={idx} className="flex gap-3 group">
                                                    <div className="flex-1 border rounded-xl px-4 py-3 flex items-center gap-3 transition-all"
                                                        style={{
                                                            backgroundColor: 'var(--color-bg-card)',
                                                            borderColor: 'var(--color-border)'
                                                        }}
                                                    >
                                                        <Mail size={16} style={{ color: 'var(--color-text-dim)' }} />
                                                        <input
                                                            value={email}
                                                            onChange={(e) => updateEmail(idx, e.target.value)}
                                                            placeholder={t('settings.export.placeholderEmail')}
                                                            className="bg-transparent border-none text-sm w-full outline-none focus:ring-0 font-medium"
                                                            style={{ color: 'var(--color-text-main)' }}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => removeEmail(idx)}
                                                        className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                                                        title={t('settings.export.deleteEmail')}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                        <button
                                            onClick={addEmail}
                                            className="w-full mt-2 flex items-center justify-center gap-2 py-4 border border-dashed rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest"
                                            style={{
                                                borderColor: 'var(--color-border)',
                                                color: 'var(--color-text-dim)'
                                            }}
                                        >
                                            <Plus size={16} /> {t('settings.export.addEmail')}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {/* Central Stats */}
                                <div className="space-y-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                        style={{ color: 'var(--color-text-dim)' }}
                                    >
                                        <Layout size={14} style={{ color: 'var(--color-accent)' }} />
                                        {t('settings.export.centralMetrics')}
                                    </h3>
                                    <div className="p-6 border rounded-2xl space-y-2 shadow-inner"
                                        style={{
                                            backgroundColor: 'var(--color-field-bg)',
                                            borderColor: 'var(--color-border)'
                                        }}
                                    >
                                        {AVAILABLE_METRICS.map(m => {
                                            const active = (settings.notifications.reportMetrics?.['central'] || []).includes(m.id);
                                            return (
                                                <button
                                                    key={m.id}
                                                    onClick={() => toggleMetric('central', m.id)}
                                                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${active
                                                        ? 'shadow-sm'
                                                        : ''
                                                        }`}
                                                    style={{
                                                        backgroundColor: active ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                                                        borderColor: active ? 'var(--color-accent)' : 'var(--color-border)'
                                                    }}
                                                >
                                                    <span className="text-[10px] font-black uppercase tracking-widest"
                                                        style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-dim)' }}
                                                    >{m.label}</span>
                                                    <div className="w-5 h-5 rounded-md border flex items-center justify-center transition-all"
                                                        style={{
                                                            backgroundColor: active ? 'var(--color-accent)' : 'transparent',
                                                            borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                                                            color: active ? 'var(--color-bg-sidebar)' : 'transparent'
                                                        }}
                                                    >
                                                        {active && <Save size={12} />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Per Department */}
                                <div className="space-y-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                        style={{ color: 'var(--color-text-dim)' }}
                                    >
                                        <Layers size={14} style={{ color: 'var(--color-accent)' }} />
                                        {t('settings.export.deptMetrics')}
                                    </h3>
                                    <div className="border rounded-2xl max-h-[450px] overflow-y-auto custom-scrollbar p-6 space-y-8 shadow-inner"
                                        style={{
                                            backgroundColor: 'var(--color-field-bg)',
                                            borderColor: 'var(--color-border)'
                                        }}
                                    >
                                        {departments.map(dept => (
                                            <div key={dept.id} className="space-y-4 pb-6 border-b last:border-0 last:pb-0"
                                                style={{ borderColor: 'var(--color-border)' }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full shadow-[0_0_8px_var(--color-accent-glow)]"
                                                        style={{ backgroundColor: 'var(--color-accent)' }}
                                                    />
                                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none notranslate"
                                                        translate="no"
                                                        style={{ color: 'var(--color-text-main)' }}
                                                    >{dept.name}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {AVAILABLE_METRICS.map(m => {
                                                        const active = (settings.notifications.reportMetrics?.[dept.id] || []).includes(m.id);
                                                        return (
                                                            <button
                                                                key={m.id}
                                                                onClick={() => toggleMetric(dept.id, m.id)}
                                                                className="px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all shadow-sm"
                                                                style={{
                                                                    backgroundColor: active ? 'var(--color-accent)' : 'var(--color-bg-card)',
                                                                    borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                                                                    color: active ? 'var(--color-bg-sidebar)' : 'var(--color-text-dim)'
                                                                }}
                                                            >
                                                                {m.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex flex-col gap-4 max-w-lg mx-auto">
                                <button
                                    onClick={handleSendTestEmail}
                                    disabled={isSending || settings.notifications.emails.length === 0}
                                    className="w-full flex items-center justify-center gap-2 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <Send size={18} className={isSending ? 'animate-pulse' : 'group-hover:translate-x-1 transition-transform'} />
                                    {isSending ? 'Enviando...' : 'Enviar Informe por Email Ahora'}
                                </button>

                                <p className="text-[10px] text-center font-bold uppercase tracking-wider opacity-60 flex items-center justify-center gap-2" style={{ color: 'var(--color-text-dim)' }}>
                                    <AlertCircle size={12} />
                                    Envío automático: Todos los lunes a las 03:00 am
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-12 pt-8 border-t flex justify-between items-center shadow-[0_-1px_0_var(--color-border)]"
                    style={{ borderColor: 'var(--color-border)' }}
                >
                    <div className="flex items-center gap-3" style={{ color: 'var(--color-text-dim)' }}>
                        <Save size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t('settings.footer.autoSave')}</span>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all"
                        style={{
                            backgroundColor: 'var(--color-accent)',
                            color: 'var(--color-bg-sidebar)'
                        }}
                    >
                        {t('settings.footer.applyReload')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
