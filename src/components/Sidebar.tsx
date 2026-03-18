import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Factory, Settings, Info, ChevronRight, X } from 'lucide-react';
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
    isOpen?: boolean;
    isCollapsed?: boolean;
    onClose?: () => void;
    onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeId, onSelect, departments, isOpen, isCollapsed, onClose, onToggleCollapse }) => {
    const { t, i18n } = useTranslation();

    return (
        <aside className={`fixed inset-y-0 z-50 lg:static border-r flex flex-col overflow-hidden transition-all duration-500 ease-in-out 
            ${isOpen ? 'left-0' : '-left-[320px] lg:left-0'} 
            ${isCollapsed
                ? 'w-[70px] 3xl:w-[90px]'
                : 'w-[280px] lg:w-[320px] 2xl:w-[360px] 3xl:w-[420px]'
            }`}
            style={{
                backgroundColor: 'var(--color-bg-sidebar)',
                borderColor: 'var(--color-border)'
            }}
        >
            {/* Desktop Collapse Toggle */}
            <button
                onClick={onToggleCollapse}
                className="hidden lg:flex absolute -right-2 top-24 w-7 h-7 bg-amber-500 rounded-full border-2 border-white items-center justify-center z-[60] shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:scale-110 active:scale-90 transition-all"
            >
                <div className={`w-1.5 h-1.5 border-t-2 border-r-2 border-white transition-transform duration-300 ${isCollapsed ? 'rotate-45 translate-x-[-1px]' : '-rotate-135 translate-x-[1px]'}`} />
            </button>
            {/* Close button for mobile */}
            <button
                onClick={onClose}
                className="lg:hidden absolute top-6 right-6 p-2 rounded-xl text-white/40 hover:text-white"
            >
                <X size={24} />
            </button>
            {/* Brand Section */}
            <div className={`${isCollapsed ? 'p-4' : 'p-10'} pb-8 transition-all duration-500`}>
                <div className="flex items-center gap-5">
                    <div className={`${isCollapsed ? 'w-[50px] h-[40px]' : 'w-[140px] h-[84px]'} flex items-center justify-center shrink-0 p-0 transition-all hover:scale-105 duration-300 overflow-hidden`}>
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
                    {!isCollapsed && (
                        <div className="transition-all duration-500 opacity-100 scale-100 origin-left flex flex-col justify-center">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.1em] leading-[1.3] branding-font text-white opacity-95">
                                Härterei<br />Blessing AG
                            </h2>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_var(--color-accent-glow)] animate-pulse"
                                    style={{ backgroundColor: 'var(--color-accent)' }}
                                />
                                <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-white/40">{t('sidebar.maintenancePlan')}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className={`flex-1 ${isCollapsed ? 'p-2' : 'p-8'} space-y-3 overflow-y-auto overflow-x-hidden custom-scrollbar transition-all duration-500`}>
                <div
                    onClick={() => onSelect('dashboard')}
                    className={`nav-item ${activeId === 'dashboard' ? 'active' : ''} ${isCollapsed ? 'justify-center px-0' : ''}`}
                    title={isCollapsed ? t('sidebar.centralStats') : ''}
                >
                    <LayoutDashboard size={24} className={isCollapsed ? 'shrink-0' : ''} />
                    {!isCollapsed && <span className="text-base font-bold uppercase tracking-wider">{t('sidebar.centralStats')}</span>}
                </div>

                {!isCollapsed ? (
                    <div className="pt-10 pb-4 px-5 text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                        {t('sidebar.productionUnits')}
                    </div>
                ) : (
                    <div className="pt-6 pb-2 border-t border-white/5 mt-4" />
                )}

                {departments
                    .slice()
                    .sort((a, b) => {
                        if (a.name === 'Armoloy') return 1;
                        if (b.name === 'Armoloy') return -1;
                        return a.name.localeCompare(b.name);
                    })
                    .map(dept => (
                        <div
                            key={dept.id}
                            onClick={() => onSelect(dept.id)}
                            className={`nav-item ${activeId === dept.id ? 'active' : ''} ${isCollapsed ? 'justify-center px-0' : ''}`}
                            title={isCollapsed ? dept.name : ''}
                        >
                            <Factory size={22} className="shrink-0" />
                            {!isCollapsed && <span className="text-base font-medium tracking-tight flex-1 notranslate truncate" translate="no">{dept.name}</span>}
                            {activeId === dept.id && !isCollapsed && <ChevronRight size={18} className="shrink-0" />}
                        </div>
                    ))}
            </nav>

            {/* Footer Settings */}
            <div className={`${isCollapsed ? 'p-2' : 'p-8'} bg-transparent space-y-2 pb-10 transition-all duration-500`}>
                <div className={`flex ${isCollapsed ? 'flex-col items-center gap-2' : 'items-center gap-4 px-8'} py-2 mb-4`}>
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
                            className={`${isCollapsed ? 'w-8 h-8' : 'w-7 h-7'} rounded-full overflow-hidden transition-all flex items-center justify-center p-0 outline-none ring-0 relative group shadow-sm ${i18n.language === l.lang
                                ? 'scale-125 border-2 z-10'
                                : 'opacity-40 hover:opacity-100 hover:scale-125 border'
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
                    className={`nav-item hover:opacity-100 ${isCollapsed ? 'justify-center px-0 scale-90' : 'scale-100 px-8'} border transition-all ${activeId === 'settings' ? 'active shadow-[0_0_15px_var(--color-accent-glow)]' : 'border-transparent'}`}
                    style={{
                        borderColor: activeId === 'settings' ? 'var(--color-accent)' : 'transparent'
                    }}
                    title={isCollapsed ? t('sidebar.settings') : ''}
                >
                    <Settings size={22} className="shrink-0" />
                    {!isCollapsed && <span className="text-sm font-bold uppercase tracking-widest">{t('sidebar.settings')}</span>}
                </div>
                {!isCollapsed && (
                    <div className="nav-item text-white/30 cursor-default hover:bg-transparent px-8 whitespace-nowrap">
                        <Info size={16} className="text-white/20 shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 transition-colors">Created by Michael Jenni 2026</span>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
