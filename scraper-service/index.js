const express = require('express');
const { chromium } = require('playwright');
require('dotenv').config();
const { portalLogin, portalLogout, setPage } = require('./services/portalServices');
const { fetchMultipleContainerInfo } = require('./services/containerServices');

const app = express();
app.use(express.json());

app.post('/api/scrape', async (req, res) => {
  const { containers } = req.body;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  setPage(page);

  await portalLogin(
    process.env.PORTAL_EMAIL,
    process.env.PORTAL_PASS,
    process.env.PORTAL_URL
  );
  const results = await fetchMultipleContainerInfo(containers, {});
  await portalLogout(process.env.PORTAL_LOGOUT_URL);
  await browser.close();

  res.json(results);
});

app.listen(3001, () => console.log('🕵️‍♂️ Scraper running on http://localhost:3001'));
