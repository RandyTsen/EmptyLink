"use client"

import { formatDate } from "@/utils/formatters"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Truck, Calendar, Package } from "lucide-react"
import Link from "next/link"

interface Container {
  id: string
  container_no: string
  status: string
  gate_in_time: string | null
  truck_no: string | null
  shipment_id: string
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
  const getStatusBadgeClass = (status: string): string => {
    const statusLower = status.toLowerCase()

    if (statusLower.includes("delivered")) {
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

  return (
    <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
      <Link href={`/shipment/${shipment.id}`}>
        <CardHeader className="bg-slate-800 text-white p-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold flex items-center">
                <Package className="mr-2 h-5 w-5" />
                {shipment.shipping_order_id}
              </h2>
              <p className="text-sm flex items-center mt-1">
                <Calendar className="mr-2 h-4 w-4" />
                ETA: {shipment.eta ? formatDate(shipment.eta) : "Not available"}
              </p>
            </div>
            <Badge variant="outline" className="text-white border-white">
              {shipment.containers.length} Container{shipment.containers.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>
      </Link>

      <CardContent className="p-0">
        {shipment.containers.length === 0 ? (
          <div className="p-4 text-center text-gray-500 italic">No containers found for this shipment.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Container No</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gate In Time</TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      <Truck className="mr-1 h-4 w-4" />
                      Truck No
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipment.containers.map((container) => (
                  <TableRow key={container.id}>
                    <TableCell className="font-medium">{container.container_no}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeClass(container.status)}>{container.status}</Badge>
                    </TableCell>
                    <TableCell>{container.gate_in_time ? formatDate(container.gate_in_time) : "N/A"}</TableCell>
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
