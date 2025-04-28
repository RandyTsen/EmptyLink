// pages/index.js
import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch function
  async function loadShipments() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/shipments')
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setShipments(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // On mount + auto‐refresh
  useEffect(() => {
    loadShipments()
    const id = setInterval(loadShipments, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Container Tracker</h1>
        <button
          onClick={loadShipments}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? 'Refreshing…' : 'Refresh Data'}
        </button>
      </div>

      {error && (
        <div className="bg-red-200 text-red-800 p-4 mb-6 rounded">
          Failed to load shipments: {error}
        </div>
      )}

      <div className="space-y-8">
        {shipments.map((s) => (
          <div key={s.id} className="border shadow rounded overflow-hidden">
            <div className="bg-blue-600 text-white px-6 py-4">
              <h2 className="text-xl font-semibold">
                Shipment #{s.shipping_order_id}
              </h2>
              <p className="text-sm">
                ETA:{' '}
                {new Date(s.eta).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
            <div className="p-6 bg-white">
              <h3 className="font-medium mb-2">
                Containers ({s.containers.length})
              </h3>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2">Container No</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Gate In Time</th>
                    <th className="py-2">Truck No</th>
                  </tr>
                </thead>
                <tbody>
                  {s.containers.map((c) => (
                    <tr key={c.id} className="border-b even:bg-gray-50">
                      <td className="py-2">{c.container_no}</td>
                      <td className="py-2 capitalize">
                        {c.status.replace('-', ' ')}
                      </td>
                      <td className="py-2">
                        {c.gate_in_time
                          ? new Date(c.gate_in_time).toLocaleString(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : 'N/A'}
                      </td>
                      <td className="py-2">{c.truck_no || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {shipments.length === 0 && !loading && (
          <p className="text-gray-500">No shipments yet.</p>
        )}
      </div>
    </div>
  )
}
