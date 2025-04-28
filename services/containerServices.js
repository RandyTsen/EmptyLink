// services/containerServices.js
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

/**
 * Checks a container’s portal page for "Gate-In" activity.
 * @param {string} containerNo
 * @returns {Promise<{gateInTime: Date, truckNo: string}|{}>}
 */
export async function checkContainerStatus(containerNo) {
  const url = `https://your‐port‐portal/container‐inquiry?cn=${containerNo}`;
  const res = await fetch(url);
  const html = await res.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Find the row where the Activity column is "Gate-In"
  for (const row of doc.querySelectorAll('table tr')) {
    const cells = row.querySelectorAll('td');
    const activity = cells[2]?.textContent.trim();
    if (activity === 'Gate-In') {
      const dateTime = cells[0]?.textContent.trim();
      const truckNo  = cells[8]?.textContent.trim();
      return {
        gateInTime: new Date(dateTime),
        truckNo,
      };
    }
  }
  // Not yet gate-in
  return {};
}
