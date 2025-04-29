"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, FileDown, FileSpreadsheet, Plus, RefreshCw, Search, Ship } from "lucide-react"
import { getAllShippingOrders } from "@/services/dbService"
import { formatDate } from "@/utils/formatters"
import { exportToExcel, exportToPdf } from "@/utils/exportUtils"

export default function ShippingOrdersPage() {
  const [shippingOrders, setShippingOrders] = useState([])
  const [filteredOrders, setFilteredOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchData = async () => {
    try {
      setIsRefreshing(true)
      const data = await getAllShippingOrders()
      setShippingOrders(data)
      setError(null)
    } catch (err) {
      console.error("Error fetching shipping orders:", err)
      setError("Failed to load shipping orders. Please try again later.")
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    // Filter shipping orders based on search term and status filter
    let filtered = [...shippingOrders]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (order) =>
          order.shipping_order_id.toLowerCase().includes(term) ||
          (order.vessel && order.vessel.toLowerCase().includes(term)),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    setFilteredOrders(filtered)
  }, [shippingOrders, searchTerm, statusFilter])

  const getStatusBadge = (status) => {
    switch (status) {
      case "on plan":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
            On Plan
          </Badge>
        )
      case "executing":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
            Executing
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">
            Completed
          </Badge>
        )
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getContainerStatusCounts = (containers) => {
    const counts = {
      pending: 0,
      "in transit": 0,
      delivered: 0,
      delayed: 0,
      total: containers.length,
    }

    containers.forEach((container) => {
      const status = container.status.toLowerCase()
      if (counts[status] !== undefined) {
        counts[status]++
      }
    })

    return counts
  }

  const handleExport = (order, format) => {
    const containerData = order.containers.map((container) => ({
      Container_No: container.container_no,
      Status: container.status,
      Gate_In_Time: container.gate_in_time ? formatDate(container.gate_in_time) : "N/A",
      Truck_No: container.truck_no || "N/A",
    }))

    const fileName = `${order.shipping_order_id}_containers`

    if (format === "excel") {
      exportToExcel(containerData, fileName)
    } else if (format === "pdf") {
      exportToPdf(containerData, fileName, order.shipping_order_id, order.vessel, order.eta)
    }
  }

  const renderShippingOrderSkeletons = () => {
    return Array(6)
      .fill(0)
      .map((_, index) => (
        <div key={index} className="min-w-[300px] w-[350px]">
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-9 w-full" />
            </CardFooter>
          </Card>
        </div>
      ))
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Shipping Orders</h1>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">{renderShippingOrderSkeletons()}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <Ship className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Shipping Orders</h1>
        </div>

        <div className="flex items-center gap-2">
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
          <Link href="/shipping-orders/new">
            <Button className="flex items-center gap-1">
              <Plus className="h-4 w-4" />
              New Shipping Order
            </Button>
          </Link>
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
                placeholder="Search by shipping order ID or vessel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full md:w-[200px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="on plan">On Plan</SelectItem>
                  <SelectItem value="executing">Executing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="active" className="mb-6">
            <TabsList>
              <TabsTrigger value="active">Active Orders</TabsTrigger>
              <TabsTrigger value="all">All Orders</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              {filteredOrders.filter((order) => order.status !== "completed").length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-8 rounded text-center">
                  <p className="text-lg font-medium">No active shipping orders found</p>
                  <p className="mt-2">Create a new shipping order to get started</p>
                  <Link href="/shipping-orders/new">
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      New Shipping Order
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {filteredOrders
                    .filter((order) => order.status !== "completed")
                    .map((order) => renderShippingOrderCard(order))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="all">
              {filteredOrders.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-8 rounded text-center">
                  <p className="text-lg font-medium">No shipping orders found</p>
                  <p className="mt-2">Create a new shipping order to get started</p>
                  <Link href="/shipping-orders/new">
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      New Shipping Order
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {filteredOrders.map((order) => renderShippingOrderCard(order))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )

  function renderShippingOrderCard(order) {
    const containerCounts = getContainerStatusCounts(order.containers || [])

    return (
      <div key={order.id} className="min-w-[300px] w-[350px]">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg">{order.shipping_order_id}</CardTitle>
              {getStatusBadge(order.status)}
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>ETA: {order.eta ? formatDate(order.eta) : "Not available"}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Vessel:</span>
                <span className="font-medium">{order.vessel || "N/A"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Containers:</span>
                <span className="font-medium">{containerCounts.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Status:</span>
                <div className="space-x-1">
                  {containerCounts.delivered > 0 && (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {containerCounts.delivered} Delivered
                    </Badge>
                  )}
                  {containerCounts["in transit"] > 0 && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {containerCounts["in transit"]} In Transit
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between gap-2">
            <Link href={`/shipment/${order.id}`} className="flex-1">
              <Button variant="outline" className="w-full">
                View Details
              </Button>
            </Link>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => handleExport(order, "excel")} title="Export to Excel">
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleExport(order, "pdf")} title="Export to PDF">
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    )
  }
}
