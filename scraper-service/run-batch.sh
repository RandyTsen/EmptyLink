#!/usr/bin/env bash
#
# scraper-service/run-batch.sh
# Wrapper to invoke the batchScrape.js and log output

# 1. Move into the scraper folder
cd "$(dirname "$0")"

# 2. Load environment
#    Assumes you have a .env alongside this script
export $(grep -v '^#' .env | xargs)

# 3. Timestamped log header
echo "=== Batch run at $(date -u +"%Y-%m-%dT%H:%M:%SZ") ===" >> batch.log

# 4. Invoke the Node script
/usr/bin/env node scripts/batchScrape.js >> batch.log 2>&1

# 5. Separator
echo "" >> batch.log
