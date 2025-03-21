const mongoose = require('mongoose');
const config = require('../config');

module.exports = callback => {
  let db = mongoose.connect(config.mongoUrl, { useNewUrlParser: true })
  callback(db)
}