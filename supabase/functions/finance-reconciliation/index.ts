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

        // Solo admins/finance pueden ejecutar este job manual (o el CRON system bypasses con la SERVICE_ROLE_KEY)

        // Este endpont consolida todas las transacciones COD pendientes de un repartidor
        const payload = await req.json()
        const { driver_id } = payload

        if (!driver_id) {
            return new Response(JSON.stringify({ error: 'driver_id is required' }), { status: 400, headers: corsHeaders })
        }

        // Obtener todas las transacciones cobradas y anticipos 'pending'
        const { data: pendingTxs, error: txsError } = await supabaseClient
            .from('cod_transactions')
            .select('id, transaction_type, amount')
            .eq('driver_id', driver_id)
            .eq('status', 'pending')

        if (txsError) throw txsError
        if (!pendingTxs || pendingTxs.length === 0) {
            return new Response(JSON.stringify({ message: 'No pending transactions to reconcile' }), { headers: corsHeaders, status: 200 })
        }

        let totalCobrado = 0
        let totalAnticipos = 0
        const txIds = pendingTxs.map(tx => tx.id)

        pendingTxs.forEach(tx => {
            if (tx.transaction_type === 'cobro_cliente') {
                totalCobrado += Number(tx.amount)
            } else if (tx.transaction_type === 'anticipo') {
                totalAnticipos += Number(tx.amount)
            }
        })

        // Monto final que el repartidor debe entregar a la empresa
        const netLiquidacion = totalCobrado - totalAnticipos

        // Insertar el registro maestro en 'reconciliations' table (si existe) 
        // o como una trx especial en 'cod_transactions' de type 'liquidacion'
        await supabaseClient
            .from('cod_transactions')
            .insert([{
                driver_id,
                transaction_type: 'liquidacion',
                amount: netLiquidacion,
                status: 'reconciled',
                order_id: null
            }])

        // Marcar transacciones previas como 'reconciled'
        await supabaseClient
            .from('cod_transactions')
            .update({ status: 'reconciled' })
            .in('id', txIds)

        return new Response(JSON.stringify({
            success: true,
            reconciliation: { total_cobro: totalCobrado, total_anticipo: totalAnticipos, balance_a_liquidar: netLiquidacion }
        }), {
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
