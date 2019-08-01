import Router from 'express'
import * as auth from '../middleware/authMiddleware'
import * as jrh from '../helpers/jsonResponseHelpers'
import packagefile from '../../package.json'
import HttpStatus from 'http-status-codes'
import { 
    disconnectEveryone
 } from '../game'
 import {
    isServiceRunning
 } from '../game/jservice'
import config from '../config'

module.exports = () => {
    let api = Router()

    // Useful for gracefully disconnecting all players before doing maintenance on the prod server
    api.post('/disconnect_everyone', auth.authorizedRequest, auth.adminRights, (req, res) => {
        let count = disconnectEveryone()
        let message = `Sent the disconnect signal to ${count} clients`
        console.log(message)
        res.status(HttpStatus.OK)
            .json(jrh.message(message))
    })

    api.get('/info', (req, res) => {
        res.status(HttpStatus.OK)
            .json({
                serverVersion: packagefile.version,
                minAppVersionCode: config.minAppVersionCode,
                latestAppVersionCode: config.latestAppVersionCode,
                isTriviaServiceRunning: isServiceRunning()
            })
    })

    return api
}