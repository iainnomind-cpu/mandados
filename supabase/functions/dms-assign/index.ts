import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Función auxiliar para calcular distancia (Haversine)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

serve(async (req) => {
    if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabaseClient = createClient(supabaseUrl, supabaseKey)

        const payload = await req.json()
        const orderId = payload.order_id

        if (!orderId) {
            return new Response(JSON.stringify({ error: 'Order ID is required' }), { status: 400, headers: corsHeaders })
        }

        // 1. Obtener detalles de la orden
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select('id, priority, pickup_address, delivery_address, status')
            .eq('id', orderId)
            .single()

        if (orderError || !order) throw new Error('Order not found')
        if (order.status !== 'pending') {
            return new Response(JSON.stringify({ error: 'Order is not pending' }), { status: 400, headers: corsHeaders })
        }

        const pickupLat = order.pickup_address.lat
        const pickupLng = order.pickup_address.lng

        // 2. Buscar repartidores disponibles con su ubicación y carga actual
        // Ignoramos offline
        const { data: drivers } = await supabaseClient
            .from('drivers')
            .select('id, current_lat, current_lng, active_load_count, status')
            .in('status', ['available', 'busy'])

        if (!drivers || drivers.length === 0) {
            return new Response(JSON.stringify({ error: 'No drivers available' }), { status: 404, headers: corsHeaders })
        }

        let selectedDriverId = null

        // REGLA 1: Comida Crítica (Alta prioridad)
        if (order.priority === 'high' || order.priority === 'urgent') {
            // Ordenamos por los que tienen la menor cantidad de pedidos y están más cerca
            const scoredDrivers = drivers.map(d => {
                const dist = getDistanceFromLatLonInKm(pickupLat, pickupLng, d.current_lat || pickupLat, d.current_lng || pickupLng)
                // Penalizar fuertemente si ya están muy ocupados (active_load_count > 1) 
                // para asegurar entrega rápida (< 45 min)
                const score = dist + (d.active_load_count * 15) // +15km castigo por cada pedido activo
                return { ...d, distance: dist, score }
            }).sort((a, b) => a.score - b.score)

            selectedDriverId = scoredDrivers[0]?.id
        }
        // REGLA 2: Asignación local regular 'mandadito'
        else {
            // Priorizar a los que estén más cerca físicamente, pero que su active_load_count < 3 (capacidad)
            const eligibleDrivers = drivers.filter(d => d.active_load_count < 3)
            if (eligibleDrivers.length > 0) {
                const sorted = eligibleDrivers.map(d => {
                    const dist = getDistanceFromLatLonInKm(pickupLat, pickupLng, d.current_lat || pickupLat, d.current_lng || pickupLng)
                    return { ...d, distance: dist }
                }).sort((a, b) => a.distance - b.distance)

                selectedDriverId = sorted[0]?.id
            } else {
                // Fallback al mejor global
                const sorted = drivers.map(d => {
                    const dist = getDistanceFromLatLonInKm(pickupLat, pickupLng, d.current_lat || pickupLat, d.current_lng || pickupLng)
                    return { ...d, distance: dist }
                }).sort((a, b) => a.distance - b.distance)

                selectedDriverId = sorted[0]?.id
            }
        }

        if (!selectedDriverId) {
            return new Response(JSON.stringify({ error: 'Failed to assign a driver' }), { status: 500, headers: corsHeaders })
        }

        // 3. Asignar orden al driver seleccionado
        // Creando el registro en 'assignments' primero
        const { error: assignError } = await supabaseClient
            .from('assignments')
            .insert([{
                order_id: order.id,
                driver_id: selectedDriverId,
                status: 'assigned'
            }])

        if (assignError) throw assignError

        // Incrementar active_load_count 
        await supabaseClient.rpc('increment_driver_load', { driver_uuid: selectedDriverId })
        // Alternativa manual si el RPC no existe: 
        /* const targetDriver = drivers.find(d => d.id === selectedDriverId)
           await supabaseClient.from('drivers').update({ active_load_count: targetDriver.active_load_count + 1 }).eq('id', selectedDriverId)
        */

        // Actualizar orden a 'assigned'
        await supabaseClient.from('orders').update({ status: 'assigned' }).eq('id', order.id)

        // Opcionalmente agregar parada a la tabla 'route_stops' de 'driver_routes' activa.

        return new Response(JSON.stringify({
            success: true,
            assigned_driver: selectedDriverId
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
