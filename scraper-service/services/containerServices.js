const moment = require('moment');
const logger = require('../utils/logger');

const scrollToBottom = async (page) => {
    let previousHeight = await page.evaluate(() => document.body.scrollHeight);

    while (true) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000); // Wait for content to load

        let newHeight = await page.evaluate(() => document.body.scrollHeight);
        if (newHeight === previousHeight) break; // Stop if no more content loads
        previousHeight = newHeight;
    }
};

const fetchMultipleContainerInfo = async (page, containerNumbers, message) => {
    const containerResults = [];
    let errorOccurred = false; // Track if an error occurs
    let lastProcessedContainer = "None"; // Track last successfully processed container

    try {
        for (const containerNumber of containerNumbers) {
            lastProcessedContainer = containerNumber; // Update before processing
            logger.info(`🔍 Searching for container: ${containerNumber}`);

            // Fill the input field and search
            await page.fill('#cnid_text', containerNumber);
            await page.press('#cnid_text', 'Enter');

            // Wait for results to load
            try {
                await page.waitForSelector('table tbody tr', { timeout: 5000 });
            } catch (err) {
                containerResults.push(`\n⚠️ *${containerNumber}*: Not a valid container number.\n`);
                continue;
            }

            // Scroll to the bottom to ensure all results are loaded
            await scrollToBottom(page);

            // Scrape only relevant rows, skipping those with class "detail_rows"
            const containerData = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('table tbody tr'));

                return rows.map(row => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    return {
                        dateTime: cells[0]?.innerText.trim(),
                        location: cells[3]?.innerText.trim(),
                        activity: cells[2]?.innerText.trim(),
                        consignee: cells[7]?.innerText.trim(),
                        blNo: cells[4]?.innerText.trim(),
                        vesselTruck: cells[9]?.innerText.trim(),
                        pol: cells[13]?.innerText.trim(),
                        handling: cells[1]?.innerText.trim(),
                    };
                });
            });

            // console.log(containerData);

            // Determine Last Free Port Storage
            let lastKnownDate = null;
            let lastFreePortStorage = "N/A"; // Default if not found
            let lastKnownActivity = null; // Tracks last "Container Stored in Location" before free storage
            let dischargedDate = "N/A"; // Default if not found

            for (const data of containerData) {
                const activityLower = data.activity ? data.activity.toLowerCase() : "";
                const locationMatchesPattern = /^[A-Z][A-Z0-9]{0,2}-\d+-[A-Z]-\d+$/.test(data.location);
                const dataDate = moment(data.dateTime, "DD/MM/YYYY HH:mm", true);

                if (data.location !== "-" && moment(data.dateTime, "DD/MM/YYYY HH:mm", true).isValid()) {
                    lastKnownDate = data.dateTime;
                }

                // console.log(`Updated Last Known Date: ${lastKnownDate}`);

                // Check for Discharged Date
                if ((activityLower === "container stored in location" || activityLower === "container unloaded from vessel") && locationMatchesPattern) {
                    if (!lastKnownDate || dataDate.isSameOrAfter(moment(lastKnownDate, "DD/MM/YYYY HH:mm"))) {
                        lastKnownActivity = data; // Store the latest occurrence found so far
                    }
                }

                if (data.location === "-") {
                    console.log(`Free Port Storage: ${lastKnownActivity ? lastKnownActivity.dateTime : "N/A"}`);
                    if (lastKnownActivity) {
                        lastFreePortStorage = moment(lastKnownActivity.dateTime, "DD/MM/YYYY HH:mm")
                            .add(5, 'days')
                            .format("DD/MM/YYYY");

                        // Assign dischargedDate only at this point
                        dischargedDate = lastKnownActivity.dateTime;
                    }

                    break;
                }
            }

            // Get latest row (first entry)
            const latest = containerData[0];

            if (latest) {
                let activityEmoji = '';
                let lastActivity = '';

                if (latest.handling.toLowerCase() === 'import') {
                    switch (latest.activity.toLowerCase()) {
                        case 'container pre-advised': activityEmoji = '✍'; break;
                        case 'container accepted into terminal': activityEmoji = '📋'; break;
                        case 'container unloaded from vessel': activityEmoji = '⤵'; break;
                        case 'container stored in location': activityEmoji = '📦'; break;
                        case 'container in transit for input': activityEmoji = '↔'; break;
                        case 'pre-advise of container despatch': activityEmoji = '📝'; break;
                        case 'container loaded onto trailer': activityEmoji = '↗'; break;
                        case 'container despatched': activityEmoji = '✅'; break;
                        default: activityEmoji = ''; break;
                    }
                } else if (latest.handling.toLowerCase() === 'export') {
                    switch (latest.activity.toLowerCase()) {
                        case 'container pre-advised': activityEmoji = '✍'; break;
                        case 'container accepted into terminal': activityEmoji = '📋'; break;
                        case 'container unloaded from truck': activityEmoji = '↘'; break;
                        case 'container loaded onto vessel': activityEmoji = '⤴'; break;
                        case 'container modified': activityEmoji = '⏳'; break;
                        case 'container despatched': activityEmoji = '✅'; break;
                        default: activityEmoji = ''; break;
                    }
                }

                const lastActivityDate = moment(latest.dateTime, 'DD/MM/YYYY HH:mm');
                const isOlderThan3Months = lastActivityDate.isBefore(moment().subtract(3, 'months'));

                if (isOlderThan3Months) {
                    containerResults.push(`*${containerNumber}* 🛑 - (${latest.handling})\nThe last activity was more than 3 months ago\n`);
                } else {
                    containerResults.push(`*${containerNumber}* ${activityEmoji} - (${latest.handling})
👤 : ${latest.consignee}
📑 : ${latest.blNo}
📊 : ${latest.activity}
🕒 : ${latest.dateTime}
📍: ${latest.location}
🚛: ${latest.vesselTruck}
Discharged: ${dischargedDate}
Last Port Storage: ${lastFreePortStorage}
`);
                }

            } else {
                containerResults.push(`⚠️ *${containerNumber}*: No data found.`);
            }
        }

        
    } catch (error) {
        logger.error(`Error in Playwright: ${error.message || error}`);
        errorOccurred = true; // Flag that an error happened
    } finally {
        logger.info(`Finish searching at ${new Date().toLocaleString()}`);

        if (errorOccurred) {
            message.reply(`⚠️ An error occurred while fetching data. Processing stopped at *${lastProcessedContainer}*. Returning available results:`);
        };

        return containerResults;
    }
};

module.exports = { fetchMultipleContainerInfo };
