import { getShipmentById } from "@/services/dbService"
import ShipmentAnalyticsClient from "./client"

// Server component for metadata generation
export async function generateMetadata({ params }) {
  try {
    const shipment = await getShipmentById(params.shipmentId)
    return {
      title: `Analytics: ${shipment.shipping_order_id}`,
      description: `Analytics for shipment ${shipment.shipping_order_id}`,
    }
  } catch (error) {
    return {
      title: "Shipment Analytics",
      description: "Detailed analytics for shipment",
    }
  }
}

// Server component that renders the client component
export default async function ShipmentAnalyticsPage({ params }) {
  return <ShipmentAnalyticsClient params={params} />
}
