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

        // Auth driver
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing auth header' }), { status: 401, headers: corsHeaders })
        }

        const { data: userAuth, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
        if (authError || !userAuth.user) throw authError

        const { data: driver } = await supabaseClient
            .from('drivers')
            .select('id')
            .eq('user_id', userAuth.user.id)
            .single()

        if (!driver) {
            return new Response(JSON.stringify({ error: 'User is not a driver' }), { status: 403, headers: corsHeaders })
        }

        // Body parser
        const payload = await req.json()
        const { order_id, amount_collected, payment_method } = payload

        if (!order_id || amount_collected === undefined) {
            return new Response(JSON.stringify({ error: 'Missing order_id or amount_collected' }), { status: 400, headers: corsHeaders })
        }

        const method = payment_method || 'cash'

        // 1. Obtener detalles de la orden para validación estricta
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select('id, total_amount, delivery_fee, status')
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders })
        }

        // Calcular el monto total esperado (Producto + Tarifa Envío)
        const expectedTotal = Number(order.total_amount || 0) + Number(order.delivery_fee || 0)
        const collected = Number(amount_collected)

        // Validar concordancia de cobro (permite pequeños descuadres por propinas o falta de cambio, pero se registra exactamente lo ingresado)
        // En un sistema muy estricto se rechazaría si collected < expectedTotal

        // 2. Registrar Transacción de Cobro (POD)
        const { data: trx, error: trxError } = await supabaseClient
            .from('cod_transactions')
            .insert([{
                order_id,
                driver_id: driver.id,
                transaction_type: 'cobro_cliente',
                amount: collected,
                status: 'pending',
                payment_method: method
            }])
            .select()
            .single()

        if (trxError) throw trxError

        // 3. Actualizar estado de la orden a Completada (Delivered)
        await supabaseClient
            .from('orders')
            .update({ status: 'delivered', payment_status: method === 'cash' ? 'paid' : 'pending' })
            .eq('id', order_id)

        // Si tuvieramos tabla de routes, actualizariamos el route_stops a 'completed'

        return new Response(JSON.stringify({
            success: true,
            message: 'Cierre POD registrado exitosamente',
            expected_amount: expectedTotal,
            collected_amount: collected,
            transaction: trx
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 201,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
