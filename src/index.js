import express from 'express'
import * as admin from 'firebase-admin'
import http from 'http'
import bodyParser from 'body-parser'
import io from 'socket.io'
import socketAuth from 'socketio-auth'
import config from './config'
import routes from './routes'
import * as game from './game'
import * as auth from './middleware/authMiddleware'


// Init Firebase Admin
admin.initializeApp()

const app = express()

// Parse application/json
app.use(bodyParser.json({
    limit: config.bodyLimit
}));

// Routes
app.use('/open-live-trivia-api/v1/', routes)

// HTTP Server
const server = http.createServer(app)

// Socket.io
const serverSocket = io(server)

server.listen(config.port, () => {
    console.log(`Server is listening on port ${config.port}`)
    // Socket init
    socketAuth(serverSocket, auth.socketAuthConfig(auth.authorizedSocket, 
        game.postAuth, game.disconnect, config.socketAuthTimeout))
})

