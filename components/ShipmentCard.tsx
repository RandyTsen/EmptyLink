"use client"

import { formatDate } from "@/utils/formatters"

interface Container {
  id: string
  container_no: string
  status: string
  gate_in_time: string | null
  truck_no: string | null
}

interface Shipment {
  id: string
  shipping_order_id: string
  eta: string | null
  containers: Container[]
}

interface ShipmentCardProps {
  shipment: Shipment
}

export default function ShipmentCard({ shipment }: ShipmentCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-blue-600 text-white p-4">
        <h2 className="text-xl font-bold">Shipment #{shipment.shipping_order_id}</h2>
        <p className="text-sm">ETA: {shipment.eta ? formatDate(shipment.eta) : "Not available"}</p>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2">Containers ({shipment.containers.length})</h3>

        {shipment.containers.length === 0 ? (
          <p className="text-gray-500 italic">No containers found for this shipment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Container No
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gate In Time
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Truck No
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shipment.containers.map((container) => (
                  <tr key={container.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      {container.container_no}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(container.status)}`}
                      >
                        {container.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {container.gate_in_time ? formatDate(container.gate_in_time) : "N/A"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{container.truck_no || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "delivered":
      return "bg-green-100 text-green-800"
    case "in transit":
      return "bg-blue-100 text-blue-800"
    case "delayed":
      return "bg-yellow-100 text-yellow-800"
    case "pending":
      return "bg-gray-100 text-gray-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}
