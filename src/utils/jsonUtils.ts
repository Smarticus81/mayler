import type { JSONObject } from '../types';

export const asObject = (v: unknown): JSONObject | null =>
    (v && typeof v === 'object' ? (v as JSONObject) : null);

export const asString = (v: unknown): string | null =>
    (typeof v === 'string' ? v : null);

export const safeJson = async (resp: Response) => {
    const text = await resp.text().catch(() => '');
    try {
        return JSON.parse(text);
    } catch {
        return { ok: resp.ok, status: resp.status, body: text };
    }
};
