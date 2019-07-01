// Socket io defaults
const CONNECTION = 'connection'
const DISCONNECT = 'disconnect'

// Sent by the client
const JOIN = 'JOIN'
const ATTEMPT = 'ATTEMPT'
const REACTION = 'REACTION'

// Sent by the server
const WELCOME = 'WELCOME'
const PEER_JOIN = 'PEER_JOIN'
const PEER_ATTEMPT = 'PEER_ATTEMPT'
const PEER_REACTION = 'PEER_REACTION'
const ROUND = 'ROUND'
const SPLIT = 'SPLIT'
const REVEAL = 'REVEAL'
const PEER_LEFT = 'PEER_LEFT'
const PEER_TIMEOUT = 'PEER_TIMEOUT'

module.exports = {
    CONNECTION,
    DISCONNECT,

    JOIN, 
    ATTEMPT, 
    REACTION,

    WELCOME, 
    PEER_JOIN, 
    PEER_ATTEMPT, 
    PEER_REACTION, 
    ROUND, 
    SPLIT, 
    REVEAL, 
    PEER_LEFT,
    PEER_TIMEOUT
}