const Salary = require('../models/SalaryRecord');
const Employee = require('../models/Employee');
const nodemailer = require("nodemailer");


const createSalary = async (req, res) => {
  try {
    const { employeeId, year, month, basicSalary, handledEvents, eventBonus, totalSalary } = req.body;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ 
        message: 'Employee not found' 
      });
    }

    const existingSalary = await Salary.findOne({ employeeId, year, month });
    if (existingSalary) {
      return res.status(400).json({ 
        message: 'Salary record already exists for this employee and month' 
      });
    }

    const salary = new Salary({
      employeeId,
      year,
      month,
      basicSalary,
      handledEvents,
      eventBonus,
      totalSalary
    });

    const savedSalary = await salary.save();

    // Format month name
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[month - 1];

    // Send payment confirmation email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      to: employee.email,
      from: `Glimmer Payroll <${process.env.EMAIL_FROM}>`,
      subject: `💰 Salary Payment Confirmation - ${monthName} ${year}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <!-- Header with Glimmer branding -->
          <div style="background-color: #d10000; padding: 20px; text-align: center; border-top-left-radius: 5px; border-top-right-radius: 5px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">
              <strong">GLIMMER</strong>
            </h1>
            <p style="color: white; margin: 5px 0 0; font-size: 16px;">Salary Payment Confirmation</p>
          </div>
          
          <!-- Main content -->
          <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-bottom: none;">
            <h2 style="color: #d10000; margin-top: 0;">Hello ${employee.name},</h2>
            
            <p>Your salary for <strong>${monthName} ${year}</strong> has been processed. Here are the details:</p>
            
            <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #d10000; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #000000;">📊 Payment Summary</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; width: 60%;">Basic Salary:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">LKR ${basicSalary.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Event Bonus (${handledEvents} events):</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">LKR ${eventBonus.toFixed(2)}</td>
                </tr>
                <tr style="font-weight: bold;">
                  <td style="padding: 8px 0;">Total Salary:</td>
                  <td style="padding: 8px 0; text-align: right;">LKR ${totalSalary.toFixed(2)}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fff8f8; border: 1px solid #ffdddd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #d10000;">ℹ️ Important Information</h3>
              <p>• Payment will be deposited to your registered bank account within 2-3 working days</p>
              <p>• Your payslip is available in your employee portal</p>
              <p>• Contact HR if you have any questions about your payment</p>
            </div>
            
            <p style="text-align: center; margin-top: 25px;">
              <a href="#" style="background-color: #d10000; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Payslip
              </a>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #000000; color: white; padding: 15px; text-align: center; border-bottom-left-radius: 5px; border-bottom-right-radius: 5px; font-size: 14px;">
            <p style="margin: 0;">© 2025 Glimmer Events. All rights reserved.</p>
            <p style="margin: 5px 0 0; color: #d10000;">
              Thank you for your hard work!
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    res.status(201).json({ 
      message: 'Salary created and payment notification sent successfully', 
      data: savedSalary 
    });
  } catch (err) {
    console.error('Error in createSalary:', err);
    res.status(500).json({ 
      error: err.message,
      message: 'Error creating salary record' 
    });
  }
};

const getAllSalaries = async (req, res) => {
  try {
    const salaries = await Salary.find()
      .populate('employeeId', 'name empId occupation')
      .sort({ year: -1, month: -1 });

    res.status(200).json({ 
      data: salaries 
    });
  } catch (err) {
    console.error('Error in getAllSalaries:', err);
    res.status(500).json({ 
      error: err.message 
    });
  }
};
module.exports = {
  createSalary,
  getAllSalaries,
}; 