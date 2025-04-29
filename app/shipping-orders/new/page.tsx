"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarIcon, Upload, Plus, Trash2, ArrowLeft, Ship, Clock } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { createShippingOrder } from "@/services/dbService"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { read, utils } from "xlsx"
import { TimeField } from "@/components/ui/time-field"

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

export default function NewShippingOrderPage() {
  const router = useRouter()
  const [date, setDate] = useState<Date>()
  const [time, setTime] = useState<{ hours: number; minutes: number }>({ hours: 12, minutes: 0 })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [containers, setContainers] = useState<{ container_no: string; container_type: string; status: string }[]>([
    { container_no: "", container_type: "20' GP", status: "pending" },
  ])
  const [bulkContainers, setBulkContainers] = useState<string>("")

  const handleAddContainer = () => {
    setContainers([...containers, { container_no: "", container_type: "20' GP", status: "pending" }])
  }

  const handleRemoveContainer = (index: number) => {
    const newContainers = [...containers]
    newContainers.splice(index, 1)
    setContainers(newContainers)
  }

  const handleContainerChange = (index: number, field: string, value: string) => {
    const newContainers = [...containers]
    newContainers[index][field] = value
    setContainers(newContainers)
  }

  const handleBulkContainersChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
          status: "pending",
        }
      })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = utils.sheet_to_json<{ container_no: string; container_type?: string }>(worksheet)

      if (jsonData.length === 0 || !jsonData[0].container_no) {
        setError("Invalid Excel format. Please ensure the file has a 'container_no' column.")
        return
      }

      const newContainers = jsonData.map((row) => ({
        container_no: row.container_no,
        container_type: row.container_type || "20' GP", // Use provided type or default
        status: "pending",
      }))

      setContainers(newContainers)
      setSuccess("Excel file uploaded successfully!")
    } catch (err) {
      console.error("Error processing Excel file:", err)
      setError("Failed to process Excel file. Please check the format and try again.")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const shipping_order_id = formData.get("shipping_order_id") as string
    const vessel = formData.get("vessel") as string

    // Combine date and time
    let eta = null
    if (date) {
      const etaDate = new Date(date)
      etaDate.setHours(time.hours)
      etaDate.setMinutes(time.minutes)
      eta = etaDate.toISOString()
    }

    // Get containers from either the individual inputs or bulk input
    const finalContainers = formData.get("inputMethod") === "bulk" ? processBulkContainers() : containers

    if (!shipping_order_id || !vessel || !eta) {
      setError("Please fill in all required fields.")
      setIsSubmitting(false)
      return
    }

    if (finalContainers.length === 0 || finalContainers.some((c) => !c.container_no)) {
      setError("Please add at least one valid container.")
      setIsSubmitting(false)
      return
    }

    try {
      await createShippingOrder({
        shipping_order_id,
        vessel,
        eta,
        containers: finalContainers,
      })

      setSuccess("Shipping order created successfully!")
      form.reset()
      setContainers([{ container_no: "", container_type: "20' GP", status: "pending" }])
      setBulkContainers("")
      setDate(undefined)
      setTime({ hours: 12, minutes: 0 })

      // Redirect to the shipping orders list after a short delay
      setTimeout(() => {
        router.push("/shipping-orders")
      }, 2000)
    } catch (err) {
      console.error("Error creating shipping order:", err)
      setError("Failed to create shipping order. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <Ship className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Register New Shipping Order</h1>
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

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Shipping Order Details</CardTitle>
            <CardDescription>Enter the basic information for this shipping order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shipping_order_id">Shipping Order ID</Label>
                <Input id="shipping_order_id" name="shipping_order_id" placeholder="e.g., SO-12345" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vessel">Vessel</Label>
                <Input id="vessel" name="vessel" placeholder="e.g., MAERSK SELETAR" required />
              </div>
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

            <div className="pt-4">
              <Label>Container Information</Label>
              <Tabs defaultValue="bulk" className="mt-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="individual">Individual Entry</TabsTrigger>
                  <TabsTrigger value="bulk">Bulk Entry</TabsTrigger>
                </TabsList>
                <input type="hidden" name="inputMethod" value="bulk" />
                <TabsContent value="individual">
                  <div className="space-y-4 mt-4">
                    {containers.map((container, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="Container Number"
                          value={container.container_no}
                          onChange={(e) => handleContainerChange(index, "container_no", e.target.value)}
                          className="flex-1"
                        />
                        <select
                          value={container.container_type}
                          onChange={(e) => handleContainerChange(index, "container_type", e.target.value)}
                          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {CONTAINER_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveContainer(index)}
                          disabled={containers.length === 1}
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
                        placeholder="PCIU1234535 20 GP&#10;CONT1234567 40 HC&#10;ABCD7654321"
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
                      <div className="mt-4 p-3 bg-blue-50 rounded-md text-sm text-blue-800">
                        <p className="font-medium">Excel Template Format:</p>
                        <p className="mt-1">Your Excel file should have these columns:</p>
                        <ul className="list-disc pl-5 mt-1">
                          <li>
                            <strong>container_no</strong> - Container number (required)
                          </li>
                          <li>
                            <strong>container_type</strong> - Container type (optional, defaults to 20' GP)
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Shipping Order"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
