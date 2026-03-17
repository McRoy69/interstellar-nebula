import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Factory, Settings, Info, ChevronRight } from 'lucide-react';
import type { DepartmentData } from '../data/mockData';

import chFlag from '../assets/flags/ch.png';
import esFlag from '../assets/flags/es.png';
import trFlag from '../assets/flags/tr.png';
import ptFlag from '../assets/flags/pt.png';
import slFlag from '../assets/flags/sl.png';

interface SidebarProps {
    activeId: string;
    onSelect: (id: string) => void;
    departments: DepartmentData[];
}

const Sidebar: React.FC<SidebarProps> = ({ activeId, onSelect, departments }) => {
    const { t, i18n } = useTranslation();

    return (
        <aside className="w-[420px] h-screen border-r flex flex-col overflow-hidden z-10 transition-all duration-500"
            style={{
                backgroundColor: 'var(--color-bg-sidebar)',
                borderColor: 'var(--color-border)'
            }}
        >
            {/* Brand Section */}
            <div className="p-10 pb-8">
                <div className="flex items-center gap-5">
                    <div className="w-[140px] h-[84px] flex items-center justify-center rounded-2xl shrink-0 p-2 transition-transform hover:scale-105 duration-300 overflow-hidden border"
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderColor: 'var(--color-border)'
                        }}
                    >
                        <img
                            src="/blessing-logo.png"
                            alt="Logo"
                            className="w-full h-full object-contain invert brightness-125 transition-all duration-500"
                            style={{
                                mixBlendMode: 'screen',
                                filter: 'invert(1) brightness(1.25)'
                            }}
                        />
                    </div>
                    <div>
                        <h2 className="text-base font-black tracking-tight leading-none tech-font whitespace-nowrap"
                            style={{ color: 'var(--color-text-main)' }}
                        >Härterei Blessing AG</h2>
                        <div className="flex items-center gap-2 mt-3">
                            <span className="w-2 h-2 rounded-full shadow-[0_0_8px_var(--color-accent-glow)] animate-pulse"
                                style={{ backgroundColor: 'var(--color-accent)' }}
                            />
                            <span className="text-[10px] font-bold tracking-[0.2em] uppercase"
                                style={{ color: 'var(--color-text-dim)' }}
                            >{t('sidebar.maintenancePlan')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-8 space-y-3 overflow-y-auto custom-scrollbar">
                <div
                    onClick={() => onSelect('dashboard')}
                    className={`nav-item ${activeId === 'dashboard' ? 'active' : ''}`}
                >
                    <LayoutDashboard size={24} />
                    <span className="text-base font-bold uppercase tracking-wider">{t('sidebar.centralStats')}</span>
                </div>

                <div className="pt-10 pb-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                    {t('sidebar.productionUnits')}
                </div>

                {departments.map(dept => (
                    <div
                        key={dept.id}
                        onClick={() => onSelect(dept.id)}
                        className={`nav-item ${activeId === dept.id ? 'active' : ''}`}
                    >
                        <Factory size={24} />
                        <span className="text-base font-medium tracking-tight flex-1">{dept.name}</span>
                        {activeId === dept.id && <ChevronRight size={18} style={{ color: 'var(--color-accent)' }} />}
                    </div>
                ))}
            </nav>

            {/* Footer Settings */}
            <div className="p-8 bg-transparent space-y-2 pb-10">
                <div className="flex items-center gap-4 px-8 py-2 mb-4">
                    {[
                        { lang: 'de', flag: chFlag, title: 'Deutsch' },
                        { lang: 'es', flag: esFlag, title: 'Español' },
                        { lang: 'tr', flag: trFlag, title: 'Türkçe' },
                        { lang: 'pt', flag: ptFlag, title: 'Português' },
                        { lang: 'ta', flag: slFlag, title: 'தமிழ்' }
                    ].map((l) => (
                        <button
                            key={l.lang}
                            onClick={() => i18n.changeLanguage(l.lang)}
                            className={`w-9 h-9 rounded-full overflow-hidden transition-all flex items-center justify-center p-0 outline-none ring-0 relative group ${i18n.language === l.lang
                                ? 'scale-110 border-2 z-10'
                                : 'opacity-40 hover:opacity-100 hover:scale-110 border'
                                }`}
                            title={l.title}
                            style={{
                                background: 'var(--color-bg-sidebar)',
                                borderColor: i18n.language === l.lang ? 'var(--color-accent)' : 'var(--color-border)',
                                boxShadow: i18n.language === l.lang ? '0 0 15px var(--color-accent-glow)' : 'none'
                            }}
                        >
                            <img
                                src={l.flag}
                                alt={l.lang}
                                className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-transform duration-300 group-hover:scale-[1.7]"
                                style={{
                                    transform: 'scale(1.6)'
                                }}
                            />
                        </button>
                    ))}
                </div>
                <div
                    onClick={() => onSelect('settings')}
                    className={`nav-item hover:opacity-100 scale-95 hover:scale-100 border transition-all ${activeId === 'settings' ? 'active shadow-[0_0_15px_var(--color-accent-glow)]' : 'border-transparent'}`}
                    style={{
                        borderColor: activeId === 'settings' ? 'var(--color-accent)' : 'transparent'
                    }}
                >
                    <Settings size={22} style={{ color: activeId === 'settings' ? 'var(--color-accent)' : 'inherit' }} />
                    <span className="text-sm font-bold uppercase tracking-widest">{t('sidebar.settings')}</span>
                </div>
                <div className="nav-item text-slate-500/80 cursor-default hover:bg-transparent">
                    <Info size={22} className="text-slate-600" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/80 transition-colors">Created by Michael Jenni 2026</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
