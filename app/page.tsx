"use client"

import { useEffect, useState } from "react"
import ShipmentCard from "@/components/ShipmentCard"
import { getShipmentsWithTracking } from "@/services/dbService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Search, Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

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

  const renderShipmentSkeletons = () => {
    return Array(3)
      .fill(0)
      .map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-slate-800 p-4">
            <Skeleton className="h-6 w-48 bg-slate-700" />
            <Skeleton className="h-4 w-32 mt-2 bg-slate-700" />
          </div>
          <div className="p-4">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))
  }

  if (loading && !shipments.length) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Container Tracker</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{renderShipmentSkeletons()}</div>
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
                placeholder="Search by order ID, container or truck number..."
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
                  <SelectItem value="in transit">In Transit</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
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
                <p className="text-lg font-medium">No shipments found.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShipments.map((shipment) => (
                <ShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
