import { get, patch, toutLister } from './base.js';

export const dashboardAdmin = () => get('/dashboard/super-admin/');
export const dashboardPerso = () => get('/dashboard/perso/');
export const seriesDashboard = () => get('/dashboard/series/');
export const listerNotifications = () => toutLister('/notifications/');
export const marquerNotifLue = (id) => patch(`/notifications/${id}/`, { lue: true });
