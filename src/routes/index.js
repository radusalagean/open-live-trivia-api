import express from 'express'
import config from '../config'
import middleware from '../middleware'
import initializeDb from "../db"
import user from '../controller/user'

let router = express();

// Connect to DB
initializeDb(db => {
  // Internal MW
  router.use(middleware({config, db}))
  // Api Routes v1 (/v1)
  router.use('/user', user({ config, db }))
});

export default router;