import * as ev from './events'

function postAuth(socket, data) {
    console.log(`postAuth(${socket.id})`)
    socket.on(ev.JOIN, () => {
        console.log(`ON JOIN from ${socket.client.id}`)
        socket.emit(ev.WELCOME, 'game state')
    })
}

function disconnect(socket) {
    console.log(`disconnect(${socket.id})`)
}

module.exports = {
    postAuth,
    disconnect
}