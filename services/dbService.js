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
      console.error("Error fetching shipments:", shipmentsError)
      throw new Error(shipmentsError.message)
    }

    // Fetch all container tracking data
    const { data: containers, error: containersError } = await supabase.from("containers_tracking").select("*")

    if (containersError) {
      console.error("Error fetching containers:", containersError)
      throw new Error(containersError.message)
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
      status: determineShipmentStatus(containersByShipment[shipment.id] || []),
    }))

    return shipmentsWithContainers
  } catch (error) {
    console.error("Error in getShipmentsWithTracking:", error)
    throw error
  }
}

/**
 * Fetches a single shipment with its associated container tracking information
 * @param {string} id - The shipment ID
 * @returns {Promise<Object>} Shipment object with nested containers
 */
export async function getShipmentById(id) {
  try {
    // Fetch the shipment
    const { data: shipment, error: shipmentError } = await supabase.from("shipments").select("*").eq("id", id).single()

    if (shipmentError) {
      console.error("Error fetching shipment:", shipmentError)
      throw new Error(shipmentError.message)
    }

    // Fetch the containers for this shipment
    const { data: containers, error: containersError } = await supabase
      .from("containers_tracking")
      .select("*")
      .eq("shipment_id", id)

    if (containersError) {
      console.error("Error fetching containers:", containersError)
      throw new Error(containersError.message)
    }

    // Return the shipment with its containers
    return {
      ...shipment,
      containers: containers || [],
      status: determineShipmentStatus(containers || []),
    }
  } catch (error) {
    console.error("Error in getShipmentById:", error)
    throw error
  }
}

/**
 * Creates a new shipping order with containers
 * @param {Object} data - Shipping order data
 * @returns {Promise<Object>} Created shipping order
 */
export async function createShippingOrder(data) {
  try {
    // Create the shipping order
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments")
      .insert({
        shipping_order_id: data.shipping_order_id,
        vessel: data.vessel,
        eta: data.eta,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (shipmentError) {
      console.error("Error creating shipping order:", shipmentError)
      throw new Error(shipmentError.message)
    }

    // Create containers for this shipment
    const containersData = data.containers.map((container) => ({
      shipment_id: shipment.id,
      container_no: container.container_no,
      status: container.status || "pending",
      gate_in_time: null,
      truck_no: null,
      last_checked: new Date().toISOString(),
    }))

    const { error: containersError } = await supabase.from("containers_tracking").insert(containersData)

    if (containersError) {
      console.error("Error creating containers:", containersError)
      throw new Error(containersError.message)
    }

    return shipment
  } catch (error) {
    console.error("Error in createShippingOrder:", error)
    throw error
  }
}

/**
 * Fetches all shipping orders with their status
 * @returns {Promise<Array>} Array of shipping order objects
 */
export async function getAllShippingOrders() {
  try {
    // Fetch all shipments
    const { data: shipments, error: shipmentsError } = await supabase
      .from("shipments")
      .select("*")
      .order("created_at", { ascending: false })

    if (shipmentsError) {
      console.error("Error fetching shipments:", shipmentsError)
      throw new Error(shipmentsError.message)
    }

    // Fetch all container tracking data
    const { data: containers, error: containersError } = await supabase.from("containers_tracking").select("*")

    if (containersError) {
      console.error("Error fetching containers:", containersError)
      throw new Error(containersError.message)
    }

    // Group containers by shipment_id
    const containersByShipment = containers.reduce((acc, container) => {
      if (!acc[container.shipment_id]) {
        acc[container.shipment_id] = []
      }
      acc[container.shipment_id].push(container)
      return acc
    }, {})

    // Combine shipments with their containers and determine status
    const shipmentsWithContainers = shipments.map((shipment) => {
      const shipmentContainers = containersByShipment[shipment.id] || []
      return {
        ...shipment,
        containers: shipmentContainers,
        status: determineShipmentStatus(shipmentContainers),
      }
    })

    return shipmentsWithContainers
  } catch (error) {
    console.error("Error in getAllShippingOrders:", error)
    throw error
  }
}

/**
 * Determines the status of a shipment based on its containers
 * @param {Array} containers - Array of container objects
 * @returns {string} Status of the shipment
 */
function determineShipmentStatus(containers) {
  if (containers.length === 0) return "on plan"

  const statuses = containers.map((c) => c.status.toLowerCase())

  if (statuses.every((s) => s === "delivered")) {
    return "completed"
  } else if (statuses.some((s) => s === "in transit" || s === "delivered")) {
    return "executing"
  } else {
    return "on plan"
  }
}

/**
 * Updates the status of a container
 * @param {string} id - The container ID
 * @param {string} status - The new status
 * @returns {Promise<Object>} Updated container object
 */
export async function updateContainerStatus(id, status) {
  try {
    const { data, error } = await supabase
      .from("containers_tracking")
      .update({
        status,
        last_checked: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating container status:", error)
      throw new Error(error.message)
    }

    return data
  } catch (error) {
    console.error("Error in updateContainerStatus:", error)
    throw error
  }
}

/**
 * Updates the truck number of a container
 * @param {string} id - The container ID
 * @param {string} truckNo - The new truck number
 * @returns {Promise<Object>} Updated container object
 */
export async function updateContainerTruck(id, truckNo) {
  try {
    const { data, error } = await supabase
      .from("containers_tracking")
      .update({
        truck_no: truckNo,
        last_checked: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating container truck:", error)
      throw new Error(error.message)
    }

    return data
  } catch (error) {
    console.error("Error in updateContainerTruck:", error)
    throw error
  }
}
