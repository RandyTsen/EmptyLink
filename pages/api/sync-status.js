// pages/api/sync-status.js
import { sb } from '../../services/supabaseClient';
import { updateContainerTracking } from '../../services/dbService';
import { checkContainerStatus } from '../../services/containerServices';

export default async function handler(req, res) {
  // 1) fetch all pending containers
  const { data: items, error } = await sb
    .from('containers_tracking')
    .select('id, container_no')
    .eq('status', 'pending');
  if (error) return res.status(500).json({ error: error.message });

  // 2) scrape each for Gate-In
  for (const { id, container_no } of items) {
    const { gateInTime, truckNo } = await checkContainerStatus(container_no);
    if (gateInTime) {
      await updateContainerTracking(id, {
        status:       'in-gate',
        gate_in_time: gateInTime,
        truck_no:     truckNo,
        last_checked: new Date()
      });
    }
  }

  return res.status(200).json({ processed: items.length });
}
