// scraper-service/index.js
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const {
  portalLogin,
  portalLogout,
  setPage
} = require('./services/portalServices');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const app = express();
app.use(express.json());

// Allow your dashboard at localhost:3000 to call this service
app.use(cors({ origin: 'http://localhost:3000' }));

app.post('/api/scrape', async (req, res) => {
  try {
    const { containers } = req.body;
    if (!Array.isArray(containers)) {
      return res.status(400).json({ error: 'containers must be an array' });
    }

    // 1) Launch browser + login
    const browser = await chromium.launch();
    const page    = await browser.newPage();
    setPage(page);
    await portalLogin(
      process.env.PORTAL_EMAIL,
      process.env.PORTAL_PASS,
      process.env.PORTAL_URL
    );
    await page.goto(process.env.SEARCH_URL);

    const results = [];

    for (const container of containers) {
      // 2) Check if we already have gate_in_time & truck_no
      const { data: existingArr, error: selErr } = await supabase
        .from('containers_tracking')
        .select('gate_in_time, truck_no')
        .eq('container_no', container)
        .limit(1);

      if (selErr) console.error('Select error:', selErr);
      const existing = existingArr?.[0];

      if (existing && existing.gate_in_time && existing.truck_no) {
        // Already scraped → skip
        results.push({
          container,
          gateInTime: existing.gate_in_time,
          truckOrVessel: existing.truck_no,
          skipped: true
        });
        continue;
      }

      // 3) Perform the portal search
      await page.fill('#cnid_text', container);
      await page.click('button:has-text("Search")');
      await page.waitForSelector(
        'table thead th:has-text("Date and Time")',
        { timeout: 60000 }
      );

      const gateInRow = page.locator(
        'table tbody tr',
        { hasText: 'Gate-In' }
      ).first();

      let dt = null, vt = null;
      if (await gateInRow.count()) {
        dt = (await gateInRow.locator('td').nth(0).innerText()).trim();
        vt = (await gateInRow.locator('td').nth(9).innerText()).trim();
      }

      // 4) Update the Supabase row
      const { error: updErr } = await supabase
        .from('containers_tracking')
        .update({
          gate_in_time: dt,
          truck_no:     vt
        })
        .eq('container_no', container);

      if (updErr) console.error('Update error:', updErr);

      results.push({
        container,
        gateInTime: dt,
        truckOrVessel: vt,
        skipped: false
      });

      // 5) Clear the input for the next iteration
      await page.fill('#cnid_text', '');
    }

    // 6) Logout & cleanup
    await portalLogout(process.env.PORTAL_LOGOUT_URL);
    await browser.close();

    // 7) Return full summary
    res.json(results);

  } catch (err) {
    console.error('Scrape error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start the service
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🕵️‍♂️ Scraper running on http://localhost:${PORT}`)
);
