const PDFDocument = require('pdfkit');
const Employee = require('../models/Employee');
const Salary = require('../models/SalaryRecord');

const generateEmployeeReport = async (req, res) => {
    if (res.headersSent) {
        console.error('Headers already sent, cannot generate PDF');
        return;
    }

    let doc;
    try {
        const now = new Date();
        const reportDate = now.toLocaleDateString();
        const reportTime = now.toLocaleTimeString();

        // Fetch data with error handling
        const [employees, salaries] = await Promise.all([
            Employee.find().populate('occupation').exec(),
            Salary.find({
                year: now.getFullYear(),
                month: now.getMonth() + 1
            }).populate('employeeId').exec()
        ]).catch(err => {
            console.error('Database error:', err);
            throw new Error('Failed to fetch report data');
        });

        // Calculate total paid salary
        const totalPaidSalary = salaries
            .reduce((sum, salary) => sum + (salary.totalSalary || 0), 0);

        // Set PDF headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Employee_Report_${now.getFullYear()}_${now.getMonth() + 1}.pdf`
        );

        // Create PDF document
        doc = new PDFDocument({ margin: 40, size: 'A4' });
        
        doc.on('error', (err) => {
            console.error('PDF generation error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to generate PDF' });
            }
        });

        doc.pipe(res);

        // === Document Content ===
        // Header
        doc.fillColor('#cc0000')
           .font('Helvetica-Bold')
           .fontSize(24)
           .text('Glim', { continued: true })
           .fillColor('black')
           .text('mer', { continued: true })
           .font('Helvetica')
           .fontSize(18)
           .text(' | Monthly Employee Report', { align: 'left' });

        doc.moveDown()
           .fontSize(9)
           .fillColor('gray')
           .text(`Generated on ${reportDate} at ${reportTime}`, { align: 'left' });

        doc.moveDown()
           .moveTo(40, doc.y)
           .lineTo(555, doc.y)
           .strokeColor('#cc0000')
           .stroke();

        // Table Header
        const startY = doc.y + 10;
        doc.font('Helvetica-Bold')
           .fillColor('black')
           .fontSize(9)
           .text('ID', 40, startY)
           .text('Name', 120, startY)
           .text('Position', 250, startY)
           .text('Status', 370, startY)
           .text('Salary', 480, startY, { align: 'right' });

        doc.moveTo(40, startY + 12)
           .lineTo(555, startY + 12)
           .strokeColor('#cc0000')
           .stroke();

        // Table Rows
        let currentY = startY + 18;
        doc.font('Helvetica').fontSize(8);

        employees.forEach((employee) => {
            const salary = salaries.find(s => 
                s.employeeId?._id.toString() === employee._id.toString()
            );
            
            // Default to "Paid" if salary record exists (based on your controller)
            const status = salary ? 'Paid' : 'Pending';
            const statusColor = status === 'Paid' ? '#009900' : '#cc0000';
            const amount = salary ? 
                `Rs. ${(salary.totalSalary || 0).toFixed(2)}` : 'Not Available';

            doc.fillColor('black')
               .text(employee.empId, 40, currentY)
               .text(employee.name, 120, currentY)
               .text(employee.occupation?.title || 'N/A', 250, currentY)
               .fillColor(statusColor)
               .text(status, 370, currentY)
               .fillColor('black')
               .text(amount, 480, currentY, { align: 'right' });

            currentY += 14;
        });

        // Summary
        doc.moveDown()
           .moveTo(40, currentY + 5)
           .lineTo(555, currentY + 5)
           .strokeColor('#cc0000')
           .stroke();

        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fillColor('black')
           .text(`Total Employees: ${employees.length}`, 40, currentY + 10, { continued: true })
           .text(`   |   Total Paid Salary: Rs. ${totalPaidSalary.toFixed(2)}`, { continued: false });

        // Footer
        doc.fontSize(7)
           .fillColor('gray')
           .text('© 2025 Glimmer Inc. — All rights reserved', 40, 750, {
               align: 'center',
               width: 520
           });

        doc.end();

    } catch (err) {
        console.error('Report generation error:', err);
        if (doc) doc.end();
        
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Failed to generate report',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
};

module.exports = {
    generateEmployeeReport
};