// Socket io defaults
const CONNECTION = 'connection'
const DISCONNECT = 'disconnect'

// Sent by the client
const JOIN = 'JOIN'
const ATTEMPT = 'ATTEMPT'
const REACTION = 'REACTION'
const REPORT_ENTRY = 'REPORT_ENTRY'
const REQUEST_PLAYER_LIST = 'REQUEST_PLAYER_LIST'

// Sent by the server
const WELCOME = 'WELCOME'
const PEER_JOIN = 'PEER_JOIN'
const PEER_ATTEMPT = 'PEER_ATTEMPT'
const COIN_DIFF = 'COIN_DIFF'
const PEER_REACTION = 'PEER_REACTION'
const ROUND = 'ROUND'
const SPLIT = 'SPLIT'
const REVEAL = 'REVEAL'
const ENTRY_REPORTED_OK = 'ENTRY_REPORTED_OK'
const ENTRY_REPORTED_ERROR = 'ENTRY_REPORTED_ERROR'
const PLAYER_LIST = 'PLAYER_LIST'
const PEER_LEFT = 'PEER_LEFT'
// const PEER_TIMEOUT = 'PEER_TIMEOUT'

module.exports = {
    CONNECTION,
    DISCONNECT,

    JOIN, 
    ATTEMPT, 
    REACTION,
    REPORT_ENTRY,
    REQUEST_PLAYER_LIST,

    WELCOME, 
    PEER_JOIN, 
    PEER_ATTEMPT, 
    COIN_DIFF,
    PEER_REACTION, 
    ROUND, 
    SPLIT, 
    REVEAL, 
    ENTRY_REPORTED_OK,
    ENTRY_REPORTED_ERROR,
    PLAYER_LIST,
    PEER_LEFT
    // PEER_TIMEOUT
}