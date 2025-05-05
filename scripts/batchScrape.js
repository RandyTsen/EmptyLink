/*
  scripts/batchScrape.js
  Batch scraper for pending containers → upsert into containers_tracking.
  Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
*/

const path = require("path")
// Load env from project root
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") })

// Grab both URL and a service-role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const { createClient } = require("@supabase/supabase-js")
// Node 22+ has global fetch
const fetch = global.fetch

// Initialize Supabase with full privileges
const supabase = createClient(supabaseUrl, supabaseKey)

// Constants
const BATCH_SIZE       = 25
const SCRAPER_ENDPOINT = `${process.env.SCRAPER_URL}/api/scrape`

async function main() {
  console.log(`[BatchScrape] ${new Date().toISOString()}: Starting batch scrape`)

  // 1) Load up to BATCH_SIZE pending containers
  const { data: pending, error: selErr } = await supabase
    .from("containers_tracking")
    .select("container_no")
    .is("gate_in_time", null)
    .is("truck_no", null)
    .limit(BATCH_SIZE)

  if (selErr) {
    console.error("[BatchScrape] Error fetching pending:", selErr)
    process.exit(1)
  }
  if (!pending.length) {
    console.log("[BatchScrape] No pending containers; exiting.")
    return
  }

  const ids = pending.map((r) => r.container_no)
  console.log(`[BatchScrape] Scraping ${ids.length} containers:`, ids)

  // 2) POST to your scraper service
  let results
  try {
    const resp = await fetch(SCRAPER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ containers: ids }),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    results = await resp.json()
  } catch (err) {
    console.error("[BatchScrape] Scraper call error:", err)
    process.exit(1)
  }

  // 3) Upsert each gate-in result
  for (const { container, gateInTime, truckOrVessel, skipped } of results) {
    if (skipped || !gateInTime) {
      console.log(`[BatchScrape] Skipped ${container}`)
      continue
    }

    // Parse DD/MM/YYYY HH:mm → ISO
    let isoTime
    try {
      const [datePart, timePart] = gateInTime.split(" ")
      const [dd, mm, yyyy]       = datePart.split("/")
      const [hh, mi]             = timePart.split(":")
      isoTime = new Date(
        +yyyy, +mm - 1, +dd, +hh, +mi
      ).toISOString()
      console.log(`[BatchScrape] Parsed "${gateInTime}" → "${isoTime}"`)
    } catch (parseErr) {
      console.error(`[BatchScrape] Failed to parse "${gateInTime}":`, parseErr)
      continue
    }

    const { error: updErr } = await supabase
      .from("containers_tracking")
      .update({
        gate_in_time: isoTime,
        truck_no:     truckOrVessel,
      })
      .eq("container_no", container)

    if (updErr) {
      console.error(`[BatchScrape] Update failed for ${container}:`, updErr)
    } else {
      console.log(`[BatchScrape] Updated ${container} → ${isoTime} / ${truckOrVessel}`)
    }
  }

  console.log("[BatchScrape] Batch complete.")
}

main().catch((err) => {
  console.error("[BatchScrape] Unhandled error:", err)
  process.exit(1)
})
