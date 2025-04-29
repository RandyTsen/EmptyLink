"use client"

import { Badge } from "@/components/ui/badge"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, CalendarIcon, Save, Ship, Clock, Plus, Trash2, Upload, Info, Check, X, Package } from "lucide-react"
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

// Status colors for better visual distinction
const STATUS_COLORS = {
  "gate in": { bg: "bg-emerald-100", text: "text-emerald-800", hover: "hover:bg-emerald-200" },
  delivered: { bg: "bg-green-100", text: "text-green-800", hover: "hover:bg-green-200" },
  "in transit": { bg: "bg-blue-100", text: "text-blue-800", hover: "hover:bg-blue-200" },
  delayed: { bg: "bg-amber-100", text: "text-amber-800", hover: "hover:bg-amber-200" },
  pending: { bg: "bg-gray-100", text: "text-gray-800", hover: "hover:bg-gray-200" },
  problem: { bg: "bg-red-100", text: "text-red-800", hover: "hover:bg-red-200" },
}

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

    for (const [key, value] of Object.entries(STATUS_COLORS)) {
      if (statusLower.includes(key)) {
        return `${value.bg} ${value.text} ${value.hover}`
      }
    }

    return `${STATUS_COLORS.pending.bg} ${STATUS_COLORS.pending.text} ${STATUS_COLORS.pending.hover}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="container mx-auto p-4">
          <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Skeleton className="h-12 w-3/4 mb-6" />
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="container mx-auto p-4">
          <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Shipment not found.</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  function formatDate(dateString) {
    const date = new Date(dateString)
    return format(date, "yyyy-MM-dd HH:mm")
  }

  // Calculate completion percentage for styling
  const containerCounts = {
    total: shipment.containers.length,
    completed: shipment.containers.filter(
      (c) => c.status.toLowerCase() === "delivered" || c.status.toLowerCase() === "gate in",
    ).length,
  }
  const completionPercentage =
    containerCounts.total > 0 ? Math.round((containerCounts.completed / containerCounts.total) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="container mx-auto p-4 max-w-6xl">
        <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-full">
            <Ship className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Edit Shipping Order</h1>
            <p className="text-gray-500">{shipment.shipping_order_id}</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <Tabs
          defaultValue="shipping-order"
          className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
        >
          <TabsList className="p-0 bg-gray-50 border-b border-gray-200 rounded-none">
            <TabsTrigger
              value="shipping-order"
              className="data-[state=active]:bg-white rounded-none border-r border-gray-200 px-6"
            >
              Shipping Order Details
            </TabsTrigger>
            <TabsTrigger
              value="containers"
              className="data-[state=active]:bg-white rounded-none border-r border-gray-200 px-6"
            >
              Manage Containers
            </TabsTrigger>
            <TabsTrigger value="add-containers" className="data-[state=active]:bg-white rounded-none px-6">
              Add Containers
            </TabsTrigger>
          </TabsList>

          {/* Shipping Order Details Tab */}
          <TabsContent value="shipping-order" className="p-6 m-0">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Shipping Order Information</h2>
              <p className="text-gray-500 mb-6">Update the basic information for this shipping order.</p>

              <form onSubmit={handleSubmitShippingOrder} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="shipping_order_id" className="text-gray-700">
                    Shipping Order ID
                  </Label>
                  <Input
                    id="shipping_order_id"
                    value={shippingOrderId}
                    onChange={(e) => setShippingOrderId(e.target.value)}
                    placeholder="e.g., SO-12345"
                    className="border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vessel" className="text-gray-700">
                    Vessel
                  </Label>
                  <Input
                    id="vessel"
                    value={vessel}
                    onChange={(e) => setVessel(e.target.value)}
                    placeholder="e.g., MAERSK SELETAR"
                    className="border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">Estimated Time of Arrival (ETA)</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal border-gray-300",
                            !date && "text-muted-foreground",
                          )}
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

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Saving..." : "Save Shipping Order Details"}
                </Button>
              </form>
            </div>
          </TabsContent>

          {/* Manage Containers Tab */}
          <TabsContent value="containers" className="p-6 m-0">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Manage Containers</h2>
                <p className="text-gray-500">
                  {shipment.containers.length} container{shipment.containers.length !== 1 ? "s" : ""} in this shipment
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-500">Completion:</div>
                <div className="w-32 bg-gray-200 rounded-full h-2.5">
                  <div
                    className={cn(
                      "h-2.5 rounded-full",
                      completionPercentage === 100 ? "bg-emerald-500" : "bg-blue-500",
                    )}
                    style={{ width: `${completionPercentage}%` }}
                  ></div>
                </div>
                <div className="text-sm font-medium">{completionPercentage}%</div>
              </div>
            </div>

            <Alert className="mb-6 bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Container statuses are automatically updated every 10 minutes by checking the port portal. Once a
                container is marked as "Gate in" with a truck number, it's considered complete.
              </AlertDescription>
            </Alert>

            {shipment.containers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-lg font-medium">No containers found for this shipment</p>
                <p className="mt-1">Add containers in the "Add Containers" tab</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="font-semibold">Container No</TableHead>
                      <TableHead className="font-semibold">Container Type</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Gate In Time</TableHead>
                      <TableHead className="font-semibold">Truck No</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipment.containers.map((container) => (
                      <TableRow key={container.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{container.container_no}</TableCell>
                        <TableCell>{container.container_type || "Not specified"}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeClass(container.status)}>{container.status}</Badge>
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
                              className="border-gray-300 hover:bg-gray-50"
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
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
                  <h3 className="text-lg font-bold mb-4 text-gray-800">Edit Container</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-container-no" className="text-gray-700">
                        Container Number
                      </Label>
                      <Input
                        id="edit-container-no"
                        value={editingContainer.container_no}
                        onChange={(e) => setEditingContainer({ ...editingContainer, container_no: e.target.value })}
                        className="border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-container-type" className="text-gray-700">
                        Container Type
                      </Label>
                      <Select
                        value={editingContainer.container_type}
                        onValueChange={(value) => setEditingContainer({ ...editingContainer, container_type: value })}
                      >
                        <SelectTrigger id="edit-container-type" className="border-gray-300">
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
                      <Button variant="outline" onClick={() => setEditingContainer(null)} className="border-gray-300">
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUpdateContainer}
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isSubmitting ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Add Containers Tab */}
          <TabsContent value="add-containers" className="p-6 m-0">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Add New Containers</h2>
            <p className="text-gray-500 mb-6">Add containers to this shipping order</p>

            <form id="add-containers-form" onSubmit={handleAddContainers}>
              <Tabs defaultValue="individual" className="mt-2">
                <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                  <TabsTrigger value="individual" className="data-[state=active]:bg-white">
                    Individual Entry
                  </TabsTrigger>
                  <TabsTrigger value="bulk" className="data-[state=active]:bg-white">
                    Bulk Entry
                  </TabsTrigger>
                </TabsList>
                <input type="hidden" name="inputMethod" value="individual" />
                <TabsContent value="individual">
                  <div className="space-y-4 mt-4">
                    {newContainers.map((container, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <Input
                          placeholder="Container Number"
                          value={container.container_no}
                          onChange={(e) => handleContainerChange(index, "container_no", e.target.value)}
                          className="flex-1 border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                        />
                        <Select
                          value={container.container_type}
                          onValueChange={(value) => handleContainerChange(index, "container_type", value)}
                        >
                          <SelectTrigger className="w-[140px] border-gray-300">
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
                          className="text-gray-500 hover:text-red-500 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddContainer}
                      className="w-full border-dashed border-gray-300 hover:bg-gray-50"
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Container
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="bulk">
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="bulk-containers" className="text-gray-700">
                        Enter Container Numbers (one per line)
                      </Label>
                      <Textarea
                        id="bulk-containers"
                        placeholder="CONT-001&#10;CONT-002&#10;CONT-003"
                        className="min-h-[200px] font-mono border-gray-300 focus:border-blue-400 focus:ring-blue-400"
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
                        <span className="w-full border-t border-gray-300" />
                      </div>
                      <span className="relative bg-white px-2 text-xs text-gray-500">OR</span>
                    </div>
                    <div>
                      <Label htmlFor="excel-upload" className="text-gray-700">
                        Upload Excel File
                      </Label>
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
                          className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-md p-6 cursor-pointer hover:bg-gray-50"
                        >
                          <Upload className="h-6 w-6 text-gray-400" />
                          <span className="text-gray-600">Click to upload Excel file</span>
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
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Containers"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
