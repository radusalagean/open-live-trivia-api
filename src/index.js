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




// Auth part

// var start = Date.now()
// var end
// admin.auth().verifyIdToken('token')
//   .then(payload => {
//       end = Date.now()
//       console.log('uid %s', payload.uid)
//       console.log('aud: %s', payload.aud)
//       console.log('authTime: %s', payload.auth_time)
//       console.log('issue time: %s', payload.iat)
//       console.log('exp: %s', payload.exp)
//       console.log('Elapsed time: %s', end - start)
//   }).catch(err => {
//       end = Date.now()
//       if (err.code == 'auth/id-token-revoked') {
//         // Token has been revoked. Inform the user to reauthenticate or signOut() the user.
//         console.log('Token has been revoked. Inform the user to reauthenticate or signOut() the user')
//       } else {
//         // Token is invalid.
//         console.log('Invalid token: %s', err.code)
//       }
//       //console.log('Error: %s', err)
//       console.log('Elapsed time: %s', end - start)
//   })