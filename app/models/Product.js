const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  pname: { type: String, required: true }, 
  photoUrl: { type: String, default: '' },        
  stockqut: { type: Number, default: 0 },             
  pprice: { type: Number, required: true },     
  category: { 
    type: String, 
    enum: ['Chair', 'Table', 'Carpet', 'Curtain', 'Buffet Set', 'Tent', 'Table Cloth'],
    required: true 
  }, 
  events: [{ 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }]  
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);