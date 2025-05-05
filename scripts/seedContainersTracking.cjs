// scripts/seedContainersTracking.cjs
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

;(async () => {
  // 1) pick an existing shipment ID from your shipments table
  const { data: shipments, error: sErr } = await supabase
    .from('shipments')
    .select('id')
    .limit(1)

  if (sErr || !shipments || shipments.length === 0) {
    console.error('❌ Could not load any shipment IDs to seed with', sErr)
    process.exit(1)
  }

  const shipmentId = shipments[0].id
  const now = new Date().toISOString()

  // 2) upsert into containers_tracking
  const payload = {
    shipment_id:   shipmentId,
    container_no:  'CAIU4702199',
    status:        'Gate-in',
    gate_in_time:  now,
    truck_no:      'TEST123',
  }

  const { data, error } = await supabase
    .from('containers_tracking')
    .upsert(payload, { onConflict: ['container_no'] })

  if (error) {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  }

  console.log('✅ Seed succeeded:', data)
  process.exit(0)
})()
