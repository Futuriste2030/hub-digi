import { api } from './client.js';
import { get } from './base.js';

export const cleTrackerProjet = async (projectId) => {
  const items = await get('/tracker-keys/', { project: projectId });
  const list = items.results ?? items;
  return list[0] ?? null;
};

export const genererCleTracker = async (projectId) => (await api.post('/tracker-keys/', { project: projectId })).data;
export const majProjet = async (id, payload) => (await api.patch(`/projects/${id}/`, payload)).data;
