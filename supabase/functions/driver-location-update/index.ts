import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Solo un Repartidor autenticado debería llamar esto, extraemos token = req.headers.get('Authorization')
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing auth header' }), { status: 401, headers: corsHeaders })
        }

        const { data: userAuth, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
        if (authError || !userAuth.user) throw authError

        const userId = userAuth.user.id

        // Obtener Driver ID
        const { data: driver } = await supabaseClient
            .from('drivers')
            .select('id')
            .eq('user_id', userId)
            .single()

        if (!driver) {
            return new Response(JSON.stringify({ error: 'User is not a driver' }), { status: 403, headers: corsHeaders })
        }

        const payload = await req.json()
        const lat = payload.lat
        const lng = payload.lng

        if (!lat || !lng) {
            return new Response(JSON.stringify({ error: 'Lat and lng are required' }), { status: 400, headers: corsHeaders })
        }

        // Actualizar current_lat y current_lng en table drivers
        const { error: updateError } = await supabaseClient
            .from('drivers')
            .update({ current_lat: lat, current_lng: lng })
            .eq('id', driver.id)

        if (updateError) throw updateError

        // Opcional: Insertar histórico en driver_locations
        await supabaseClient
            .from('driver_locations')
            .insert([{ driver_id: driver.id, latitude: lat, longitude: lng }])

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
