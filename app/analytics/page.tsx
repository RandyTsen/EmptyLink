"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, BarChart3, PieChart, LineChart, TrendingUp, Filter, RefreshCw } from "lucide-react"
import { getShipmentsWithTracking } from "@/services/dbService"
import { formatDate } from "@/utils/formatters"
import { format, isWithinInterval, subDays } from "date-fns"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart as ReLineChart,
  Line,
} from "recharts"

// Status colors for charts
const STATUS_COLORS = {
  "gate in": "#4ade80", // green
  delivered: "#22c55e", // green
  "in transit": "#60a5fa", // blue
  delayed: "#fbbf24", // yellow
  pending: "#9ca3af", // gray
  problem: "#ef4444", // red
}

// Container type colors for charts
const CONTAINER_TYPE_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f97316", // orange
  "#84cc16", // lime
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#6366f1", // indigo
  "#d946ef", // fuchsia
  "#f43f5e", // rose
]

export default function AnalyticsDashboard() {
  const router = useRouter()
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState(new Date())

  // Filters
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [selectedShipment, setSelectedShipment] = useState("all")
  const [selectedContainerType, setSelectedContainerType] = useState("all")

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
  }, [])

  // Filter data based on selected filters
  const filteredData = useMemo(() => {
    if (!shipments.length) return []

    return shipments
      .filter((shipment) => {
        // Filter by date range
        if (dateRange.from && dateRange.to) {
          const shipmentDate = new Date(shipment.eta)
          return isWithinInterval(shipmentDate, { start: dateRange.from, end: dateRange.to })
        }
        return true
      })
      .filter((shipment) => {
        // Filter by shipment
        if (selectedShipment !== "all") {
          return shipment.id === selectedShipment
        }
        return true
      })
  }, [shipments, dateRange, selectedShipment])

  // Get all containers from filtered shipments
  const filteredContainers = useMemo(() => {
    if (!filteredData.length) return []

    let containers = []
    filteredData.forEach((shipment) => {
      containers = [
        ...containers,
        ...shipment.containers.map((container) => ({
          ...container,
          shipping_order_id: shipment.shipping_order_id,
          eta: shipment.eta,
        })),
      ]
    })

    // Filter by container type
    if (selectedContainerType !== "all") {
      containers = containers.filter((container) => container.container_type === selectedContainerType)
    }

    return containers
  }, [filteredData, selectedContainerType])

  // Get unique container types
  const containerTypes = useMemo(() => {
    if (!shipments.length) return []

    const types = new Set()
    shipments.forEach((shipment) => {
      shipment.containers.forEach((container) => {
        if (container.container_type) {
          types.add(container.container_type)
        }
      })
    })

    return Array.from(types)
  }, [shipments])

  // Calculate status distribution data for pie chart
  const statusDistributionData = useMemo(() => {
    if (!filteredContainers.length) return []

    const statusCounts = {}
    filteredContainers.forEach((container) => {
      const status = container.status.toLowerCase()
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
    }))
  }, [filteredContainers])

  // Calculate container type distribution data for bar chart
  const containerTypeDistributionData = useMemo(() => {
    if (!filteredContainers.length) return []

    const typeCounts = {}
    filteredContainers.forEach((container) => {
      const type = container.container_type || "Unknown"
      typeCounts[type] = (typeCounts[type] || 0) + 1
    })

    return Object.entries(typeCounts).map(([type, count]) => ({
      name: type,
      count,
    }))
  }, [filteredContainers])

  // Calculate completion rate by shipping order
  const completionRateData = useMemo(() => {
    if (!filteredData.length) return []

    return filteredData.map((shipment) => {
      const total = shipment.containers.length
      const completed = shipment.containers.filter(
        (c) => c.status.toLowerCase() === "delivered" || c.status.toLowerCase() === "gate in",
      ).length
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

      return {
        name: shipment.shipping_order_id,
        rate: completionRate,
        total,
        completed,
      }
    })
  }, [filteredData])

  // Calculate status trends over time (last 30 days)
  const statusTrendsData = useMemo(() => {
    if (!filteredContainers.length) return []

    // Group containers by date (using gate_in_time for completed containers, eta for others)
    const containersByDate = {}

    filteredContainers.forEach((container) => {
      let dateStr
      if (container.gate_in_time) {
        dateStr = format(new Date(container.gate_in_time), "yyyy-MM-dd")
      } else if (container.eta) {
        dateStr = format(new Date(container.eta), "yyyy-MM-dd")
      } else {
        return // Skip if no date available
      }

      if (!containersByDate[dateStr]) {
        containersByDate[dateStr] = {
          date: dateStr,
          pending: 0,
          "in transit": 0,
          delivered: 0,
          "gate in": 0,
          delayed: 0,
          problem: 0,
        }
      }

      const status = container.status.toLowerCase()
      containersByDate[dateStr][status] = (containersByDate[dateStr][status] || 0) + 1
    })

    // Convert to array and sort by date
    return Object.values(containersByDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredContainers])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!filteredContainers.length)
      return {
        total: 0,
        completed: 0,
        inTransit: 0,
        delayed: 0,
        pending: 0,
        completionRate: 0,
      }

    const total = filteredContainers.length
    const completed = filteredContainers.filter(
      (c) => c.status.toLowerCase() === "delivered" || c.status.toLowerCase() === "gate in",
    ).length
    const inTransit = filteredContainers.filter((c) => c.status.toLowerCase() === "in transit").length
    const delayed = filteredContainers.filter((c) => c.status.toLowerCase() === "delayed").length
    const pending = filteredContainers.filter((c) => c.status.toLowerCase() === "pending").length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      total,
      completed,
      inTransit,
      delayed,
      pending,
      completionRate,
    }
  }, [filteredContainers])

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-sm">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading && !shipments.length) {
    return (
      <div className="container mx-auto p-4">
        <Button variant="ghost" className="mb-6" onClick={() => router.push("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
        <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-80 w-full" />
            ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Last updated: {format(lastRefreshed, "h:mm a")}</span>
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
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Filters */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Date Range</label>
                  <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Shipping Order</label>
                  <Select value={selectedShipment} onValueChange={setSelectedShipment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select shipping order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Shipping Orders</SelectItem>
                      {shipments.map((shipment) => (
                        <SelectItem key={shipment.id} value={shipment.id}>
                          {shipment.shipping_order_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Container Type</label>
                  <Select value={selectedContainerType} onValueChange={setSelectedContainerType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select container type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Container Types</SelectItem>
                      {containerTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Containers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summaryStats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Completed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{summaryStats.completed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>In Transit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{summaryStats.inTransit}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Delayed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">{summaryStats.delayed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Completion Rate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summaryStats.completionRate}%</div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div
                    className="bg-green-600 h-2.5 rounded-full"
                    style={{ width: `${summaryStats.completionRate}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <Tabs defaultValue="status" className="mb-6">
            <TabsList className="mb-4">
              <TabsTrigger value="status" className="flex items-center">
                <PieChart className="mr-2 h-4 w-4" />
                Status Distribution
              </TabsTrigger>
              <TabsTrigger value="types" className="flex items-center">
                <BarChart3 className="mr-2 h-4 w-4" />
                Container Types
              </TabsTrigger>
              <TabsTrigger value="completion" className="flex items-center">
                <TrendingUp className="mr-2 h-4 w-4" />
                Completion Rates
              </TabsTrigger>
              <TabsTrigger value="trends" className="flex items-center">
                <LineChart className="mr-2 h-4 w-4" />
                Status Trends
              </TabsTrigger>
            </TabsList>

            {/* Status Distribution Chart */}
            <TabsContent value="status">
              <Card>
                <CardHeader>
                  <CardTitle>Container Status Distribution</CardTitle>
                  <CardDescription>Distribution of containers by status for the selected filters</CardDescription>
                </CardHeader>
                <CardContent>
                  {statusDistributionData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      No data available for the selected filters
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={statusDistributionData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {statusDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name.toLowerCase()] || "#9ca3af"} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Container Types Chart */}
            <TabsContent value="types">
              <Card>
                <CardHeader>
                  <CardTitle>Container Type Distribution</CardTitle>
                  <CardDescription>Distribution of containers by type for the selected filters</CardDescription>
                </CardHeader>
                <CardContent>
                  {containerTypeDistributionData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      No data available for the selected filters
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={containerTypeDistributionData}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 60,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                          <YAxis />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar dataKey="count" name="Count" fill="#3b82f6">
                            {containerTypeDistributionData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={CONTAINER_TYPE_COLORS[index % CONTAINER_TYPE_COLORS.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Completion Rates Chart */}
            <TabsContent value="completion">
              <Card>
                <CardHeader>
                  <CardTitle>Completion Rates by Shipping Order</CardTitle>
                  <CardDescription>Percentage of completed containers for each shipping order</CardDescription>
                </CardHeader>
                <CardContent>
                  {completionRateData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      No data available for the selected filters
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={completionRateData}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 60,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 100]} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar dataKey="rate" name="Completion Rate (%)" fill="#22c55e" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Status Trends Chart */}
            <TabsContent value="trends">
              <Card>
                <CardHeader>
                  <CardTitle>Status Trends Over Time</CardTitle>
                  <CardDescription>How container statuses have changed over the selected time period</CardDescription>
                </CardHeader>
                <CardContent>
                  {statusTrendsData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      No data available for the selected filters
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ReLineChart
                          data={statusTrendsData}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 20,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="pending"
                            name="Pending"
                            stroke={STATUS_COLORS.pending}
                            activeDot={{ r: 8 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="in transit"
                            name="In Transit"
                            stroke={STATUS_COLORS["in transit"]}
                          />
                          <Line type="monotone" dataKey="delivered" name="Delivered" stroke={STATUS_COLORS.delivered} />
                          <Line type="monotone" dataKey="gate in" name="Gate In" stroke={STATUS_COLORS["gate in"]} />
                          <Line type="monotone" dataKey="delayed" name="Delayed" stroke={STATUS_COLORS.delayed} />
                        </ReLineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Shipping Orders Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping Orders Performance</CardTitle>
              <CardDescription>
                Detailed performance metrics for each shipping order in the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Shipping Order</th>
                      <th className="border p-2 text-left">ETA</th>
                      <th className="border p-2 text-left">Total Containers</th>
                      <th className="border p-2 text-left">Completed</th>
                      <th className="border p-2 text-left">In Transit</th>
                      <th className="border p-2 text-left">Delayed</th>
                      <th className="border p-2 text-left">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="border p-4 text-center text-gray-500">
                          No data available for the selected filters
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((shipment) => {
                        const total = shipment.containers.length
                        const completed = shipment.containers.filter(
                          (c) => c.status.toLowerCase() === "delivered" || c.status.toLowerCase() === "gate in",
                        ).length
                        const inTransit = shipment.containers.filter(
                          (c) => c.status.toLowerCase() === "in transit",
                        ).length
                        const delayed = shipment.containers.filter((c) => c.status.toLowerCase() === "delayed").length
                        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

                        return (
                          <tr key={shipment.id} className="hover:bg-gray-50">
                            <td className="border p-2">{shipment.shipping_order_id}</td>
                            <td className="border p-2">{formatDate(shipment.eta)}</td>
                            <td className="border p-2">{total}</td>
                            <td className="border p-2">
                              <Badge className="bg-green-100 text-green-800">{completed}</Badge>
                            </td>
                            <td className="border p-2">
                              {inTransit > 0 && <Badge className="bg-blue-100 text-blue-800">{inTransit}</Badge>}
                            </td>
                            <td className="border p-2">
                              {delayed > 0 && <Badge className="bg-yellow-100 text-yellow-800">{delayed}</Badge>}
                            </td>
                            <td className="border p-2">
                              <div className="flex items-center gap-2">
                                <div className="w-full max-w-[100px] bg-gray-200 rounded-full h-2.5">
                                  <div
                                    className="bg-green-600 h-2.5 rounded-full"
                                    style={{ width: `${completionRate}%` }}
                                  ></div>
                                </div>
                                <span>{completionRate}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
