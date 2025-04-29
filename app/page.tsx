"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getShipmentsWithTracking } from "@/services/dbService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Search, Filter, Plus, BarChart, Ship } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import ShipmentList from "@/components/ShipmentList"

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
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)

  const fetchData = async () => {
    try {
      setIsRefreshing(true)
      // Get only non-archived shipments for the main page
      const data = await getShipmentsWithTracking(false)
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

    // Auto-refresh setup
    let intervalId = null

    if (autoRefreshEnabled) {
      intervalId = setInterval(fetchData, AUTO_REFRESH_INTERVAL)
    }

    // Clean up interval on component unmount or when autoRefreshEnabled changes
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [autoRefreshEnabled])

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

  const handleArchive = (shipmentId) => {
    // Remove the archived shipment from the local state
    setShipments(shipments.filter((s) => s.id !== shipmentId))
  }

  const renderShipmentSkeletons = () => {
    return (
      <div className="relative">
        <div className="shipments-wrapper">
          {Array(4)
            .fill(0)
            .map((_, index) => (
              <div key={index} className="shipment-card">
                <Skeleton className="h-[500px] w-full rounded-lg" />
              </div>
            ))}
        </div>
      </div>
    )
  }

  if (loading && !shipments.length) {
    return (
      <div className="container-fluid px-4 py-4 max-w-full">
        <div className="flex items-center gap-3 mb-6">
          <Ship className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Container Tracker</h1>
        </div>
        {renderShipmentSkeletons()}
      </div>
    )
  }

  return (
    <div className="container-fluid px-4 py-4 max-w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <Ship className="h-8 w-8 text-teal-600" />
          <h1 className="text-3xl font-bold">Container Tracker</h1>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
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
          <div className="flex items-center gap-2">
            <Switch checked={autoRefreshEnabled} onCheckedChange={setAutoRefreshEnabled} id="auto-refresh-toggle" />
            <label
              htmlFor="auto-refresh-toggle"
              className={`text-sm cursor-pointer ${autoRefreshEnabled ? "text-teal-600 font-medium" : "text-gray-500"}`}
            >
              Auto-refresh every 10 minutes
            </label>
          </div>
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
                <Button className="bg-teal-600 hover:bg-teal-700 flex items-center gap-1">
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
                    <Button className="bg-teal-600 hover:bg-teal-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Shipping Order
                    </Button>
                  </Link>
                </>
              )}
            </div>
          ) : (
            <ShipmentList shipments={filteredShipments} onArchive={handleArchive} className="grid-cols-3" />
          )}
        </>
      )}
    </div>
  )
}
