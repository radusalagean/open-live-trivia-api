import express from 'express'
import config from '../config'
import initializeDb from "../db"
import user from '../controller/user'
import reportedEntry from '../controller/reportedEntry'
import system from '../controller/system'

let router = express()

// Connect to DB
initializeDb(db => {
  // Api Routes v1 (/v1)
  router.use('/user', user())
  router.use('/reported_entry', reportedEntry())
  router.use('/system', system())
})

export default router