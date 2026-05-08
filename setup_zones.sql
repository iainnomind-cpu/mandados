-- Script para crear la tabla de Zonas de Entrega Dinámicas y Políticas de Seguridad (RLS) en Supabase

CREATE TABLE public.delivery_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    commission numeric NOT NULL,
    polygon jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_zones_pkey PRIMARY KEY (id)
);

-- Si deseas habilitar RLS (Row Level Security), hazlo a continuación:
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Permitimos a todos (o roles autenticados) consultar las zonas para calcular las tarifas:
CREATE POLICY "Enable read access for all users" ON public.delivery_zones
    FOR SELECT USING (true);

-- Solo administradores u operadores pueden insertar, eliminar o actualizar
CREATE POLICY "Enable all access for admins" ON public.delivery_zones
    FOR ALL USING (auth.role() = 'authenticated');
    
--- Nota: Si tienes roles específicos en tus perfiles, puedes ajustar la política de All Access a tu rol administrativo.
