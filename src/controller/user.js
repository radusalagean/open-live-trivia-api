import Router from 'express'
import * as userModel from '../model/user'
import HttpStatus from 'http-status-codes'
import * as jrh from '../helpers/jsonResponseHelpers'
import * as paginationHelpers from '../helpers/paginationHelpers'
import * as auth from '../middleware/authMiddleware'
import config from '../config'
import { 
    getPlayingUsers,
    handleUserRightsChange,
    disconnectUserById
 } from '../game'
import {
    getPublicUserProjection
} from '../model/user'
import {
    generateImage,
    deleteImage
} from '../middleware/imageMiddleware'

module.exports = () => {
    let api = Router()

    api.post('/login', auth.authorizedRequest, (req, res) => {
        res.json(getPublicUserProjection(res.locals.user))
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
                    // Generate profile image
                    generateImage(user)
                        .catch(err => console.log(`>> ${err.stack}`))
                    console.log(`NEW USER REGISTERED: ${user.username}`)
                    return res.status(HttpStatus.CREATED)
                        .json(getPublicUserProjection(user))
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
            deleteImage(user)
            console.log(`ACCOUNT REMOVED BY USER: ${user.username}`)
            disconnectUserById(user._id.toString())
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
                console.log(`USER RIGHTS CHANGE: ${res.locals.user.username} gave ${user.username} level ${rights} rights`)
                handleUserRightsChange(user._id.toString(), rights)
                res.status(HttpStatus.OK)
                    .json(jrh.message(`${user.username}'s rights changed to type ${rights}`))
            })
        })
    })

    api.get('/leaderboard', auth.authorizedRequest, (req, res) => {
        userModel.User.countDocuments((err, count) => {
            if (err) {
                return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .json(jrh.message(`Error: ${err.message}`))
            }
            let perPage = config.usersPerPage
            let pages = paginationHelpers.getNumOfPages(count, perPage)
            let page = paginationHelpers.getCurrentPage(req, pages)
            let playingUsersMap = getPlayingUsers()
            userModel.User.find({}, 'username rights coins lastSeen joined', (err, users) => {
                if (err) {
                    return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .json(jrh.message(`Error: ${err.message}`))
                }
                users.forEach(user => {
                    user.playing = playingUsersMap.has(user._id.toString())
                })
                res.status(HttpStatus.OK)
                    .json(paginationHelpers.getPaginatedResponse(page, pages, count, perPage, users))
            })
            .skip((page - 1) * perPage)
            .limit(perPage)
            .sort({ coins: -1 })
            .lean()
        })
    })

    api.get('/me', auth.authorizedRequest, (req, res) => {
        res.json(getPublicUserProjection(res.locals.user))
    })

    return api
}