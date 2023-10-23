const mongoose = require('mongoose');

// define the schema for our balance model
module.exports = mongoose.Schema({
  address: String,
  balance: Number,
  kind: {
    type: String,
    enum: ['DB_USER', 'EOA'],
  },
  status: {
    type: String,
    enum: ['UNSWAPPED', 'IN_PROGRESS', 'SWAPPED'],
    default: 'UNSWAPPED',
  },
});
