"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getShipmentsWithTracking } from "@/services/dbService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Search, Filter, Plus, Edit, Ship, Calendar, Package, BarChart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/utils/formatters"

// Auto-refresh interval in milliseconds (10 minutes)
const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000

export default function Home() {
  const [shipments, setShipments] = useState([])
  const [filteredShipments, setFilteredShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [lastRefreshed, setLastRefreshed] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchData = async () => {
    try {
      setIsRefreshing(true)
      const data = await getShipmentsWithTracking()
      setShipments(data)
      setLastRefreshed(new Date())
      setError(null)
    } catch (err) {
      console.error("Error fetching shipments:", err)
      setError("Failed to load shipments. Please try again later.")
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Auto-refresh every 10 minutes
    const intervalId = setInterval(fetchData, AUTO_REFRESH_INTERVAL)

    // Clean up interval on component unmount
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    // Filter shipments based on search term and status filter
    let filtered = [...shipments]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (shipment) =>
          shipment.shipping_order_id.toLowerCase().includes(term) ||
          (shipment.vessel && shipment.vessel.toLowerCase().includes(term)) ||
          shipment.containers.some(
            (container) =>
              container.container_no.toLowerCase().includes(term) ||
              (container.truck_no && container.truck_no.toLowerCase().includes(term)),
          ),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((shipment) =>
        shipment.containers.some((container) => container.status.toLowerCase() === statusFilter.toLowerCase()),
      )
    }

    setFilteredShipments(filtered)
  }, [shipments, searchTerm, statusFilter])

  const formatRefreshTime = (date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

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

  const calculateShipmentStats = (shipment) => {
    const total = shipment.containers.length
    const completed = shipment.containers.filter(
      (c) => c.status.toLowerCase() === "delivered" || c.status.toLowerCase() === "gate in",
    ).length
    const inTransit = shipment.containers.filter((c) => c.status.toLowerCase() === "in transit").length
    const delayed = shipment.containers.filter((c) => c.status.toLowerCase() === "delayed").length
    const pending = shipment.containers.filter((c) => c.status.toLowerCase() === "pending").length
    const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      total,
      completed,
      inTransit,
      delayed,
      pending,
      completionPercentage,
    }
  }

  const renderShipmentSkeletons = () => {
    return Array(3)
      .fill(0)
      .map((_, index) => (
        <div key={index} className="min-w-[400px] w-[400px]">
          <Card className="h-full">
            <CardHeader className="bg-slate-100 p-4">
              <div className="flex justify-between">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="flex gap-4 mt-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Skeleton className="h-[400px] w-full" />
            </CardContent>
          </Card>
        </div>
      ))
  }

  if (loading && !shipments.length) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Container Tracker</h1>
        <div className="flex gap-6 overflow-x-auto pb-4">{renderShipmentSkeletons()}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Container Tracker</h1>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Last updated: {formatRefreshTime(lastRefreshed)}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isRefreshing}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Badge variant="outline">Auto-refreshes every 10 minutes</Badge>
        </div>
      </div>

      {error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p>{error}</p>
          <Button onClick={fetchData} className="mt-2 bg-red-600 text-white hover:bg-red-700">
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search by order ID, vessel, container or truck number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 min-w-[200px]">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="gate in">Gate In</SelectItem>
                  <SelectItem value="in transit">In Transit</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Link href="/analytics">
                <Button variant="outline" className="flex items-center gap-1">
                  <BarChart className="h-4 w-4" />
                  Analytics
                </Button>
              </Link>
              <Link href="/shipping-orders/new">
                <Button className="flex items-center gap-1">
                  <Plus className="h-4 w-4" />
                  New Shipping Order
                </Button>
              </Link>
            </div>
          </div>

          {filteredShipments.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-8 rounded text-center">
              {searchTerm || statusFilter !== "all" ? (
                <>
                  <p className="text-lg font-medium">No shipments match your filters</p>
                  <p className="mt-2">Try adjusting your search criteria or filters</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setSearchTerm("")
                      setStatusFilter("all")
                    }}
                  >
                    Clear Filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">No shipments found.</p>
                  <Link href="/shipping-orders/new" className="mt-4 inline-block">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Shipping Order
                    </Button>
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="flex gap-6 overflow-x-auto pb-4">
              {filteredShipments.map((shipment) => {
                const stats = calculateShipmentStats(shipment)

                return (
                  <Card
                    key={shipment.id}
                    className="min-w-[400px] w-[400px] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
                  >
                    <CardHeader className="bg-slate-800 text-white p-4">
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
                            Total: {stats.total} | Pending: {stats.pending} | Completion: {stats.completionPercentage}%
                          </div>
                        </div>
                        <div className="w-full mt-1 bg-gray-700 rounded-full h-2.5">
                          <div
                            className="bg-green-500 h-2.5 rounded-full"
                            style={{ width: `${stats.completionPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
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
                            {shipment.containers.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-gray-500 py-4">
                                  No containers found
                                </TableCell>
                              </TableRow>
                            ) : (
                              shipment.containers.map((container) => (
                                <TableRow key={container.id}>
                                  <TableCell className="font-medium">{container.container_no}</TableCell>
                                  <TableCell>{container.container_type || "N/A"}</TableCell>
                                  <TableCell>
                                    {container.status ? (
                                      <Badge className={getStatusBadgeClass(container.status)}>
                                        {container.status}
                                      </Badge>
                                    ) : (
                                      "-"
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {container.gate_in_time ? formatDate(container.gate_in_time) : "-"}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
