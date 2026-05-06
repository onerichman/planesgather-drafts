import { supabase } from '@/lib/supabase';

export const getScopedStorageKey = (baseKey: string, userId?: string | null) => {
  const suffix = userId || 'guest';
  return `${baseKey}:${suffix}`;
};

export const readNumberList = (baseKey: string, userId?: string | null) => {
  const key = getScopedStorageKey(baseKey, userId);
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
};

export const writeNumberList = (baseKey: string, ids: number[], userId?: string | null) => {
  const key = getScopedStorageKey(baseKey, userId);
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
};

export const getCurrentUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};
