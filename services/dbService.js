import supabase from "./supabaseClient"

/**
 * Fetches all shipments with their associated container tracking information
 * @param {boolean} includeArchived - Whether to include archived shipments
 * @returns {Promise<Array>} Array of shipment objects with nested containers
 */
export async function getShipmentsWithTracking(includeArchived = false) {
  try {
    // Fetch all shipments
    const query = supabase.from("shipments").select("*").order("eta", { ascending: true })

    // Only filter by archived status if includeArchived is false
    // We'll handle filtering in memory to be more resilient to schema changes
    const { data: shipments, error: shipmentsError } = await query

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

    // Combine shipments with their containers and filter by archived status in memory
    let shipmentsWithContainers = shipments.map((shipment) => ({
      ...shipment,
      containers: containersByShipment[shipment.id] || [],
      status: determineShipmentStatus(containersByShipment[shipment.id] || []),
      // Ensure archived is a boolean, default to false if not present
      archived: shipment.archived === true,
    }))

    // Filter out archived shipments if not requested
    if (!includeArchived) {
      shipmentsWithContainers = shipmentsWithContainers.filter((shipment) => !shipment.archived)
    }

    return shipmentsWithContainers
  } catch (error) {
    console.error("Error in getShipmentsWithTracking:", error)
    throw error
  }
}

/**
 * Updates a shipment's archive status
 * @param {string} id - The shipment ID
 * @param {boolean} archived - Whether the shipment should be archived
 * @returns {Promise<Object>} Updated shipment
 */
export async function updateShipmentArchiveStatus(id, archived) {
  try {
    // Create an update object with only the fields we want to update
    const updateData = {
      archived: archived,
    }

    // Add updated_at if it exists in the schema
    try {
      updateData.updated_at = new Date().toISOString()
    } catch (e) {
      console.warn("Could not set updated_at field:", e)
    }

    const { data: shipment, error } = await supabase.from("shipments").update(updateData).eq("id", id).select().single()

    if (error) {
      console.error("Error updating shipment archive status:", error)
      throw new Error(error.message)
    }

    return shipment
  } catch (error) {
    console.error("Error in updateShipmentArchiveStatus:", error)
    throw error
  }
}

/**
 * Fetches all shipments with their associated container tracking information for analytics
 * @returns {Promise<Array>} Array of shipment objects with nested containers
 */
