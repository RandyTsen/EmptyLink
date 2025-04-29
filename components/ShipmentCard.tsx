"use client"

import { formatDate } from "@/utils/formatters"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Truck, Calendar, Package, Ship } from "lucide-react"
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

  return (
    <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 h-full">
      <CardHeader className="bg-slate-800 text-white p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center">
              <Ship className="mr-2 h-5 w-5" />
              {shipment.shipping_order_id}
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1 text-sm">
              <p className="flex items-center">
                <Calendar className="mr-1 h-4 w-4" />
                {shipment.eta ? formatDate(shipment.eta) : "ETA: N/A"}
              </p>
              {shipment.vessel && (
                <p className="flex items-center">
                  <Package className="mr-1 h-4 w-4" />
                  {shipment.vessel}
                </p>
              )}
            </div>
          </div>
          <Badge variant="outline" className="text-white border-white">
            {containerCounts.total} Container{containerCounts.total !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {containerCounts.total === 0 ? (
          <div className="p-4 text-center text-gray-500 italic">No containers found for this shipment.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Container No</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      <Truck className="mr-1 h-4 w-4" />
                      Truck
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipment.containers.map((container) => (
                  <TableRow key={container.id}>
                    <TableCell className="font-medium">
                      <Link href={`/shipment/${shipment.id}`} className="hover:underline">
                        {container.container_no}
                      </Link>
                    </TableCell>
                    <TableCell>{container.container_type || "N/A"}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeClass(container.status)}>{container.status}</Badge>
                    </TableCell>
                    <TableCell>{container.truck_no || "N/A"}</TableCell>
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
