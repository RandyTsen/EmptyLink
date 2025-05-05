// pages/api/scrape.js

import path from "path"
import { createClient } from "@supabase/supabase-js"

// 1) Load your .env.local so process.env.SCRAPER_URL and keys are available
require("dotenv").config({
  path: path.resolve(process.cwd(), ".env.local"),
})

// 2) Init Supabase with your service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 3) Constants
const BATCH_SIZE        = 25
const SCRAPER_URL       = process.env.SCRAPER_URL?.replace(/\/$/, "")
const SCRAPER_ENDPOINT  = `${SCRAPER_URL}/api/scrape`

// 4) Scrape + upsert logic
async function scrapeAndUpsert() {
  console.log("[/api/scrape] Starting…")

  // a) grab up to BATCH_SIZE pending containers
  const { data: pending, error: selErr } = await supabase
    .from("containers_tracking")
    .select("container_no")
    .is("gate_in_time", null)
    .is("truck_no",     null)
    .limit(BATCH_SIZE)

  if (selErr) throw new Error("Error fetching pending: " + selErr.message)
  if (!pending.length) {
    console.log("[/api/scrape] Nothing to do.")
    return
  }

  const ids = pending.map((r) => r.container_no)
  console.log("[/api/scrape] Scraping:", ids)

  // b) call your external scraper service via the built-in fetch
  const resp = await fetch(SCRAPER_ENDPOINT, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ containers: ids }),
  })
  if (!resp.ok) throw new Error(`Scraper HTTP ${resp.status}`)

  const results = await resp.json()

  // c) parse each result and update Supabase
  for (const { container, gateInTime, truckOrVessel, skipped } of results) {
    if (skipped || !gateInTime) {
      console.log(`[/api/scrape] Skipped ${container}`)
      continue
    }

    // parse "DD/MM/YYYY HH:mm" → ISO string
    const [datePart, timePart] = gateInTime.split(" ")
    const [dd, mm, yyyy]       = datePart.split("/")
    const [hh, mi]             = timePart.split(":")
    const isoTime = new Date(
      +yyyy, +mm - 1, +dd,
      +hh,   +mi
    ).toISOString()

    const { error: updErr } = await supabase
      .from("containers_tracking")
      .update({ gate_in_time: isoTime, truck_no: truckOrVessel })
      .eq("container_no", container)

    if (updErr) {
      console.error(`[/api/scrape] Update failed for ${container}:`, updErr)
    } else {
      console.log(`[/api/scrape] Updated ${container} → ${isoTime} / ${truckOrVessel}`)
    }
  }

  console.log("[/api/scrape] Batch complete.")
}

// 5) Export the Next.js API handler
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end("Method Not Allowed")
  }

  try {
    await scrapeAndUpsert()
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error("[/api/scrape] ERROR:", err)
    return res.status(500).json({ error: err.message })
  }
}
