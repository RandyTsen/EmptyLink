// scripts/batchScrape.js

// 1) Load .env.local from your project root
const path = require('path')
require('dotenv').config({
  path: path.resolve(__dirname, '../.env.local'),
})

// 2) Grab & validate env vars
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCRAPER_URL  = process.env.SCRAPER_URL

if (!SUPABASE_URL || !SUPABASE_KEY || !SCRAPER_URL) {
  console.error('❌ Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SCRAPER_URL in .env.local')
  process.exit(1)
}

// 3) Dependencies & client
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// 4) Constants
const BATCH_SIZE        = 25
const SCRAPER_ENDPOINT  = `${SCRAPER_URL.replace(/\/$/, '')}/api/scrape`
const INTERVAL_MINUTES  = 20
const INTERVAL_MS       = INTERVAL_MINUTES * 60 * 1000

// 5) The scraping/upsert job
async function scrapeAndUpsert() {
  console.log(`[BatchScrape] ${new Date().toISOString()}: Starting batch scrape`)

  // a) fetch pending
  const { data: pending, error: selErr } = await supabase
    .from('containers_tracking')
    .select('container_no')
    .is('gate_in_time', null)
    .is('truck_no', null)
    .limit(BATCH_SIZE)

  if (selErr) {
    console.error('[BatchScrape] Error fetching pending:', selErr)
    return
  }
  if (!pending.length) {
    console.log('[BatchScrape] No pending containers; exiting.')
    return
  }

  const ids = pending.map(r => r.container_no)
  console.log(`[BatchScrape] Scraping ${ids.length} containers:`, ids)

  // b) call your scraper
  let results
  try {
    const resp = await fetch(SCRAPER_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ containers: ids }),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    results = await resp.json()
  } catch (err) {
    console.error('[BatchScrape] Scraper call error:', err)
    return
  }

  // c) parse & upsert
  for (const { container, gateInTime, truckOrVessel, skipped } of results) {
    if (skipped || !gateInTime) {
      console.log(`[BatchScrape] Skipped ${container}`)
      continue
    }

    // parse DD/MM/YYYY HH:mm → ISO
    let isoTime
    try {
      const [datePart, timePart] = gateInTime.split(' ')
      const [dd, mm, yyyy]       = datePart.split('/')
      const [hh, mi]             = timePart.split(':')
      isoTime = new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(mi)
      ).toISOString()
      console.log(`[BatchScrape] Parsed "${gateInTime}" → "${isoTime}"`)
    } catch (parseErr) {
      console.error(`[BatchScrape] Failed to parse "${gateInTime}":`, parseErr)
      continue
    }

    const { error: updErr } = await supabase
      .from('containers_tracking')
      .update({
        gate_in_time: isoTime,
        truck_no:     truckOrVessel,
      })
      .eq('container_no', container)

    if (updErr) {
      console.error(`[BatchScrape] Update failed for ${container}:`, updErr)
    } else {
      console.log(`[BatchScrape] Updated ${container} → ${isoTime} / ${truckOrVessel}`)
    }
  }

  console.log('[BatchScrape] Batch complete.')
}

// 6) Kick off and schedule with setInterval

// Run immediately once
scrapeAndUpsert()

// Then every INTERVAL_MS, but skip the 1 AM–6 AM window
setInterval(() => {
  const hr = new Date().getHours()
  if (hr >= 1 && hr < 6) {
    console.log('[BatchScrape] Skipping scheduled run during 1–6 AM')
    return
  }
  scrapeAndUpsert()
}, INTERVAL_MS)

console.log(`✅ Scheduler running: every ${INTERVAL_MINUTES} minutes (skipping 1–6 AM)`)
