// pages/dashboard.js
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  const [pending, setPending]   = useState([])
  const [selected, setSelected] = useState(new Set())
  const [results, setResults]   = useState({})
  const [running, setRunning]   = useState(false)
  const SCRAPER_URL             = process.env.NEXT_PUBLIC_SCRAPER_URL

  // Load only those containers still missing gate-in or truck
  useEffect(() => {
    fetchPending()
  }, [])

  async function fetchPending() {
    const { data, error } = await supabase
      .from('containers_tracking')
      .select('container_no')
      .is('gate_in_time', null)
      .is('truck_no', null)

    if (error) {
      console.error('Error loading pending list:', error)
    } else {
      setPending(data.map(r => r.container_no))
    }
  }

  function toggle(id) {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  async function runBatch() {
    if (!selected.size) return
    setRunning(true)
    const ids = Array.from(selected)

    // 1) Call scraper service
    const resp = await fetch(`${SCRAPER_URL}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containers: ids }),
    })
    if (!resp.ok) {
      console.error('Scraper error:', await resp.text())
      setRunning(false)
      return
    }
    const data = await resp.json() // [{ container, gateInTime, truckOrVessel, skipped }, ...]

    // 2) Write each successful result back to Supabase
    for (const { container, gateInTime, truckOrVessel, skipped } of data) {
      if (skipped || !gateInTime) continue

      const { error: updErr } = await supabase
        .from('containers_tracking')
        .update({
          gate_in_time: gateInTime,
          truck_no:     truckOrVessel,
        })
        .eq('container_no', container)

      if (updErr) {
        console.error(`DB update failed for ${container}:`, updErr)
      } else {
        console.log(`DB updated ${container} → ${gateInTime} / ${truckOrVessel}`)
      }
    }

    // 3) Show results in the UI
    const map = {}
    data.forEach(r => {
      map[r.container] = r
    })
    setResults(map)

    // 4) Refresh the pending list and clear selections
    await fetchPending()
    setSelected(new Set())
    setRunning(false)
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Pending Containers Queue</h1>

      <button
        onClick={runBatch}
        disabled={running || selected.size === 0}
        style={{ marginBottom: 16 }}
      >
        {running
          ? `Running…`
          : `Scrape ${selected.size} container${selected.size > 1 ? 's' : ''}`}
      </button>

      <table
        border="1"
        cellPadding="8"
        style={{ width: '100%', borderCollapse: 'collapse' }}
      >
        <thead>
          <tr>
            <th></th>
            <th>Container #</th>
            <th>Gate-In Time</th>
            <th>Truck / Vessel</th>
          </tr>
        </thead>
        <tbody>
          {pending.map(id => {
            const res = results[id] || {}
            return (
              <tr key={id}>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selected.has(id)}
                    onChange={() => toggle(id)}
                  />
                </td>
                <td>{id}</td>
                <td>
                  {res.skipped
                    ? 'Already done'
                    : res.gateInTime
                      ? <>✔ {res.gateInTime}</>
                      : ''}
                </td>
                <td>{res.skipped ? '-' : (res.truckOrVessel || '')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
