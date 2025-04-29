"use client"

import { useRef } from "react"
import ShipmentCard from "./ShipmentCard"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ShipmentListProps {
  shipments: any[]
  onArchive: (shipmentId: string) => void
  className?: string
}

export default function ShipmentList({ shipments, onArchive, className }: ShipmentListProps) {
  const ref = useRef<HTMLDivElement>(null)

  function scroll(offset: number) {
    ref.current?.scrollBy({ left: offset, behavior: "smooth" })
  }

  if (shipments.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-8 rounded text-center">
        <p className="text-lg font-medium">No shipments found</p>
        <p className="mt-2">Create a new shipping order to get started</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <Button
        onClick={() => scroll(-ref.current!.clientWidth)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white rounded-full shadow-md hover:bg-gray-50"
        size="icon"
        variant="ghost"
      >
        <ChevronLeft className="h-6 w-6" />
        <span className="sr-only">Scroll left</span>
      </Button>

      <div ref={ref} className={cn("shipments-wrapper", className || "grid-cols-3")}>
        {shipments.map((shipment) => (
          <ShipmentCard key={shipment.id} shipment={shipment} onArchive={onArchive} className="shipment-card" />
        ))}
      </div>

      <Button
        onClick={() => scroll(ref.current!.clientWidth)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white rounded-full shadow-md hover:bg-gray-50"
        size="icon"
        variant="ghost"
      >
        <ChevronRight className="h-6 w-6" />
        <span className="sr-only">Scroll right</span>
      </Button>
    </div>
  )
}
