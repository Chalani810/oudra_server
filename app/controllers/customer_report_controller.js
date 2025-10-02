const PDFDocument = require("pdfkit");
const User = require("../models/User");
const Checkout = require("../models/Checkout");

const generateCustomerReport = async (req, res) => {
  try {
    const now = new Date();
    const reportDate = now.toLocaleDateString();
    const reportTime = now.toLocaleTimeString();

    // Fetch ALL customers (not just active ones)
    const customers = await User.find({ role: { $ne: "admin" } })
      .select("-password")
      .sort({ createdAt: -1 });

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Add isActive status to each user
    const usersWithStatus = await Promise.all(
      customers.map(async (user) => {
        const isNewUser = user.createdAt >= threeMonthsAgo;
        let isActive = isNewUser;
        
        if (!isNewUser) {
          const recentCheckout = await Checkout.findOne({
            userId: user._id,
            eventDate: { $gte: threeMonthsAgo },
          });
          isActive = !!recentCheckout;
        }

        return {
          ...user.toObject(),
          isActive,
          isNewUser,
        };
      })
    );

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Customer_Report_${now.getTime()}.pdf`
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
      .text(" | Customer Management Report", { align: "left" });

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
      .text("Customer Summary", 40, doc.y + 10);

    // Create summary table
    const tableTop = doc.y + 25;

    // Table header
    doc
      .fillColor(red)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Metric", 40, tableTop)
      .text("Value", 250, tableTop);

    doc
      .moveTo(40, tableTop + 15)
      .lineTo(555, tableTop + 15)
      .strokeColor(red)
      .stroke();

    // Table rows with alternating background
    const metrics = [
      { name: "Total Customers", value: usersWithStatus.length },
      {
        name: "Active Customers",
        value: usersWithStatus.filter((c) => c.isActive).length,
      },
      {
        name: "Inactive Customers",
        value: usersWithStatus.filter((c) => !c.isActive).length,
      },
    ];

    let currentY = tableTop + 25;
    metrics.forEach((metric, index) => {
      if (index % 2 === 0) {
        doc
          .rect(40, currentY - 10, 515, 20)
          .fill(lightGray)
          .stroke(lightGray);
      }
      doc
        .fillColor("black")
        .font("Helvetica")
        .fontSize(10)
        .text(metric.name, 45, currentY)
        .text(metric.value.toString(), 250, currentY);
      currentY += 20;
    });

    // === Customer Details Section ===
    doc.addPage();
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("red")
      .text("Customer Details", 40, 40);

    // Table Header
    const customersStartY = 80;
    doc
      .font("Helvetica-Bold")
      .fillColor("black")
      .fontSize(10)
      .text("#", 40, customersStartY)
      .text("Customer ID", 70, customersStartY)
      .text("Name", 150, customersStartY)
      .text("Email", 250, customersStartY)
      .text("Points", 380, customersStartY)
      .text("Date Added", 450, customersStartY)
      .text("Status", 500, customersStartY);

    doc
      .moveTo(40, customersStartY + 12)
      .lineTo(555, customersStartY + 12)
      .strokeColor(red)
      .stroke();

    // Table Rows with alternating background colors and gaps
    let customerY = customersStartY + 18;
    const rowHeight = 18;
    const rowGap = 6;

    doc.font("Helvetica").fontSize(9);

    usersWithStatus.forEach((customer, index) => {
      const joinDate = new Date(customer.createdAt).toLocaleDateString();

      // Alternating row background
      if (index % 2 === 0) {
        doc
          .rect(40, customerY - 3, 515, rowHeight + rowGap)
          .fill(lightGray)
          .stroke(lightGray);
      }

      // Content
      doc
        .fillColor("black")
        .fontSize(10)
        .text((index + 1).toString(), 40, customerY)
        .text(customer.userId || "N/A", 70, customerY)
        .text(`${customer.firstName} ${customer.lastName}`, 150, customerY)
        .text(customer.email, 250, customerY)
        .text(customer.loyaltyPoints?.toString() || "0", 400, customerY)
        .text(joinDate, 450, customerY)
        .fillColor(customer.isActive ? "black" : red)
        .text(customer.isActive ? "Active" : "Inactive", 500, customerY);

      // Add horizontal line between rows
      doc
        .moveTo(40, customerY + rowHeight + rowGap / 2)
        .lineTo(555, customerY + rowHeight + rowGap / 2)
        .strokeColor("#e0e0e0")
        .stroke();

      customerY += rowHeight + rowGap;

      // Add new page if we're running out of space
      if (customerY > 700 && index < usersWithStatus.length - 1) {
        doc.addPage();
        customerY = 40;
      }
    });

    // === Footer ===
    const footerY = Math.max(customerY + 60, 750);
    doc
      .fontSize(8)
      .fillColor("gray")
      .text("© 2025 Glimmer Inc. - All rights reserved", 40, footerY, {
        align: "center",
        width: 500,
      });

    doc.end();
  } catch (err) {
    console.error("PDF generation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate customer report" });
    }
  }
};

module.exports = {
  generateCustomerReport,
};