import { supabase } from './supabase';
import { DeliveryZone } from '../types';

export async function getActiveZones(): Promise<DeliveryZone[]> {
    const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('is_active', true)
        .order('name');
    if (error) throw error;
    return data as DeliveryZone[];
}

export async function getAllZones(): Promise<DeliveryZone[]> {
    const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('name');
    if (error) throw error;
    return data as DeliveryZone[];
}

export async function createZone(zone: Partial<DeliveryZone>) {
    const { data, error } = await supabase
        .from('delivery_zones')
        .insert([{ ...zone, updated_at: new Date().toISOString() }])
        .select()
        .single();
    if (error) throw error;
    return data as DeliveryZone;
}

export async function updateZone(id: string, updates: Partial<DeliveryZone>) {
    const { id: _, created_at, ...payload } = updates as any;
    const { data, error } = await supabase
        .from('delivery_zones')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as DeliveryZone;
}

export async function deleteZone(id: string) {
    const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', id);
    if (error) throw error;
}
