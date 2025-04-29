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
import { CalendarIcon, Upload, Plus, Trash2, ArrowLeft, Ship } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { createShippingOrder } from "@/services/dbService"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { read, utils } from "xlsx"

export default function NewShippingOrderPage() {
  const router = useRouter()
  const [date, setDate] = useState<Date>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [containers, setContainers] = useState<{ container_no: string; status: string }[]>([
    { container_no: "", status: "pending" },
  ])
  const [bulkContainers, setBulkContainers] = useState<string>("")

  const handleAddContainer = () => {
    setContainers([...containers, { container_no: "", status: "pending" }])
  }

  const handleRemoveContainer = (index: number) => {
    const newContainers = [...containers]
    newContainers.splice(index, 1)
    setContainers(newContainers)
  }

  const handleContainerChange = (index: number, value: string) => {
    const newContainers = [...containers]
    newContainers[index].container_no = value
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
      .map((container_no) => ({
        container_no,
        status: "pending",
      }))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = utils.sheet_to_json<{ container_no: string }>(worksheet)

      if (jsonData.length === 0 || !jsonData[0].container_no) {
        setError("Invalid Excel format. Please ensure the file has a 'container_no' column.")
        return
      }

      const newContainers = jsonData.map((row) => ({
        container_no: row.container_no,
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
    const eta = date?.toISOString()

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
      setContainers([{ container_no: "", status: "pending" }])
      setBulkContainers("")
      setDate(undefined)

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
            </div>

            <div className="pt-4">
              <Label>Container Information</Label>
              <Tabs defaultValue="individual" className="mt-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="individual">Individual Entry</TabsTrigger>
                  <TabsTrigger value="bulk">Bulk Entry</TabsTrigger>
                </TabsList>
                <input type="hidden" name="inputMethod" value="individual" />
                <TabsContent value="individual">
                  <div className="space-y-4 mt-4">
                    {containers.map((container, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="Container Number"
                          value={container.container_no}
                          onChange={(e) => handleContainerChange(index, e.target.value)}
                          className="flex-1"
                        />
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
                        placeholder="CONT-001&#10;CONT-002&#10;CONT-003"
                        className="min-h-[200px] font-mono"
                        value={bulkContainers}
                        onChange={handleBulkContainersChange}
                      />
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
                        Excel file should have a column named &quot;container_no&quot;
                      </p>
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
