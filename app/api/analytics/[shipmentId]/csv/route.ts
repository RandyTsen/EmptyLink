import { NextResponse } from "next/server"
import { getShipmentById } from "@/services/dbService"
import { format } from "date-fns"

export async function GET(request: Request, { params }: { params: { shipmentId: string } }) {
  try {
    const shipmentId = params.shipmentId

    // Fetch the shipment data
    const shipment = await getShipmentById(shipmentId)

    if (!shipment) {
      return new NextResponse("Shipment not found", { status: 404 })
    }

    // Prepare container data for CSV
    const containerData = shipment.containers.map((container) => ({
      container_no: container.container_no,
      container_type: container.container_type || "N/A",
      status: container.status,
      gate_in_time: container.gate_in_time ? format(new Date(container.gate_in_time), "yyyy-MM-dd HH:mm:ss") : "N/A",
      truck_no: container.truck_no || "N/A",
    }))

    // Create CSV header
    const csvHeader = "Container No,Type,Status,Gate-In Time,Truck No\n"

    // Create CSV rows
    const csvRows = containerData
      .map(
        (container) =>
          `${container.container_no},${container.container_type},${container.status},${container.gate_in_time},${container.truck_no}`,
      )
      .join("\n")

    // Combine header and rows
    const csvContent = csvHeader + csvRows

    // Return CSV as response
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=shipment-${shipment.shipping_order_id}.csv`,
      },
    })
  } catch (error) {
    console.error("Error generating CSV:", error)
    return new NextResponse("Error generating CSV", { status: 500 })
  }
}
