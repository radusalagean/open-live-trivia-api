import Router from 'express'
import User from '../model/user'
import HttpStatus from 'http-status-codes'

export default ({ config, db }) => {
    let api = Router()

    api.get('/test', (req, res) => {
        res.status(HttpStatus.OK).json({
            message: 'functioneaza'
        })
    })

    return api
}