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

        // Body parser
        const payload = await req.json()
        const { driver_id } = payload

        if (!driver_id) {
            return new Response(JSON.stringify({ error: 'Missing driver_id' }), { status: 400, headers: corsHeaders })
        }

        // 1. Obtener todas las transacciones COD pendientes de este repartidor
        const { data: pendingTxs, error: txsError } = await supabaseClient
            .from('cod_transactions')
            .select('id, transaction_type, amount, payment_method, order_id')
            .eq('driver_id', driver_id)
            .eq('status', 'pending')

        if (txsError) throw txsError

        if (!pendingTxs || pendingTxs.length === 0) {
            return new Response(JSON.stringify({
                message: 'No hay transacciones pendientes para conciliar',
                remittance: null
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        let totalCollected = 0
        let totalAdvances = 0
        const txIdsToReconcile: string[] = []

        const uniqueOrders = new Set()

        pendingTxs.forEach(tx => {
            txIdsToReconcile.push(tx.id)
            if (tx.transaction_type === 'cobro_cliente' && tx.payment_method === 'cash') {
                totalCollected += Number(tx.amount)
            } else if (tx.transaction_type === 'anticipo') {
                totalAdvances += Number(tx.amount)
            }
            if (tx.order_id) uniqueOrders.add(tx.order_id)
        })

        const fixedCommissionRate = 15.00
        const totalCommissions = uniqueOrders.size * fixedCommissionRate

        // Fórmula: Total efectivo (cobrado al cliente) - Anticipos - Comisiones Repartidor = Remesa due.
        const netRemittance = totalCollected - totalAdvances - totalCommissions

        // 2. Crear Remesa en driver_remittances
        const { data: remittance, error: remError } = await supabaseClient
            .from('driver_remittances')
            .insert([{
                driver_id,
                period_date: new Date().toISOString().split('T')[0],
                total_collected: totalCollected,
                total_advances: totalAdvances,
                driver_commissions: totalCommissions,
                net_remittance_due: netRemittance,
                status: 'pending' // Hasta que finanzas confirme la recepción física del dinero
            }])
            .select()
            .single()

        if (remError) throw remError

        // 3. Marcar transacciones como conciliadas
        await supabaseClient
            .from('cod_transactions')
            .update({ status: 'reconciled' })
            .in('id', txIdsToReconcile)

        return new Response(JSON.stringify({
            success: true,
            message: 'Liquidación y conciliación calculada exitosamente',
            remittance: remittance
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
