"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Plus, Trash2, Upload, Info } from "lucide-react"
import { getShipmentById, addContainersToShipment, deleteContainer } from "@/services/dbService"
import { formatDate } from "@/utils/formatters"
import { read, utils } from "xlsx"

// Container types options
const CONTAINER_TYPES = [
  "20' GP", // 20-foot general purpose
  "40' GP", // 40-foot general purpose
  "40' HC", // 40-foot high cube
  "40' HR", // 40-foot high cube reefer
  "20' RF", // 20-foot reefer
  "40' RF", // 40-foot reefer
  "20' OT", // 20-foot open top
  "40' OT", // 40-foot open top
  "20' FR", // 20-foot flat rack
  "40' FR", // 40-foot flat rack
  "20' TK", // 20-foot tank
]

export default function ManageContainersPage() {
  const router = useRouter()
  const { id } = useParams()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // New containers state
  const [newContainers, setNewContainers] = useState([{ container_no: "", container_type: "20' GP" }])
  const [bulkContainers, setBulkContainers] = useState("")

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

  const handleAddContainer = () => {
    setNewContainers([...newContainers, { container_no: "", container_type: "20' GP" }])
  }

  const handleRemoveContainer = (index) => {
    const updatedContainers = [...newContainers]
    updatedContainers.splice(index, 1)
    setNewContainers(updatedContainers)
  }

  const handleContainerChange = (index, field, value) => {
    const updatedContainers = [...newContainers]
    updatedContainers[index][field] = value
    setNewContainers(updatedContainers)
  }

  const handleBulkContainersChange = (e) => {
    setBulkContainers(e.target.value)
  }

  const processBulkContainers = () => {
    if (!bulkContainers.trim()) return []

    return bulkContainers
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line)
      .map((container_no) => ({
        container_no,
        container_type: "20' GP", // Default container type for bulk entries
      }))
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = utils.sheet_to_json(worksheet)

      if (jsonData.length === 0 || !jsonData[0].container_no) {
        setError("Invalid Excel format. Please ensure the file has a 'container_no' column.")
        return
      }

      const newContainersData = jsonData.map((row) => ({
        container_no: row.container_no,
        container_type: row.container_type || "20' GP", // Use provided type or default
      }))

      setNewContainers(newContainersData)
      setSuccess("Excel file uploaded successfully!")
    } catch (err) {
      console.error("Error processing Excel file:", err)
      setError("Failed to process Excel file. Please check the format and try again.")
    }
  }

  const handleAddContainers = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const containersToAdd = e.target.inputMethod?.value === "bulk" ? processBulkContainers() : newContainers

      if (containersToAdd.length === 0 || containersToAdd.some((c) => !c.container_no)) {
        setError("Please add at least one valid container.")
        setIsSubmitting(false)
        return
      }

      await addContainersToShipment(id, containersToAdd)

      // Refresh shipment data
      const updatedShipment = await getShipmentById(id)
      setShipment(updatedShipment)

      // Reset form
      setNewContainers([{ container_no: "", container_type: "20' GP" }])
      setBulkContainers("")

      setSuccess("Containers added successfully!")
    } catch (err) {
      console.error("Error adding containers:", err)
      setError("Failed to add containers. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteContainer = async (containerId) => {
    if (!confirm("Are you sure you want to delete this container? This action cannot be undone.")) {
      return
    }

    try {
      setIsSubmitting(true)
      await deleteContainer(containerId)

      // Refresh shipment data
      const updatedShipment = await getShipmentById(id)
      setShipment(updatedShipment)

      setSuccess("Container deleted successfully!")
    } catch (err) {
      console.error("Error deleting container:", err)
      setError("Failed to delete container. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Skeleton className="h-12 w-3/4 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="container mx-auto p-4">
        <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Shipment not found.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <h1 className="text-3xl font-bold mb-2">Manage Containers</h1>
      <p className="text-gray-500 mb-6">
        Shipping Order: {shipment.shipping_order_id} | ETA: {formatDate(shipment.eta)}
      </p>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-8">
        {/* Existing Containers Section */}
        <Card>
          <CardHeader>
            <CardTitle>Existing Containers</CardTitle>
            <CardDescription>
              {shipment.containers.length} container{shipment.containers.length !== 1 ? "s" : ""} in this shipment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4 bg-blue-50 border-blue-200 text-blue-800">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Container statuses are automatically updated every 10 minutes by checking the port portal. Once a
                container is marked as "Gate in" with a truck number, it's considered complete.
              </AlertDescription>
            </Alert>

            {shipment.containers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No containers found for this shipment. Add containers below.
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
                      <TableHead>Truck No</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipment.containers.map((container) => (
                      <TableRow key={container.id}>
                        <TableCell className="font-medium">{container.container_no}</TableCell>
                        <TableCell>{container.container_type || "Not specified"}</TableCell>
                        <TableCell>
                          <div
                            className="px-2 py-1 rounded text-sm inline-block"
                            style={{
                              backgroundColor: getStatusColor(container.status).bg,
                              color: getStatusColor(container.status).text,
                            }}
                          >
                            {container.status}
                          </div>
                        </TableCell>
                        <TableCell>{container.gate_in_time ? formatDate(container.gate_in_time) : "N/A"}</TableCell>
                        <TableCell>{container.truck_no || "N/A"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteContainer(container.id)}
                            disabled={isSubmitting || container.status !== "pending"}
                            title={
                              container.status !== "pending"
                                ? "Only pending containers can be deleted"
                                : "Delete container"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add New Containers Section */}
        <Card>
          <CardHeader>
            <CardTitle>Add New Containers</CardTitle>
            <CardDescription>Add containers to this shipping order</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="add-containers-form" onSubmit={handleAddContainers}>
              <Tabs defaultValue="individual" className="mt-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="individual">Individual Entry</TabsTrigger>
                  <TabsTrigger value="bulk">Bulk Entry</TabsTrigger>
                </TabsList>
                <input type="hidden" name="inputMethod" value="individual" />
                <TabsContent value="individual">
                  <div className="space-y-4 mt-4">
                    {newContainers.map((container, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="Container Number"
                          value={container.container_no}
                          onChange={(e) => handleContainerChange(index, "container_no", e.target.value)}
                          className="flex-1"
                        />
                        <Select
                          value={container.container_type}
                          onValueChange={(value) => handleContainerChange(index, "container_type", value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTAINER_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveContainer(index)}
                          disabled={newContainers.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={handleAddContainer} className="w-full">
                      <Plus className="mr-2 h-4 w-4" /> Add Container
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="bulk">
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="bulk-containers">Enter Container Numbers (one per line)</Label>
                      <Textarea
                        id="bulk-containers"
                        placeholder="CONT-001&#10;CONT-002&#10;CONT-003"
                        className="min-h-[200px] font-mono"
                        value={bulkContainers}
                        onChange={handleBulkContainersChange}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Note: Bulk entries will use the default container type (20' GP). For specific container types,
                        use individual entry or Excel upload.
                      </p>
                    </div>
                    <div className="text-center relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <span className="relative bg-background px-2 text-xs text-muted-foreground">OR</span>
                    </div>
                    <div>
                      <Label htmlFor="excel-upload">Upload Excel File</Label>
                      <div className="mt-2">
                        <Input
                          id="excel-upload"
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <Label
                          htmlFor="excel-upload"
                          className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 cursor-pointer hover:bg-gray-50"
                        >
                          <Upload className="h-6 w-6 text-gray-400" />
                          <span>Click to upload Excel file</span>
                        </Label>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Excel file should have columns named &quot;container_no&quot; and &quot;container_type&quot;
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </form>
          </CardContent>
          <CardFooter>
            <Button type="submit" form="add-containers-form" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Containers"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

// Helper function to get status colors
function getStatusColor(status) {
  const statusLower = status.toLowerCase()

  if (statusLower.includes("delivered") || statusLower === "gate in") {
    return { bg: "#e6f4ea", text: "#137333" } // Green
  } else if (statusLower.includes("transit")) {
    return { bg: "#e8f0fe", text: "#1a73e8" } // Blue
  } else if (statusLower.includes("delay") || statusLower.includes("hold")) {
    return { bg: "#fef7e0", text: "#b06000" } // Yellow/Orange
  } else if (statusLower.includes("problem") || statusLower.includes("damage")) {
    return { bg: "#fce8e6", text: "#c5221f" } // Red
  } else {
    return { bg: "#f1f3f4", text: "#3c4043" } // Gray
  }
}
