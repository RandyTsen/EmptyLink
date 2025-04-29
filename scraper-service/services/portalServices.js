// services/portalService.js
const { chromium } = require('playwright');
const logger = require('../utils/logger'); // Adjust the path as necessary

let page;

const portalLogin = async (EMAIL, PASSWORD, LOGIN_URL) => {
    logger.info("🔄 Logging in...");
    await page.goto(LOGIN_URL);
    await page.fill('input[name="LoginForm[username]"]', EMAIL);
    await page.fill('input[name="LoginForm[password]"]', PASSWORD);
    logger.info("Done filling in email and password.");
    await page.click('button[type="submit"]');
    await page.waitForURL('https://sbcp.dpwsabah.com/site/index.html', { timeout: 10000 });
    logger.info("✅ Login successful.");
};

const portalLogout = async (LOGOUT_URL) => {
    logger.info("🔄 Logging out...");
    await page.goto(LOGOUT_URL);
    logger.info("✅ Logged out.");
};

const setPage = (newPage) => {
    page = newPage;
};

const getPage = () => {
    return page; // Return the current page object
};

module.exports = { portalLogin, portalLogout, setPage, getPage };