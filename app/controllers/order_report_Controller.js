const PDFDocument = require("pdfkit");
const Checkout = require("../models/Checkout");

const generateOrderReport = async (req, res) => {
  try {
    const now = new Date();
    const reportDate = now.toLocaleDateString();
    const reportTime = now.toLocaleTimeString();

    // Get first and last day of current month
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Fetch completed checkouts for the current month
    const checkouts = await Checkout.find({
      createdAt: { $gte: firstDay, $lte: lastDay },
      status: "Completed"
    });

    // Calculate total metrics
    const totalRevenue = checkouts.reduce((sum, c) => sum + c.cartTotal, 0);
    const totalAdvance = checkouts.reduce((sum, c) => sum + c.advancePayment, 0);
    const totalDue = checkouts.reduce((sum, c) => sum + c.duepayment, 0);

    // Get top checkouts by value
    const topCheckouts = [...checkouts]
      .sort((a, b) => b.cartTotal - a.cartTotal)
      .slice(0, 10);

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Order_Report_${now.getFullYear()}_${now.getMonth() + 1}.pdf`
    );

    doc.pipe(res);

    // === Colors ===
    const red = "#cc0000";
    const blue = "#0066cc";
    const lightGray = "#f5f5f5";

    // === Header ===
    doc
      .fillColor(red)
      .font("Helvetica-Bold")
      .fontSize(24)
      .text("Glim", { continued: true })
      .fillColor("black")
      .text("mer", { continued: true })
      .font("Helvetica")
      .fontSize(18)
      .text(" | Monthly Revenue Report", { align: "left" });

    doc
      .moveDown()
      .fontSize(9)
      .fillColor("gray")
      .text(`Generated on ${reportDate} at ${reportTime}`, { align: "left" });

    doc
      .moveDown()
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .strokeColor(red)
      .stroke();

    // === Summary Section ===
    doc
      .font("Helvetica-Bold")
      .fillColor("black")
      .fontSize(12)
      .text("Monthly Summary", 40, doc.y + 10);

    // Highlight "Total Orders" in blue
    doc
  .fillColor(blue)
  .font("Helvetica-Bold")
  .fontSize(10)
  .text(`Total Orders: ${checkouts.length}`, 40, doc.y + 25);

    // Create financial summary table
    const tableTop = doc.y + 40;
    
    // Table header
    doc
      .fillColor(red)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Metric", 40, tableTop)
      .text("Amount (Rs.)", 250, tableTop);

    doc
      .moveTo(40, tableTop + 15)
      .lineTo(555, tableTop + 15)
      .strokeColor(red)
      .stroke();

    // Table rows with alternating background
    const metrics = [
      { name: "Total Revenue", value: totalRevenue.toFixed(2) },
      { name: "Total Advance Payments", value: totalAdvance.toFixed(2) },
      { name: "Total Due Payments", value: totalDue.toFixed(2) }
    ];

    let currentY = tableTop + 25;
    
    metrics.forEach((metric, index) => {
      // Alternate row colors
      if (index % 2 === 0) {
        doc.rect(40, currentY - 10, 515, 20).fill(lightGray).stroke(lightGray);
      }
      
      doc
        .fillColor("black")
        .font("Helvetica")
        .fontSize(10)
        .text(metric.name, 45, currentY)
        .text(`Rs.${metric.value}`, 250, currentY);

      currentY += 20;
    });

    // === Top Orders Section ===
    doc.addPage();
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("red")
      .text("Highest Value Orders", 40, 40);

    // Table Header
    const ordersStartY = 80;
    doc
      .font("Helvetica-Bold")
      .fillColor("black")
      .fontSize(10)
      .text("#", 40, ordersStartY)
      .text("Order ID", 70, ordersStartY)
      .text("Date", 150, ordersStartY)
      .text("Customer", 250, ordersStartY)
      .text("Event Date", 350, ordersStartY)
      .text("Amount (Rs.)", 450, ordersStartY);

    doc
      .moveTo(40, ordersStartY + 12)
      .lineTo(555, ordersStartY + 12)
      .strokeColor(red)
      .stroke();

    // Table Rows
    // Table Rows with alternating background colors
// Table Rows with alternating background colors and gaps
let orderY = ordersStartY + 18;
const rowHeight = 18; // Height of each content row
const rowGap = 6;     // Gap between rows
doc.font("Helvetica").fontSize(9);

topCheckouts.forEach((checkout, index) => {
  const orderDate = new Date(checkout.createdAt).toLocaleDateString();
  const eventDate = new Date(checkout.eventDate).toLocaleDateString();
  const customerName = `${checkout.firstName} ${checkout.lastName}`;
  
  // Add alternating row background (extended to include gap)
  if (index % 2 === 0) {
    doc.rect(40, orderY - 3, 515, rowHeight + rowGap)
       .fill(lightGray)
       .stroke(lightGray);
  }
  
  // Add content
  doc
    .fillColor("black")
    .fontSize(10)
    .text((index + 1).toString(), 40, orderY)
    .text(checkout.orderId, 70, orderY)
    .text(orderDate, 150, orderY)
    .text(customerName, 250, orderY)
    .text(eventDate, 350, orderY)
    .text(`Rs.${checkout.cartTotal.toFixed(2)}`, 450, orderY);

  // Add horizontal line between rows (optional)
  doc.moveTo(40, orderY + rowHeight + rowGap/2)
     .lineTo(555, orderY + rowHeight + rowGap/2)
     .strokeColor("#e0e0e0")
     .stroke();

  orderY += rowHeight + rowGap; // Move to next row position
});

    // === Footer ===
const footerY = Math.max(orderY + 60, 750);
    doc.fontSize(8)
       .fillColor("gray")
       .text("© 2025 Glimmer Inc. - All rights reserved", 
         40, footerY, { 
           align: "center",
           width: 500
         });

    doc.end();
  } catch (err) {
    console.error("PDF generation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate order report" });
    }
  }
};


module.exports = {
  generateOrderReport,
  
};