/*
  scripts/scrapePending.js
  Pulls pending containers, scrapes gate-in status using your batchScrape.js,
  and upserts results into containers_tracking.
*/

require('dotenv').config({ path: './.env.local' })
const { createClient } = require('@supabase/supabase-js')
const { getPendingContainers, upsertStatus } = require('../lib/supabaseClient')

// Point at your existing batchScrape.js
const { scrapeContainer } = require('../scraper-service/scripts/batchScrape')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function run() {
  // 1) load all active shipments
  const { data: orders, error: ordersErr } = await supabase
    .from('shipments')
    .select('id')
    .eq('archived', false)

  if (ordersErr) {
    console.error('Failed to load shipments:', ordersErr)
    return
  }

  // 2) for each shipment, get its pending containers
  for (const { id: shipmentId } of orders) {
    const pending = await getPendingContainers(shipmentId)
    if (!pending.length) continue

    // 3) scrape each pending container
    for (const containerNo of pending) {
      try {
        // batchScrape.js should export async scrapeContainer(no) → { gateInTime, truckNumber }
        const { gateInTime, truckNumber } = await scrapeContainer(containerNo)

        if (gateInTime) {
          // 4) upsert the scraped status
          await upsertStatus({
            shipmentId,
            containerNo,
            status:      'Gate-in',
            gateInTime,
            truckNumber,
          })
          console.log(`✓ ${containerNo}: gate-in at ${gateInTime} by ${truckNumber}`)
        } else {
          console.log(`– ${containerNo}: still pending`)
        }
      } catch (err) {
        console.error(`Error scraping ${containerNo}:`, err)
      }
    }
  }
}

run().catch(console.error)
