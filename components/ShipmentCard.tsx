"use client"

import { useState } from "react"
import { formatDate } from "@/utils/formatters"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Package, Ship, Edit, CheckCircle, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { updateShipmentArchiveStatus } from "@/services/dbService"
import { differenceInDays } from "date-fns"
import { cn } from "@/lib/utils"

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
  archived?: boolean
}

interface ShipmentCardProps {
  shipment: Shipment
  onArchive?: (shipmentId: string) => void
  className?: string
}

export default function ShipmentCard({ shipment, onArchive, className }: ShipmentCardProps) {
  const [isArchiving, setIsArchiving] = useState(false)

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

  const isCompleted = completionPercentage === 100

  // Calculate days until ETA for priority coloring
  const calculateDaysUntilEta = () => {
    if (!shipment.eta) return null

    const etaDate = new Date(shipment.eta)
    const today = new Date()
    return differenceInDays(etaDate, today)
  }

  const daysUntilEta = calculateDaysUntilEta()

  // Generate a gradient color based on time priority and completion
  const getGradientColor = () => {
    // If completed, use grey
    if (isCompleted) {
      return "from-gray-500 to-gray-600"
    }

    // If no ETA, use default blue
    if (daysUntilEta === null) {
      return "from-blue-600 to-blue-700"
    }

    // Priority based on days until ETA
    if (daysUntilEta < 0) {
      // Past due date
      return "from-red-600 to-red-700"
    } else if (daysUntilEta < 3) {
      // Approaching due date (less than 3 days)
      return "from-amber-600 to-amber-700"
    } else if (daysUntilEta < 7) {
      // Getting closer (less than a week)
      return "from-yellow-600 to-yellow-700"
    } else {
      // Plenty of time (more than a week)
      return "from-green-600 to-green-700"
    }
  }

  const handleArchive = async () => {
    if (!isCompleted) return

    try {
      setIsArchiving(true)
      await updateShipmentArchiveStatus(shipment.id, true)
      if (onArchive) {
        onArchive(shipment.id)
      }
    } catch (error) {
      console.error("Error archiving shipment:", error)
    } finally {
      setIsArchiving(false)
    }
  }

  return (
    <Card className={cn("shadow-md hover:shadow-lg transition-shadow duration-300 h-full", className)}>
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
                {daysUntilEta !== null && daysUntilEta < 0 && (
                  <span className="ml-2 flex items-center text-yellow-200">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Overdue
                  </span>
                )}
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
        {isCompleted && (
          <div className="mt-3">
            <Button
              onClick={handleArchive}
              disabled={isArchiving}
              className="w-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {isArchiving ? "Archiving..." : "Mark as Complete & Archive"}
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {containerCounts.total === 0 ? (
          <div className="p-4 text-center text-gray-500 italic">No containers found for this shipment.</div>
        ) : (
          <div className="w-full">
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border-b px-2 py-2 text-left text-xs font-semibold">Container</th>
                  <th className="border-b px-2 py-2 text-left text-xs font-semibold">Type</th>
                  <th className="border-b px-2 py-2 text-left text-xs font-semibold">Truck</th>
                  <th className="border-b px-2 py-2 text-left text-xs font-semibold">Time</th>
                  <th className="border-b px-2 py-2 text-center text-xs font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {shipment.containers.map((container) => (
                  <tr key={container.id} className="hover:bg-gray-50">
                    <td className="border-b px-2 py-2 text-xs font-medium">{container.container_no}</td>
                    <td className="border-b px-2 py-2 text-xs">{container.container_type || "N/A"}</td>
                    <td className="border-b px-2 py-2 text-xs">{container.truck_no || "N/A"}</td>
                    <td className="border-b px-2 py-2 text-xs">
                      {container.gate_in_time ? formatDate(container.gate_in_time) : "-"}
                    </td>
                    <td className="border-b px-2 py-2 text-center">
                      {container.status.toLowerCase() === "pending" ? "🕓" : "✅"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
