import Router from 'express'
import * as userModel from '../model/user'
import HttpStatus from 'http-status-codes'
import * as jrh from '../helpers/jsonResponseHelpers'
import * as auth from '../middleware/authMiddleware'

module.exports = () => {
    let api = Router()

    api.post('/login', auth.authorized, (req, res) => {
        res.json(res.locals.user)
    })

    api.post('/register', (req, res) => {
        if (!auth.assertAuthorizedHeader(req, res)) {
            return
        }
        let idToken = req.headers.authorization
        let username = req.body.username
        if (!username) {
            return res.status(HttpStatus.BAD_REQUEST)
                .json(jrh.message('Please include a username in the request body'))
        }
        // check if username is available for registration
        auth.checkUsernameConflict(username, err => {
            // error
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json(jrh.message(`Error: ${err}`))
        }, () => {
            // conflict
            return res.status(HttpStatus.CONFLICT)
                .json(jrh.message('The username is not available for registration'))
        }, () => {
            // non-conflict
            // Verify idToken with Firebase Admin
            auth.verifyIdTokenWithFirebase(idToken, err => {
                // onError
                return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .json(jrh.message(`Error: (${err})`))
            }, (user, paylod) => {
                // onUidFound
                return res.status(HttpStatus.CONFLICT)
                    .json(jrh.message('An in-app account is already registered for this Google account'))
            }, payload => {
                // onUidNotFound
                // Create the new account entry in the database
                let user = new userModel.User()
                user.firebaseUid = payload.uid
                user.username = username
                user.idToken = idToken
                user.idTokenExp = new Date(payload.exp * 1000)
                user.save((err, user) => {
                    if (err) {
                        return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .json(jrh.message(`Error: ${err}`))
                    }
                    return res.status(HttpStatus.CREATED)
                        .json(user)
                })
            })
        })
    })

    api.delete('/delete', auth.authorized, (req, res) => {
        let user = res.locals.user
        if (user.rights === userModel.TYPE_ADMIN) {
            return res.status(HttpStatus.UNAUTHORIZED)
                .json(jrh.message('Admins are not allowed to remove their account'))
        }
        userModel.User.deleteOne({
            firebaseUid: user.firebaseUid
        }, err => {
            if (err) {
                return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .json(jrh.message(`Error: ${err.message}`))
            }
            return res.status(HttpStatus.OK)
                .json(jrh.message('Account removed successfully'))
        })
    })

    api.get('/availability/:username', (req, res) => {
        let username = req.params.username
        if (!username) {
            return res.status(HttpStatus.BAD_REQUEST)
                .json(jrh.message('Please include a username in the request URL'))
        }
        auth.checkUsernameConflict(username, err => {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json(jrh.message(`Error: ${err}`));
        }, () => {
            res.status(HttpStatus.CONFLICT).send()
        }, () => {
            res.status(HttpStatus.OK).send()
        })
    });

    return api
}