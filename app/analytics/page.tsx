"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BarChart3, LineChartIcon, Package, Clock, Ship, AlertCircle } from "lucide-react"
import { getShipmentsWithTracking } from "@/services/dbService"
import { format, startOfDay, parseISO, isWithinInterval, startOfMonth, endOfDay } from "date-fns"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"

export default function AnalyticsPage() {
  const router = useRouter()
  const [shipments, setShipments] = useState([])
  const [filteredShipments, setFilteredShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeBar, setActiveBar] = useState(null)

  // Default date range: current month
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  })

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const data = await getShipmentsWithTracking(true) // Include archived shipments
        setShipments(data)
      } catch (err) {
        console.error("Error fetching shipments:", err)
        setError("Failed to load shipment data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filter shipments by date range
  useEffect(() => {
    if (!shipments.length) return

    let filtered = [...shipments]

    // Filter by date range if both dates are selected
    if (dateRange.from && dateRange.to) {
      filtered = filtered.filter((shipment) => {
        const shipmentDate = shipment.eta ? new Date(shipment.eta) : null
        if (!shipmentDate) return false

        return isWithinInterval(shipmentDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to),
        })
      })
    }

    setFilteredShipments(filtered)
  }, [shipments, dateRange])

  // Compute summary statistics based on filtered shipments
  const totalShipments = filteredShipments.length
  const totalContainers = filteredShipments.reduce((acc, shipment) => acc + (shipment.containers?.length || 0), 0)
  const pendingShipments = filteredShipments.filter((shipment) => shipment.status !== "completed").length
  const avgContainersPerShipment = totalShipments > 0 ? Math.round((totalContainers / totalShipments) * 10) / 10 : 0

  // Compute counts by status
  const statusCounts = filteredShipments.reduce((acc, shipment) => {
    const status = shipment.status || "unknown"
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  const statusChartData = Object.keys(statusCounts).map((status) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1), // Capitalize first letter
    count: statusCounts[status],
  }))

  // Compute daily completion percentage over the selected date range
  const getDailyCompletionData = () => {
    if (!dateRange.from || !dateRange.to) return []

    // Create an array of dates in the range
    const days = []
    const currentDate = new Date(dateRange.from)

    while (currentDate <= dateRange.to) {
      days.push({
        date: new Date(currentDate),
        dateStr: format(currentDate, "MMM dd"),
        completionPercentage: 0,
        shipmentCount: 0,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Calculate completion percentage for each day
    filteredShipments.forEach((shipment) => {
      if (!shipment.containers || shipment.containers.length === 0) return

      const etaDate = shipment.eta ? parseISO(shipment.eta) : null
      if (!etaDate) return

      // Find which day this shipment belongs to
      const dayIndex = days.findIndex((day) => startOfDay(etaDate).getTime() === startOfDay(day.date).getTime())

      if (dayIndex === -1) return // Not in the selected range

      // Calculate completion percentage for this shipment
      const totalContainers = shipment.containers.length
      const completedContainers = shipment.containers.filter(
        (container) => container.status.toLowerCase() === "delivered" || container.status.toLowerCase() === "gate in",
      ).length

      const completionPercentage = totalContainers > 0 ? (completedContainers / totalContainers) * 100 : 0

      // Add to the day's total
      days[dayIndex].completionPercentage += completionPercentage
      days[dayIndex].shipmentCount += 1
    })

    // Calculate average completion percentage for each day
    return days.map((day) => ({
      date: day.dateStr,
      percentage: day.shipmentCount > 0 ? Math.round(day.completionPercentage / day.shipmentCount) : 0,
    }))
  }

  const completionChartData = getDailyCompletionData()

  // Get shipments by status for click handling
  const shipmentsByStatus = {}
  filteredShipments.forEach((shipment) => {
    const status = shipment.status || "unknown"
    if (!shipmentsByStatus[status]) {
      shipmentsByStatus[status] = []
    }
    shipmentsByStatus[status].push(shipment)
  })

  // Handle bar click
  const handleBarClick = (data, index) => {
    const status = data.status.toLowerCase()
    if (shipmentsByStatus[status] && shipmentsByStatus[status].length > 0) {
      // Navigate to the first shipment of this status
      router.push(`/analytics/${shipmentsByStatus[status][0].id}`)
    }
  }

  // Custom tooltip for bar chart
  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-sm">
          <p className="font-medium">{label}</p>
          <p className="text-sm">{`Count: ${payload[0].value}`}</p>
          <p className="text-xs text-gray-500 mt-1">Click to view details</p>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              <div className="animate-pulse bg-gray-200 w-full h-64 rounded"></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              <div className="animate-pulse bg-gray-200 w-full h-64 rounded"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => router.push("/")} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <h1 className="text-2xl font-bold">Analytics</h1>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

      {/* Date Range Picker */}
      <div className="mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Date Range</CardTitle>
            <CardDescription>Select a date range to filter analytics data</CardDescription>
          </CardHeader>
          <CardContent>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full sm:w-[350px]" />
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center">
              <Ship className="h-4 w-4 mr-2" />
              Total Shipments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalShipments}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center">
              <Package className="h-4 w-4 mr-2" />
              Total Containers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalContainers}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Pending Shipments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">{pendingShipments}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              Avg Containers/Shipment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">{avgContainersPerShipment}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Shipments by Status
            </CardTitle>
            <CardDescription>Distribution of shipments across different statuses (click for details)</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend />
                <Bar
                  dataKey="count"
                  name="Number of Shipments"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  onClick={handleBarClick}
                  cursor="pointer"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={activeBar === index ? "#2563eb" : "#3b82f6"}
                      onMouseEnter={() => setActiveBar(index)}
                      onMouseLeave={() => setActiveBar(null)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Completion Percentage Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <LineChartIcon className="h-5 w-5 mr-2" />
              Daily Completion Percentage
            </CardTitle>
            <CardDescription>Average completion percentage over the selected date range</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={completionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, "Completion"]} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="percentage"
                  name="Completion %"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Shipments Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>All Shipments</CardTitle>
          <CardDescription>Click on a shipment to view detailed analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-4 py-2 text-left">Shipping Order ID</th>
                  <th className="border px-4 py-2 text-left">Vessel</th>
                  <th className="border px-4 py-2 text-left">ETA</th>
                  <th className="border px-4 py-2 text-left">Status</th>
                  <th className="border px-4 py-2 text-left">Containers</th>
                  <th className="border px-4 py-2 text-left">Completion</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border px-4 py-2 text-center text-gray-500">
                      No shipments found in the selected date range
                    </td>
                  </tr>
                ) : (
                  filteredShipments.map((shipment) => {
                    const totalContainers = shipment.containers?.length || 0
                    const completedContainers =
                      shipment.containers?.filter(
                        (c) => c.status.toLowerCase() === "delivered" || c.status.toLowerCase() === "gate in",
                      ).length || 0
                    const completionPercentage =
                      totalContainers > 0 ? Math.round((completedContainers / totalContainers) * 100) : 0

                    return (
                      <tr
                        key={shipment.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/analytics/${shipment.id}`)}
                      >
                        <td className="border px-4 py-2">{shipment.shipping_order_id}</td>
                        <td className="border px-4 py-2">{shipment.vessel || "N/A"}</td>
                        <td className="border px-4 py-2">
                          {shipment.eta ? format(new Date(shipment.eta), "MMM dd, yyyy") : "N/A"}
                        </td>
                        <td className="border px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              shipment.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : shipment.status === "executing"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {shipment.status}
                          </span>
                        </td>
                        <td className="border px-4 py-2">{totalContainers}</td>
                        <td className="border px-4 py-2">
                          <div className="flex items-center">
                            <div className="w-full max-w-[100px] bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full ${
                                  completionPercentage === 100
                                    ? "bg-green-500"
                                    : completionPercentage > 50
                                      ? "bg-blue-500"
                                      : "bg-amber-500"
                                }`}
                                style={{ width: `${completionPercentage}%` }}
                              ></div>
                            </div>
                            <span className="text-xs">{completionPercentage}%</span>
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
    </div>
  )
}
