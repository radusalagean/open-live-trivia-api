const express = require('express');
const admin = require('firebase-admin');
const http = require('http');
const bodyParser = require('body-parser');
const io = require('socket.io');
const socketAuth = require('socketio-auth');
const config = require('./config');
const routes = require('./routes');
const game = require('./game');
const auth = require('./middleware/authMiddleware');


// Init Firebase Admin
admin.initializeApp()

const app = express()

// Parse application/json
app.use(bodyParser.json({
    limit: config.bodyLimit
}))

// Routes
app.use('/open-live-trivia-api/v1/', routes)

// Public folder
if (process.env.NODE_ENV == "development") { // In production, Nginx will server the public folder
    app.use('/open-live-trivia-api-static', express.static('public'))
}

// HTTP Server
const server = http.createServer(app)

// Socket.io
const serverSocket = io(server, {
    path: '/open-live-trivia-api/socket.io'
})

server.listen(config.port, () => {
    console.log(`Server is listening on port ${config.port}`)
    // Socket init
    socketAuth(serverSocket, auth.socketAuthConfig(auth.authorizedSocket, 
        game.postAuth, game.disconnect, config.socketAuthTimeout))
    // Start game
    game.start(serverSocket)
})