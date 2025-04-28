import supabase from "./supabaseClient"

/**
 * Fetches all shipments with their associated container tracking information
 * @returns {Promise<Array>} Array of shipment objects with nested containers
 */
export async function getShipmentsWithTracking() {
  try {
    // Fetch all shipments
    const { data: shipments, error: shipmentsError } = await supabase
      .from("shipments")
      .select("*")
      .order("eta", { ascending: true })

    if (shipmentsError) {
      throw shipmentsError
    }

    // Fetch all container tracking data
    const { data: containers, error: containersError } = await supabase.from("containers_tracking").select("*")

    if (containersError) {
      throw containersError
    }

    // Group containers by shipment_id
    const containersByShipment = containers.reduce((acc, container) => {
      if (!acc[container.shipment_id]) {
        acc[container.shipment_id] = []
      }
      acc[container.shipment_id].push(container)
      return acc
    }, {})

    // Combine shipments with their containers
    const shipmentsWithContainers = shipments.map((shipment) => ({
      ...shipment,
      containers: containersByShipment[shipment.id] || [],
    }))

    return shipmentsWithContainers
  } catch (error) {
    console.error("Error in getShipmentsWithTracking:", error)
    throw error
  }
}
