// pages/api/container/[id]/status.js
import { getLatestStatus } from '@/lib/supabaseClient'

export default async function handler(req, res) {
  const {
    query: { id: containerNumber },
    method,
  } = req

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!containerNumber) {
    return res.status(400).json({ error: 'Container number is required' })
  }

  // This now returns { status, gateInTime, lastChecked, truckNumber }
  const statusRecord = await getLatestStatus(containerNumber)
  if (!statusRecord) {
    return res
      .status(404)
      .json({ error: 'No status found for ' + containerNumber })
  }

  return res.status(200).json({
    container:    containerNumber,
    status:       statusRecord.status,
    gateInTime:   statusRecord.gateInTime,
    truckNumber:  statusRecord.truckNumber, 
    lastChecked:  statusRecord.lastChecked,
  })
}
