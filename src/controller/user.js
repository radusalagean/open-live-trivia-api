import Router from 'express'
import * as userModel from '../model/user'
import HttpStatus from 'http-status-codes'
import * as jrh from '../helpers/jsonResponseHelpers'
import * as auth from '../middleware/authMiddleware'

module.exports = () => {
    let api = Router()

    api.get('/login', auth.authorizedRequest, (req, res) => {
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

    api.delete('/delete', auth.authorizedRequest, (req, res) => {
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
                .json(jrh.message(`Error: ${err}`))
        }, () => {
            res.status(HttpStatus.CONFLICT).send()
        }, () => {
            res.status(HttpStatus.OK).send()
        })
    })

    api.put('/rights/:user_id/:rights', auth.authorizedRequest, auth.adminRights, (req, res) => {
        let userId = req.params.user_id
        let rights = req.params.rights
        if (!userId) {
            return res.status(HttpStatus.BAD_REQUEST)
                .json(jrh.message('Please provide the user id in the request URL for the account you want to modify'))
        }
        if (!rights) {
            return res.status(HttpStatus.BAD_REQUEST)
                .json(jrh.message('Please provide the rights in the request URL for the specified account'))
        }
        if (rights < userModel.TYPE_REGULAR || rights > userModel.TYPE_ADMIN) {
            return res.status(HttpStatus.BAD_REQUEST)
                .json(jrh.message('You specified unknown rights type'))
        }
        userModel.User.findById(userId, (err, user) => {
            if (err) {
                return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .json(jrh.message(`Error: ${err.message}`))
            }
            if (!user) {
                return res.status(HttpStatus.NOT_FOUND)
                    .json(jrh.message('No user found for the passed user id'))
            }
            if (user.rights == rights) {
                return res.status(HttpStatus.BAD_REQUEST)
                    .json(jrh.message(`The user already has the specified rights (type ${rights})`))
            }
            user.rights = rights
            user.save(err => {
                if (err) {
                    return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .json(jrh.message(`Error ${err.message}`))
                }
                res.status(HttpStatus.OK)
                    .json(jrh.message(`${user.username}'s rights changed to type ${rights}`))
            })
        })
    })

    return api
}