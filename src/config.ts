import { getISOWeek, getISOYear } from './utils/dateUtils';

const now = new Date();

export const APP_CONFIG = {
    CURRENT_KW: getISOWeek(now),
    CURRENT_YEAR: getISOYear(now),
    BRAND_NAME: 'Härterei Blessing AG',
    SUBTITLE: 'Maintenance Performance Analytics'
};
