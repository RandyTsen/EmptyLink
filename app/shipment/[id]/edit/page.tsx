"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, CalendarIcon, Save, Ship, Clock, Plus, Trash2, Upload } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  getShipmentById,
  updateShipment,
  addContainersToShipment,
  deleteContainer,
  updateContainer,
} from "@/services/dbService"
import { TimeField } from "@/components/ui/time-field"
import { Textarea } from "@/components/ui/textarea"
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

export default function EditShipmentPage() {
  const router = useRouter()
  const { id } = useParams()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state for shipping order
  const [shippingOrderId, setShippingOrderId] = useState("")
  const [vessel, setVessel] = useState("")
  const [date, setDate] = useState(null)
  const [time, setTime] = useState({ hours: 12, minutes: 0 })

  // State for container management
  const [newContainers, setNewContainers] = useState([{ container_no: "", container_type: "20' GP" }])
  const [bulkContainers, setBulkContainers] = useState("")
  const [editingContainer, setEditingContainer] = useState(null)

  useEffect(() => {
    async function loadShipment() {
      try {
        setLoading(true)
        const data = await getShipmentById(id)
        setShipment(data)

        // Initialize form state
        setShippingOrderId(data.shipping_order_id)
        setVessel(data.vessel || "")

        if (data.eta) {
          const etaDate = new Date(data.eta)
          setDate(etaDate)
          setTime({
            hours: etaDate.getHours(),
            minutes: etaDate.getMinutes(),
          })
        }

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

  const handleSubmitShippingOrder = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    // Combine date and time
    let eta = null
    if (date) {
      const etaDate = new Date(date)
      etaDate.setHours(time.hours)
      etaDate.setMinutes(time.minutes)
      eta = etaDate.toISOString()
    }

    if (!shippingOrderId || !vessel || !eta) {
      setError("Please fill in all required fields.")
      setIsSubmitting(false)
      return
    }

    try {
      await updateShipment(id, {
        shipping_order_id: shippingOrderId,
        vessel,
        eta,
      })

      setSuccess("Shipping order updated successfully!")

      // Refresh shipment data
      const updatedShipment = await getShipmentById(id)
      setShipment(updatedShipment)
    } catch (err) {
      console.error("Error updating shipping order:", err)
      setError("Failed to update shipping order. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

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
      .map((line) => {
        // Try to parse container number and type from format like "PCIU1234535 20 GP"
        const parts = line.split(" ")
        let container_no = line
        let container_type = "20' GP" // Default

        if (parts.length >= 3) {
          // Format is likely "PCIU1234535 20 GP"
          container_no = parts[0]
          container_type = `${parts[1]}' ${parts[2]}`
        } else if (parts.length === 2) {
          // Check if second part is a container type indicator
          if (parts[1].match(/^(GP|HC|HR|RF|OT|FR|TK)$/i)) {
            container_no = parts[0]
            container_type = `20' ${parts[1].toUpperCase()}`
          }
        }

        return {
          container_no,
          container_type,
        }
      })
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

  const handleEditContainer = (container) => {
    setEditingContainer({
      ...container,
      container_no: container.container_no,
      container_type: container.container_type || "20' GP",
    })
  }

  const handleUpdateContainer = async () => {
    if (!editingContainer) return

    try {
      setIsSubmitting(true)
      await updateContainer(editingContainer.id, {
        container_no: editingContainer.container_no,
        container_type: editingContainer.container_type,
      })

      // Refresh shipment data
      const updatedShipment = await getShipmentById(id)
      setShipment(updatedShipment)

      setEditingContainer(null)
      setSuccess("Container updated successfully!")
    } catch (err) {
      console.error("Error updating container:", err)
      setError("Failed to update container. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
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

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Skeleton className="h-12 w-3/4 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
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

  function formatDate(dateString) {
    const date = new Date(dateString)
    return format(date, "yyyy-MM-dd HH:mm")
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <Ship className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Edit Shipping Order</h1>
      </div>

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

      <Tabs defaultValue="shipping-order">
        <TabsList className="mb-6">
          <TabsTrigger value="shipping-order">Shipping Order Details</TabsTrigger>
          <TabsTrigger value="containers">Manage Containers</TabsTrigger>
          <TabsTrigger value="add-containers">Add Containers</TabsTrigger>
        </TabsList>

        {/* Shipping Order Details Tab */}
        <TabsContent value="shipping-order">
          <Card>
            <CardHeader>
              <CardTitle>Shipping Order Information</CardTitle>
              <CardDescription>Update the basic information for this shipping order.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmitShippingOrder}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="shipping_order_id">Shipping Order ID</Label>
                  <Input
                    id="shipping_order_id"
                    value={shippingOrderId}
                    onChange={(e) => setShippingOrderId(e.target.value)}
                    placeholder="e.g., SO-12345"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vessel">Vessel</Label>
                  <Input
                    id="vessel"
                    value={vessel}
                    onChange={(e) => setVessel(e.target.value)}
                    placeholder="e.g., MAERSK SELETAR"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Estimated Time of Arrival (ETA)</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                      </PopoverContent>
                    </Popover>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <TimeField value={time} onChange={setTime} className="w-full sm:w-[150px]" />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Saving..." : "Save Shipping Order Details"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* Manage Containers Tab */}
        <TabsContent value="containers">
          <Card>
            <CardHeader>
              <CardTitle>Manage Containers</CardTitle>
              <CardDescription>
                {shipment.containers.length} container{shipment.containers.length !== 1 ? "s" : ""} in this shipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shipment.containers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No containers found for this shipment. Add containers in the "Add Containers" tab.
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
                                backgroundColor: getStatusBadgeClass(container.status).split(" ")[0],
                                color: getStatusBadgeClass(container.status).split(" ")[1],
                              }}
                            >
                              {container.status}
                            </div>
                          </TableCell>
                          <TableCell>{container.gate_in_time ? formatDate(container.gate_in_time) : "N/A"}</TableCell>
                          <TableCell>{container.truck_no || "N/A"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditContainer(container)}
                                disabled={container.status !== "pending"}
                                title={
                                  container.status !== "pending"
                                    ? "Only pending containers can be edited"
                                    : "Edit container"
                                }
                              >
                                Edit
                              </Button>
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
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Edit Container Modal */}
              {editingContainer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                    <h3 className="text-lg font-bold mb-4">Edit Container</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="edit-container-no">Container Number</Label>
                        <Input
                          id="edit-container-no"
                          value={editingContainer.container_no}
                          onChange={(e) => setEditingContainer({ ...editingContainer, container_no: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-container-type">Container Type</Label>
                        <Select
                          value={editingContainer.container_type}
                          onValueChange={(value) => setEditingContainer({ ...editingContainer, container_type: value })}
                        >
                          <SelectTrigger id="edit-container-type">
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
                      </div>
                      <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={() => setEditingContainer(null)}>
                          Cancel
                        </Button>
                        <Button onClick={handleUpdateContainer} disabled={isSubmitting}>
                          {isSubmitting ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Containers Tab */}
        <TabsContent value="add-containers">
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
                          Format: "PCIU1234535 20 GP" (container number followed by container type). If type is omitted,
                          20' GP will be used as default.
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
                <div className="mt-6">
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Adding..." : "Add Containers"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
