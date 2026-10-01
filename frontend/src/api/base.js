import { api } from './client.js';

/* Listes paginées DRF : suit la pagination jusqu'à épuisement (page_size max 100). */
export async function toutLister(url, params = {}) {
  const items = [];
  let page = 1;
  for (;;) {
    const { data } = await api.get(url, { params: { ...params, page, page_size: 100 } });
    const results = data.results ?? data;
    items.push(...results);
    if (!data.next || results.length === 0) break;
    page += 1;
    if (page > 50) break;
  }
  return items;
}

export const get = async (url, params) => (await api.get(url, { params })).data;
export const post = async (url, payload) => (await api.post(url, payload)).data;
export const patch = async (url, payload) => (await api.patch(url, payload)).data;
export const put = async (url, payload) => (await api.put(url, payload)).data;
export const suppr = async (url) => (await api.delete(url)).data;
