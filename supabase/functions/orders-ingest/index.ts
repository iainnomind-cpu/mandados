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

        const payload = await req.json()

        // 1. Resolve Customer
        const customerPhone = payload.customer?.phone
        if (!customerPhone) {
            return new Response(JSON.stringify({ error: 'Customer phone is required' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        let customerId = null
        const { data: existingCustomer } = await supabaseClient
            .from('customers')
            .select('id')
            .eq('phone', customerPhone)
            .single()

        if (existingCustomer) {
            customerId = existingCustomer.id
        } else {
            const { data: newCustomer, error: customerError } = await supabaseClient
                .from('customers')
                .insert([{ phone: customerPhone, name: `Cliente ${customerPhone}` }])
                .select('id')
                .single()

            if (customerError) throw customerError
            customerId = newCustomer.id
        }

        // 2. Classify Priority
        const serviceType = payload.service?.type?.toLowerCase() || 'mandadito'
        const orderType = ['mandadito', 'restaurant', 'express'].includes(serviceType) ? serviceType : 'mandadito'

        let priority = 'normal'
        if (orderType === 'restaurant') {
            priority = 'high' // Comida Crítica
        } else if (payload.service?.priority_level) {
            priority = payload.service.priority_level
        }

        // 3. Dynamic Pricing
        const isEdgeZone = payload.logistics?.dropoff?.is_edge_zone === true
        const baseFee = 35.00 // Tarifa base fija (en prod podría ser consultada de DB)
        const deliveryFee = baseFee + (isEdgeZone ? 5.00 : 0.00)

        // 4. Create Order
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .insert([{
                order_number: payload.order_id_external,
                customer_id: customerId,
                order_type: orderType,
                source: 'chatbot',
                priority: priority,
                pickup_address: {
                    address: payload.logistics?.pickup?.address,
                    lat: payload.logistics?.pickup?.lat,
                    lng: payload.logistics?.pickup?.lng
                },
                delivery_address: {
                    address: payload.logistics?.dropoff?.address,
                    lat: payload.logistics?.dropoff?.lat,
                    lng: payload.logistics?.dropoff?.lng,
                    is_edge_zone: isEdgeZone
                },
                items: [{
                    description: payload.service?.product_description || 'N/A',
                    quantity: 1
                }],
                special_instructions: payload.service?.product_description || '',
                total_amount: payload.service?.cod_amount_expected || 0,
                delivery_fee: deliveryFee,
                status: 'pending'
            }])
            .select('id')
            .single()

        if (orderError) throw orderError

        // Retorna éxito con el ID de la orden interna
        return new Response(JSON.stringify({
            success: true,
            message: 'Orden creada exitosamente e ingresada al OMS',
            internal_order_id: order.id
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
