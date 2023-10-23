const mongoose = require('mongoose');

// define the schema for our balance model
module.exports = mongoose.Schema({
  addr: String,
  balance: Number,
});
