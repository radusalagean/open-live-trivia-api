const express = require('express');
const config = require('../config');
const initializeDb = require("../db");
const user = require('../controller/user');
const reportedEntry = require('../controller/reportedEntry');
const system = require('../controller/system');

let router = express()

// Connect to DB
initializeDb(db => {
  // Api Routes v1 (/v1)
  router.use('/user', user())
  router.use('/reported_entry', reportedEntry())
  router.use('/system', system())
})

module.exports = router