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
        const { order_id, amount_paid } = payload

        if (!order_id || amount_paid === undefined) {
            return new Response(JSON.stringify({ error: 'Missing order_id or amount_paid' }), { status: 400, headers: corsHeaders })
        }

        // Check that order exists and is valid
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select('id, status')
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders })
        }

        // Insertar Anticipo (Float Tracking)
        const { data: trx, error: trxError } = await supabaseClient
            .from('cod_transactions')
            .insert([{
                order_id,
                driver_id: driver.id,
                transaction_type: 'anticipo',
                amount: amount_paid,
                status: 'pending',
                payment_method: 'cash'
            }])
            .select()
            .single()

        if (trxError) throw trxError

        return new Response(JSON.stringify({
            success: true,
            message: 'Anticipo registrado exitosamente',
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
