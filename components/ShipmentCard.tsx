"use client"

import { formatDate } from "@/utils/formatters"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar, Package, Ship, Edit } from "lucide-react"
import Link from "next/link"

interface Container {
  id: string
  container_no: string
  container_type: string
  status: string
  gate_in_time: string | null
  truck_no: string | null
  shipment_id: string
}

interface Shipment {
  id: string
  shipping_order_id: string
  vessel: string | null
  eta: string | null
  containers: Container[]
}

interface ShipmentCardProps {
  shipment: Shipment
}

export default function ShipmentCard({ shipment }: ShipmentCardProps) {
  const getStatusBadgeClass = (status: string): string => {
    const statusLower = status.toLowerCase()

    if (statusLower.includes("delivered") || statusLower === "gate in") {
      return "bg-green-100 text-green-800 hover:bg-green-200"
    } else if (statusLower.includes("transit")) {
      return "bg-blue-100 text-blue-800 hover:bg-blue-200"
    } else if (statusLower.includes("delay") || statusLower.includes("hold")) {
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
    } else if (statusLower.includes("problem") || statusLower.includes("damage")) {
      return "bg-red-100 text-red-800 hover:bg-red-200"
    } else {
      return "bg-gray-100 text-gray-800 hover:bg-gray-200"
    }
  }

  // Calculate container status counts
  const containerCounts = {
    total: shipment.containers.length,
    delivered: shipment.containers.filter(
      (c) => c.status.toLowerCase() === "delivered" || c.status.toLowerCase() === "gate in",
    ).length,
    inTransit: shipment.containers.filter((c) => c.status.toLowerCase() === "in transit").length,
    delayed: shipment.containers.filter((c) => c.status.toLowerCase() === "delayed").length,
    pending: shipment.containers.filter((c) => c.status.toLowerCase() === "pending").length,
  }

  const completionPercentage =
    containerCounts.total > 0 ? Math.round((containerCounts.delivered / containerCounts.total) * 100) : 0

  // Generate a gradient color based on completion percentage
  const getGradientColor = () => {
    if (completionPercentage >= 75) {
      return "from-teal-600 to-teal-700"
    } else if (completionPercentage >= 50) {
      return "from-cyan-600 to-cyan-700"
    } else if (completionPercentage >= 25) {
      return "from-blue-600 to-blue-700"
    } else {
      return "from-indigo-600 to-indigo-700"
    }
  }

  return (
    <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 h-full">
      <CardHeader className={`bg-gradient-to-r ${getGradientColor()} text-white p-4`}>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              <h2 className="text-xl font-bold">{shipment.shipping_order_id}</h2>
            </div>
            <div className="flex flex-col gap-1 mt-1 text-sm">
              <p className="flex items-center">
                <Calendar className="mr-1 h-4 w-4" />
                {shipment.eta ? formatDate(shipment.eta) : "ETA: N/A"}
              </p>
              {shipment.vessel && (
                <p className="flex items-center">
                  <Package className="mr-1 h-4 w-4" />
                  Vessel: {shipment.vessel}
                </p>
              )}
            </div>
          </div>
          <Link href={`/shipment/${shipment.id}/edit`}>
            <button className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
              <Edit className="h-4 w-4 text-white" />
            </button>
          </Link>
        </div>
        <div className="mt-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              Total: {containerCounts.total} | Pending: {containerCounts.pending} | Completion: {completionPercentage}%
            </div>
          </div>
          <div className="w-full mt-1 bg-white/30 rounded-full h-2.5">
            <div className="bg-white h-2.5 rounded-full" style={{ width: `${completionPercentage}%` }}></div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {containerCounts.total === 0 ? (
          <div className="p-4 text-center text-gray-500 italic">No containers found for this shipment.</div>
        ) : (
          <div className="overflow-x-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Container</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Truck Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipment.containers.map((container) => (
                  <TableRow key={container.id}>
                    <TableCell className="font-medium">{container.container_no}</TableCell>
                    <TableCell>{container.container_type || "N/A"}</TableCell>
                    <TableCell>
                      {container.status ? (
                        <Badge className={getStatusBadgeClass(container.status)}>{container.status}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{container.gate_in_time ? formatDate(container.gate_in_time) : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