export async function getAllShipmentsForAnalytics() {
  // This function includes all shipments, including archived ones
  return getShipmentsWithTracking(true)
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
      .order("container_no", { ascending: true })

    if (containersError) {
      console.error("Error fetching containers:", containersError)
      throw new Error(containersError.message)
    }

    // Return the shipment with its containers
    return {
      ...shipment,
      containers: containers || [],
      status: determineShipmentStatus(containers || []),
      // Ensure archived is a boolean, default to false if not present
      archived: shipment.archived === true,
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
    // Create the shipping order with required fields
    const shipmentData = {
      shipping_order_id: data.shipping_order_id,
      vessel: data.vessel,
      eta: data.eta,
      archived: false, // Default to not archived
    }

    // Add timestamps if they exist in the schema
    try {
      const now = new Date().toISOString()
      shipmentData.created_at = now
      shipmentData.updated_at = now
    } catch (e) {
      console.warn("Could not set timestamp fields:", e)
    }

    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments")
      .insert(shipmentData)
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
      container_type: container.container_type || "20' GP",
      status: container.status || "pending",
      gate_in_time: null,
      truck_no: null,
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
 * Updates a shipping order
 * @param {string} id - The shipment ID
 * @param {Object} data - Updated shipping order data
 * @returns {Promise<Object>} Updated shipping order
 */
export async function updateShipment(id, data) {
  try {
    // Create an update object with only the fields we want to update
    const updateData = {
      shipping_order_id: data.shipping_order_id,
      vessel: data.vessel,
      eta: data.eta,
    }

    // Add updated_at if it exists in the schema
    try {
      updateData.updated_at = new Date().toISOString()
    } catch (e) {
      console.warn("Could not set updated_at field:", e)
    }

    const { data: shipment, error } = await supabase.from("shipments").update(updateData).eq("id", id).select().single()

    if (error) {
      console.error("Error updating shipping order:", error)
      throw new Error(error.message)
    }

    return shipment
  } catch (error) {
    console.error("Error in updateShipment:", error)
    throw error
  }
}

/**
 * Updates a container
 * @param {string} id - The container ID
 * @param {Object} data - Updated container data
 * @returns {Promise<Object>} Updated container
 */
export async function updateContainer(id, data) {
  try {
    // Create an update object with only the fields we want to update
    const updateData = {
      container_no: data.container_no,
      container_type: data.container_type,
    }

    // Add updated_at if needed
    try {
      updateData.updated_at = new Date().toISOString()
    } catch (e) {
      console.warn("Could not set updated_at field:", e)
    }

    const { data: container, error } = await supabase
      .from("containers_tracking")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating container:", error)
      throw new Error(error.message)
    }

    return container
  } catch (error) {
    console.error("Error in updateContainer:", error)
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
        // Ensure archived is a boolean, default to false if not present
        archived: shipment.archived === true,
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

  if (statuses.every((s) => s === "delivered" || s === "gate in")) {
    return "completed"
  } else if (statuses.some((s) => s === "in transit" || s === "delivered" || s === "gate in")) {
    return "executing"
  } else {
    return "on plan"
  }
}

/**
 * Adds new containers to an existing shipment
 * @param {string} shipmentId - The shipment ID
 * @param {Array} containers - Array of container objects
 * @returns {Promise<Array>} Array of created container objects
 */
export async function addContainersToShipment(shipmentId, containers) {
  try {
    const containersData = containers.map((container) => ({
      shipment_id: shipmentId,
      container_no: container.container_no,
      container_type: container.container_type || "20' GP",
      status: "pending", // Always start with pending status
      gate_in_time: null,
      truck_no: null,
    }))

    const { data, error } = await supabase.from("containers_tracking").insert(containersData).select()

    if (error) {
      console.error("Error adding containers:", error)
      throw new Error(error.message)
    }

    // Update the shipment's updated_at timestamp if the column exists
    try {
      await supabase.from("shipments").update({ updated_at: new Date().toISOString() }).eq("id", shipmentId)
    } catch (e) {
      console.warn("Could not update shipment timestamp:", e)
    }

    return data
  } catch (error) {
    console.error("Error in addContainersToShipment:", error)
    throw error
  }
}

/**
 * Deletes a container
 * @param {string} containerId - The container ID
 * @returns {Promise<void>}
 */
export async function deleteContainer(containerId) {
  try {
    // First check if the container is in pending status
    const { data: container, error: fetchError } = await supabase
      .from("containers_tracking")
      .select("status")
      .eq("id", containerId)
      .single()

    if (fetchError) {
      console.error("Error fetching container:", fetchError)
      throw new Error(fetchError.message)
    }

    // Only allow deletion of pending containers
    if (container.status.toLowerCase() !== "pending") {
      throw new Error("Only pending containers can be deleted")
    }

    const { error } = await supabase.from("containers_tracking").delete().eq("id", containerId)

    if (error) {
      console.error("Error deleting container:", error)
      throw new Error(error.message)
    }
  } catch (error) {
    console.error("Error in deleteContainer:", error)
    throw error
  }
}

/**
 * Deletes a shipment and its associated containers
 * @param {string} shipmentId - The shipment ID
 * @returns {Promise<void>}
 */
export async function deleteShipment(shipmentId) {
  try {
    // First delete all containers associated with this shipment
    const { error: containersError } = await supabase.from("containers_tracking").delete().eq("shipment_id", shipmentId)

    if (containersError) {
      console.error("Error deleting containers:", containersError)
      throw new Error(containersError.message)
    }

    // Then delete the shipment itself
    const { error: shipmentError } = await supabase.from("shipments").delete().eq("id", shipmentId)

    if (shipmentError) {
      console.error("Error deleting shipment:", shipmentError)
      throw new Error(shipmentError.message)
    }
  } catch (error) {
    console.error("Error in deleteShipment:", error)
    throw error
  }
}
