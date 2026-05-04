import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const PEACH_SECRET = Deno.env.get('PEACH_SECRET') || ''
const PEACH_ENTITY_ID = Deno.env.get('PEACH_ENTITY_ID') || ''
const PEACH_MODE = Deno.env.get('PEACH_MODE') || 'test'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/payments', '')
    const method = req.method

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // POST /payments/peach/webhook
    if (path === '/peach/webhook' && method === 'POST') {
      const body = await req.json()
      
      // Verify webhook signature (simplified - implement proper verification)
      const signature = req.headers.get('x-peach-signature')
      if (!signature) {
        return new Response(
          JSON.stringify({ error: 'Missing signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Process webhook based on event type
      if (body.event_type === 'payment.completed') {
        const { user_id, plan_tier, billing_cycle, amount, transaction_id } = body.data
        
        // Update user subscription
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            plan_tier,
            billing_cycle,
            plan_period_end: periodEnd,
            updated_at: new Date().toISOString()
          })
          .eq('id', user_id)

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Record payment
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            user_id,
            plan_tier,
            billing_cycle,
            amount_zar: amount,
            peach_transaction_id: transaction_id,
            status: 'completed'
          })

        if (paymentError) {
          return new Response(
            JSON.stringify({ error: paymentError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /payments/peach/create
    if (path === '/peach/create' && method === 'POST') {
      const { plan_tier, billing_cycle, amount_zar, user_email, return_url } = await req.json()
      
      // Create Peach Payment checkout
      const peachPayload = {
        entity_id: PEACH_ENTITY_ID,
        amount: amount_zar * 100, // Convert to cents
        currency: 'ZAR',
        payment_type: 'card',
        merchant_reference: `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payments/peach/webhook`,
        return_url,
        cancel_url: return_url,
        billing_details: {
          email: user_email
        },
        custom_metadata: {
          plan_tier,
          billing_cycle,
          user_email
        }
      }

      // Make request to Peach Payments API
      const peachResponse = await fetch(`https://api.peachpayments.com/v1/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PEACH_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(peachPayload)
      })

      const peachData = await peachResponse.json()

      if (!peachResponse.ok) {
        return new Response(
          JSON.stringify({ error: peachData.error || 'Payment creation failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          checkout_id: peachData.id,
          redirect_url: peachData.redirect_url
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
