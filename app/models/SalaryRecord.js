// models/Salary.js
const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  basicSalary: {
    type: Number,
    required: true
  },
  handledEvents: {
    type: Number,
    default: 0
  },
  eventBonus: {
    type: Number,
    default: 0
  },
  totalSalary: {
    type: Number,
    required: true
  }
}, { timestamps: true });

// Ensure one salary record per employee per month
salarySchema.index({ employeeId: 1, year: 1, month: 1 }, { unique: true });

const Salary = mongoose.model('Salary', salarySchema);

module.exports = Salary;