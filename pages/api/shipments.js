// pages/api/shipments.js
import { sb } from '../../services/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('shipments')
      .select(`
        id,
        shipping_order_id,
        eta,
        containers:containers_tracking( id, container_no, status, gate_in_time, truck_no )
      `)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { shipping_order_id, eta, container_nos } = req.body;
    const { data: [ shipment ], error: shipErr } = await sb
      .from('shipments')
      .insert({ shipping_order_id, eta })
      .select('id');
    if (shipErr) return res.status(500).json({ error: shipErr.message });

    const containers = container_nos.map(no => ({
      shipment_id: shipment.id,
      container_no: no.trim(),
    }));
    const { error: contErr } = await sb
      .from('containers_tracking')
      .insert(containers);
    if (contErr) return res.status(500).json({ error: contErr.message });

    return res.status(201).json({ success: true });
  }

  res.setHeader('Allow', ['GET','POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
