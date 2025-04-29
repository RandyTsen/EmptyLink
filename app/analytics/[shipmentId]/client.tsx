"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText, FileIcon as FilePdf } from "lucide-react"
import { getShipmentById } from "@/services/dbService"
import { format } from "date-fns"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export default function ShipmentAnalyticsClient({ params }) {
  const router = useRouter()
  const { shipmentId } = params
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const data = await getShipmentById(shipmentId)
        setShipment(data)
      } catch (err) {
        console.error("Error fetching shipment:", err)
        setError("Failed to load shipment data")
      } finally {
        setLoading(false)
      }
    }

    if (shipmentId) {
      fetchData()
    }
  }, [shipmentId])

  const downloadCSV = async () => {
    try {
      const response = await fetch(`/api/analytics/${shipmentId}/csv`)
      if (!response.ok) throw new Error("Failed to download CSV")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `shipment-${shipment.shipping_order_id}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("Error downloading CSV:", err)
      alert("Failed to download CSV. Please try again.")
    }
  }

  const downloadPDF = () => {
    try {
      // Create a new PDF document
      const doc = new jsPDF()

      // Add title
      doc.setFontSize(18)
      doc.text(`Shipment: ${shipment.shipping_order_id}`, 14, 22)

      // Add shipment details
      doc.setFontSize(12)
      doc.text(`Vessel: ${shipment.vessel || "N/A"}`, 14, 32)
      doc.text(`ETA: ${shipment.eta ? format(new Date(shipment.eta), "MM/dd/yyyy") : "N/A"}`, 14, 38)
      doc.text(`Status: ${shipment.status}`, 14, 44)
      doc.text(`Generated: ${format(new Date(), "MM/dd/yyyy HH:mm")}`, 14, 50)

      // Prepare container data for the table
      const tableData = shipment.containers.map((container) => [
        container.container_no,
        container.container_type || "N/A",
        container.status,
        container.gate_in_time ? format(new Date(container.gate_in_time), "MM/dd/yyyy HH:mm") : "N/A",
        container.truck_no || "N/A",
      ])

      // Add table using autoTable
      autoTable(doc, {
        startY: 60,
        head: [["Container ID", "Type", "Status", "Gate-In Time", "Truck No"]],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [66, 66, 66],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
      })

      // Save the PDF
      doc.save(`shipment-${shipment.shipping_order_id}.pdf`)
    } catch (err) {
      console.error("Error generating PDF:", err)
      alert("Failed to generate PDF. Please try again.")
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={() => router.push("/analytics")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Analytics
          </Button>
          <h1 className="text-2xl font-bold">Shipment Analytics</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="animate-pulse bg-gray-200 h-6 w-48 rounded"></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-64 bg-gray-200 rounded w-full"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !shipment) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={() => router.push("/analytics")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Analytics
          </Button>
          <h1 className="text-2xl font-bold">Shipment Analytics</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error || "Shipment not found"}
            </div>
            <Button onClick={() => router.push("/analytics")} className="mt-4">
              Return to Analytics
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate completion statistics
  const totalContainers = shipment.containers.length
  const completedContainers = shipment.containers.filter(
    (c) => c.status.toLowerCase() === "delivered" || c.status.toLowerCase() === "gate in",
  ).length
  const completionPercentage = totalContainers > 0 ? Math.round((completedContainers / totalContainers) * 100) : 0

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => router.push("/analytics")} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Analytics
        </Button>
        <h1 className="text-2xl font-bold">Shipment Analytics</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Shipment: {shipment.shipping_order_id}</CardTitle>
          <CardDescription>
            Vessel: {shipment.vessel || "N/A"} | ETA:{" "}
            {shipment.eta ? format(new Date(shipment.eta), "MM/dd/yyyy") : "N/A"} | Status: {shipment.status}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg flex-1">
              <div className="text-sm text-gray-500">Total Containers</div>
              <div className="text-2xl font-bold">{totalContainers}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg flex-1">
              <div className="text-sm text-gray-500">Completed</div>
              <div className="text-2xl font-bold text-green-600">{completedContainers}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg flex-1">
              <div className="text-sm text-gray-500">Completion Rate</div>
              <div className="text-2xl font-bold">{completionPercentage}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div
                  className={`h-2.5 rounded-full ${
                    completionPercentage === 100
                      ? "bg-green-500"
                      : completionPercentage > 50
                        ? "bg-blue-500"
                        : "bg-amber-500"
                  }`}
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <Button onClick={downloadCSV} className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Download CSV
            </Button>
            <Button onClick={downloadPDF} className="flex items-center gap-2">
              <FilePdf className="h-4 w-4" />
              Download PDF
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-4 py-2 text-left">Container ID</th>
                  <th className="border px-4 py-2 text-left">Type</th>
                  <th className="border px-4 py-2 text-left">Truck No</th>
                  <th className="border px-4 py-2 text-left">Time</th>
                  <th className="border px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {shipment.containers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border px-4 py-2 text-center text-gray-500">
                      No containers found
                    </td>
                  </tr>
                ) : (
                  shipment.containers.map((container) => (
                    <tr key={container.id} className="hover:bg-gray-50">
                      <td className="border px-4 py-2">{container.container_no}</td>
                      <td className="border px-4 py-2">{container.container_type || "N/A"}</td>
                      <td className="border px-4 py-2">{container.truck_no || "N/A"}</td>
                      <td className="border px-4 py-2">
                        {container.gate_in_time ? format(new Date(container.gate_in_time), "MM/dd/yyyy HH:mm") : "N/A"}
                      </td>
                      <td className="border px-4 py-2 text-center text-xl">
                        {container.status.toLowerCase() === "pending" ? "🕓" : "✅"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
