const mongoose = require('mongoose');

// define the schema for our user model
const userSchema = mongoose.Schema({
  profileAddress: String,
});
module.exports = userSchema;
