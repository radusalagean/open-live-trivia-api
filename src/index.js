import express from 'express'
import * as admin from 'firebase-admin'
import http from 'http'
import bodyParser from 'body-parser'
import config from './config'
import routes from './routes'


// Init firebase admin
admin.initializeApp()

const app = express()

// Middleware
// Parse application/json
app.use(bodyParser.json({
    limit: config.bodyLimit
}));

app.use('/open-live-trivia-api/v1/', routes)
app.listen(config.port, () => 
    console.log(`Server is listening on port ${config.port}`))

export default app