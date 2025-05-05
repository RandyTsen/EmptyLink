// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Fetch the current status for a given container.
 * @param {string} containerNo
 * @returns {Promise<{ status: string; gateInTime: string|null; truckNumber: string|null } | null>}
 */
export async function getLatestStatus(containerNo) {
  const { data, error } = await supabase
    .from('containers_tracking')
    .select('status, gate_in_time, truck_no')
    .eq('container_no', containerNo)
    .single()

  if (error || !data) {
    console.error('getLatestStatus error:', error)
    return null
  }

  return {
    status:      data.status,
    gateInTime:  data.gate_in_time,
    truckNumber: data.truck_no,
  }
}

/**
 * Insert or update (upsert) a tracking record for a container.
 * @param {object} params
 * @param {string} params.shipmentId     – the UUID of the shipment/order
 * @param {string} params.containerNo
 * @param {string} params.status
 * @param {string|null} params.gateInTime   – ISO timestamp when gate-in occurred
 * @param {string|null} params.truckNumber
 */
export async function upsertStatus({
  shipmentId,
  containerNo,
  status,
  gateInTime = null,
  truckNumber = null,
}) {
  const payload = {
    shipment_id:  shipmentId,
    container_no: containerNo,
    status,
    gate_in_time: gateInTime,
    truck_no:     truckNumber,
  }

  const { error } = await supabase
    .from('containers_tracking')
    .upsert(payload, { onConflict: ['container_no'] })

  if (error) {
    console.error('upsertStatus error:', error)
  }
}

/**
 * List all container numbers for a shipment that have not yet been gate-in.
 * @param {string} shipmentId
 * @returns {Promise<string[]>} array of container numbers
 */
export async function getPendingContainers(shipmentId) {
  const { data, error } = await supabase
    .from('containers_tracking')
    .select('container_no')
    .eq('shipment_id', shipmentId)
    .is('gate_in_time', null)

  if (error) {
    console.error('getPendingContainers error:', error)
    return []
  }
  return data.map((row) => row.container_no)
}
