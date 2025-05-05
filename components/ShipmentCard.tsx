"use client"

import { useState } from "react"
import { formatDate } from "@/utils/formatters"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  Package,
  Ship,
  Edit,
  CheckCircle,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { updateShipmentArchiveStatus } from "@/services/dbService"
import { differenceInDays } from "date-fns"
import { cn } from "@/lib/utils"

interface Container {
  id: string
  container_no: string
  container_type: string
  gate_in_time: string | null
  truck_no: string | null
}

interface Shipment {
  id: string
  shipping_order_id: string
  vessel: string | null
  eta: string | null
  containers: Container[]
}

interface Props {
  shipment: Shipment
  onArchive?: (id: string) => void
}

export default function ShipmentCard({ shipment, onArchive }: Props) {
  const [isArchiving, setIsArchiving] = useState(false)

  // recompute delivered/pending strictly by gate_in_time
  const total = shipment.containers.length
  const delivered = shipment.containers.filter(c => !!c.gate_in_time).length
  const pending   = total - delivered
  const completion = total > 0 ? Math.round((delivered / total) * 100) : 0
  const isDone = completion === 100

  // ETA coloring
  const daysLeft = shipment.eta
    ? differenceInDays(new Date(shipment.eta), new Date())
    : null
  const gradient = isDone
    ? "from-gray-500 to-gray-600"
    : daysLeft === null
    ? "from-blue-600 to-blue-700"
    : daysLeft < 0
    ? "from-red-600 to-red-700"
    : daysLeft < 3
    ? "from-amber-600 to-amber-700"
    : daysLeft < 7
    ? "from-yellow-600 to-yellow-700"
    : "from-green-600 to-green-700"

  const handleArchive = async () => {
    if (!isDone) return
    setIsArchiving(true)
    await updateShipmentArchiveStatus(shipment.id, true)
    onArchive?.(shipment.id)
    setIsArchiving(false)
  }

  return (
    <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className={cn(`bg-gradient-to-r ${gradient} p-4 text-white`)}>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              <h2 className="text-xl font-bold">
                {shipment.shipping_order_id}
              </h2>
            </div>
            <div className="mt-1 text-sm space-y-1">
              <p className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {shipment.eta ? formatDate(shipment.eta) : "ETA: N/A"}
                {daysLeft !== null && daysLeft < 0 && (
                  <span className="flex items-center text-yellow-200 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Overdue
                  </span>
                )}
              </p>
              {shipment.vessel && (
                <p className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  Vessel: {shipment.vessel}
                </p>
              )}
            </div>
          </div>
          <Link href={`/shipment/${shipment.id}/edit`}>
            <button className="p-1.5 rounded-full bg-white/20 hover:bg-white/30">
              <Edit className="h-4 w-4 text-white" />
            </button>
          </Link>
        </div>

        {/* Progress bar + counts */}
        <div className="mt-3 text-sm">
          <div>
            Total: {total} | Pending: {pending} | Completion: {completion}%
          </div>
          <div className="mt-1 h-2.5 w-full bg-white/30 rounded-full">
            <div
              className="h-2.5 bg-white rounded-full"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        {/* Archive CTA */}
        {isDone && (
          <Button
            onClick={handleArchive}
            disabled={isArchiving}
            className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {isArchiving ? "Archiving…" : "Mark as Complete & Archive"}
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {total === 0 ? (
          <div className="p-4 text-center text-gray-500 italic">
            No containers found.
          </div>
        ) : (
          <table className="w-full table-auto">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-1/5 px-2 py-2 text-left text-xs font-semibold">
                  Container
                </th>
                <th className="w-1/6 px-2 py-2 text-left text-xs font-semibold">
                  Type
                </th>
                <th className="w-1/6 px-2 py-2 text-left text-xs font-semibold">
                  Truck
                </th>
                <th className="w-1/5 px-2 py-2 text-left text-xs font-semibold">
                  Time
                </th>
                <th className="w-1/6 px-2 py-2 text-center text-xs font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {shipment.containers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2 text-xs font-medium whitespace-nowrap">
                    {c.container_no}
                  </td>
                  <td className="px-2 py-2 text-xs whitespace-nowrap">
                    {c.container_type || "N/A"}
                  </td>
                  <td className="px-2 py-2 text-xs whitespace-nowrap">
                    {c.truck_no || "N/A"}
                  </td>
                  <td className="px-2 py-2 text-xs whitespace-nowrap">
                    {c.gate_in_time ? formatDate(c.gate_in_time) : "-"}
                  </td>
                  <td className="px-2 py-2 text-center text-xs">
                    {c.gate_in_time ? "✅" : "🕓"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
