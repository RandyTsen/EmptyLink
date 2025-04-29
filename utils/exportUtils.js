import { utils, write } from "xlsx"
import { jsPDF } from "jspdf"
import "jspdf-autotable"

/**
 * Export data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {string} fileName - Name of the file without extension
 */
export function exportToExcel(data, fileName) {
  // Create a new workbook
  const worksheet = utils.json_to_sheet(data)
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, "Containers")

  // Generate Excel file
  const excelBuffer = write(workbook, { bookType: "xlsx", type: "array" })

  // Create a Blob from the buffer
  const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })

  // Create a download link and trigger the download
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${fileName}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export data to PDF file
 * @param {Array} data - Array of objects to export
 * @param {string} fileName - Name of the file without extension
 * @param {string} shippingOrderId - Shipping order ID for the header
 * @param {string} vessel - Vessel name for the header
 * @param {string} eta - ETA date for the header
 */
export function exportToPdf(data, fileName, shippingOrderId, vessel, eta) {
  // Create a new PDF document
  const doc = new jsPDF()

  // Add title
  doc.setFontSize(18)
  doc.text("Container Tracking Report", 14, 22)

  // Add shipping order details
  doc.setFontSize(12)
  doc.text(`Shipping Order: ${shippingOrderId}`, 14, 32)
  doc.text(`Vessel: ${vessel || "N/A"}`, 14, 38)
  doc.text(`ETA: ${eta ? new Date(eta).toLocaleDateString() : "N/A"}`, 14, 44)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 50)

  // Create table with container data
  const tableColumn = Object.keys(data[0])
  const tableRows = data.map((item) => Object.values(item))

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 60,
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  })

  // Save the PDF
  doc.save(`${fileName}.pdf`)
}
