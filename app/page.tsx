"use client"

import { useEffect, useState } from "react"
import ShipmentCard from "@/components/ShipmentCard"
import { getShipmentsWithTracking } from "@/services/dbService"

export default function Home() {
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const data = await getShipmentsWithTracking()
      setShipments(data)
      setError(null)
    } catch (err) {
      console.error("Error fetching shipments:", err)
      setError("Failed to load shipments. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Auto-refresh every 10 minutes (600000 ms)
    const intervalId = setInterval(fetchData, 600000)

    // Clean up interval on component unmount
    return () => clearInterval(intervalId)
  }, [])

  if (loading && !shipments.length) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Container Tracker</h1>
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">Loading shipments...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Container Tracker</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
          <button onClick={fetchData} className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Container Tracker</h1>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Refresh Data
          </button>
          <p className="text-sm text-gray-500">Auto-refreshes every 10 minutes</p>
        </div>
      </div>

      {shipments.length === 0 ? (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p>No shipments found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shipments.map((shipment) => (
            <ShipmentCard key={shipment.id} shipment={shipment} />
          ))}
        </div>
      )}
    </div>
  )
}
