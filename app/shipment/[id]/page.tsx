"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getShipmentById } from "@/services/dbService"
import { formatDate } from "@/utils/formatters"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Package, Calendar, Truck, AlertCircle, Edit, Ship } from "lucide-react"
import Link from "next/link"

export default function ShipmentDetailPage() {
  const router = useRouter()
  const { id } = useParams()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadShipment() {
      try {
        setLoading(true)
        const data = await getShipmentById(id)
        setShipment(data)
        setError(null)
      } catch (err) {
        console.error("Error fetching shipment:", err)
        setError("Failed to load shipment details. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadShipment()
    }
  }, [id])

  const getStatusBadgeClass = (status) => {
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

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Button variant="ghost" className="mb-6 flex items-center gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />

          <Card className="mt-8">
            <CardHeader>
              <Skeleton className="h-8 w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Button variant="ghost" className="mb-6 flex items-center gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-bold">Error</p>
            <p>{error}</p>
            <Button onClick={() => router.refresh()} className="mt-2 bg-red-600 text-white hover:bg-red-700">
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="container mx-auto p-4">
        <Button variant="ghost" className="mb-6 flex items-center gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p>Shipment not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <Button variant="ghost" className="mb-6 flex items-center gap-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" />
        Back to Shipments
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Ship className="mr-2 h-6 w-6" />
            Shipment #{shipment.shipping_order_id}
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1 text-gray-500">
            <p className="flex items-center">
              <Calendar className="mr-2 h-4 w-4" />
              ETA: {shipment.eta ? formatDate(shipment.eta) : "Not available"}
            </p>
            {shipment.vessel && (
              <p className="flex items-center">
                <Package className="mr-2 h-4 w-4" />
                Vessel: {shipment.vessel}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="text-lg py-1 px-3">
            {shipment.containers.length} Container{shipment.containers.length !== 1 ? "s" : ""}
          </Badge>
          <Link href={`/shipment/${id}/manage`}>
            <Button className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Manage Containers
            </Button>
          </Link>
        </div>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Container Details</CardTitle>
        </CardHeader>
        <CardContent>
          {shipment.containers.length === 0 ? (
            <div className="text-center text-gray-500 italic py-8">
              No containers found for this shipment.
              <div className="mt-4">
                <Link href={`/shipment/${id}/manage`}>
                  <Button>Add Containers</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Container No</TableHead>
                    <TableHead>Container Type</TableHead>
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
                      <TableCell>{container.container_type || "Not specified"}</TableCell>
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
    </div>
  )
}
