const Router = require('express')
const auth = require('../middleware/authMiddleware')
const jrh = require('../helpers/jsonResponseHelpers')
const packagefile = require('../../package.json')
const HttpStatus = require('http-status-codes')
const {
    disconnectEveryone
} = require('../game')
const {
    isServiceRunning
} = require('../game/jservice')
const config = require('../config')

module.exports = () => {
    let api = Router()

    // Useful for gracefully disconnecting all players before doing maintenance on the prod server
    api.post('/disconnect_everyone', auth.authorizedRequest, auth.adminRights, (req, res) => {
        let count = disconnectEveryone()
        let message = `Sent the disconnect signal to ${count} clients`
        console.log(message)
        res.status(HttpStatus.StatusCodes.OK)
            .json(jrh.message(message))
    })

    api.get('/info', (req, res) => {
        res.status(HttpStatus.StatusCodes.OK)
            .json({
                serverVersion: packagefile.version,
                minAppVersionCode: config.minAppVersionCode,
                latestAppVersionCode: config.latestAppVersionCode,
                isTriviaServiceRunning: isServiceRunning()
            })
    })

    return api
}