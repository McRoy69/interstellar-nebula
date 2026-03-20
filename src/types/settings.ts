export interface AppSettings {
    thresholds: {
        criticalWeeks: number;
        efficiencyTarget: number;
    };
    ui: {
        compactMode: boolean;
        theme: 'light' | 'dark' | 'natura' | 'vibrant';
        visibleKpis: string[]; // ['efficiency', 'on-time', 'late', 'active-depts']
    };
    notifications: {
        emails: string[];
        reportFormat: 'pdf' | 'excel';
        reportMetrics: {
            [targetId: string]: string[]; // 'central' or departmentId -> ['efficiency', 'on-time', etc.]
        };
    };
}

export const defaultSettings: AppSettings = {
    thresholds: {
        criticalWeeks: 3,
        efficiencyTarget: 100,
    },
    ui: {
        compactMode: false,
        theme: 'light',
        visibleKpis: ['efficiency', 'on-time', 'late', 'active-depts'],
    },
    notifications: {
        emails: [],
        reportFormat: 'pdf',
        reportMetrics: {
            'central': ['efficiency', 'on-time', 'late', 'active-depts']
        }
    },
};
