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

        const payload = await req.json()
        const { order_id, transaction_type, amount } = payload

        if (!order_id || !transaction_type || amount === undefined) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders })
        }

        if (!['anticipo', 'cobro_cliente'].includes(transaction_type)) {
            return new Response(JSON.stringify({ error: 'Invalid transaction_type' }), { status: 400, headers: corsHeaders })
        }

        // Insertar en la tabla de transacciones COD
        const { data: trx, error: trxError } = await supabaseClient
            .from('cod_transactions')
            .insert([{
                order_id,
                driver_id: driver.id,
                transaction_type,
                amount,
                status: 'pending'
            }])
            .select()
            .single()

        if (trxError) throw trxError

        // Si es un cobro al cliente, podemos considerar la orden como entregada (POD)
        if (transaction_type === 'cobro_cliente') {
            await supabaseClient
                .from('orders')
                .update({ status: 'delivered', payment_status: 'paid' })
                .eq('id', order_id)

            // Reducir la carga activa del repartidor porque terminó el viaje
            // Asumiendo que existe un RPC decrement_driver_load
            await supabaseClient.rpc('decrement_driver_load', { driver_uuid: driver.id })
        }

        return new Response(JSON.stringify({ success: true, transaction: trx }), {
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
