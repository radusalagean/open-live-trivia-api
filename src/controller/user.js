const Router = require('express')
const userModel = require('../model/user')
const HttpStatus = require('http-status-codes')
const jrh = require('../helpers/jsonResponseHelpers')
const paginationHelpers = require('../helpers/paginationHelpers')
const auth = require('../middleware/authMiddleware')
const config = require('../config')
const {
    getPlayingUsers,
    handleUserRightsChange,
    disconnectUserById
} = require('../game')
const {
    getPublicUserProjection
} = require('../model/user')
const {
    generateImage,
    deleteImage
} = require('../middleware/imageMiddleware')

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
            return res.status(HttpStatus.StatusCodes.BAD_REQUEST)
                .json(jrh.message('Please include a username in the request body'))
        }
        // check if username is available for registration
        auth.checkUsernameConflict(username, err => {
            // error
            return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR)
                .json(jrh.message(`Error: ${err.message}`))
        }, () => {
            // conflict
            return res.status(HttpStatus.StatusCodes.CONFLICT)
                .json(jrh.message('The username is not available for registration'))
        }, () => {
            // non-conflict
            // Verify idToken with Firebase Admin
            auth.verifyIdTokenWithFirebase(idToken, err => {
                // onError
                return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR)
                    .json(jrh.message(`Error: (${err.message})`))
            }, (user, paylod) => {
                // onUidFound
                return res.status(HttpStatus.StatusCodes.CONFLICT)
                    .json(jrh.message('An in-app account is already registered for this Google account'))
            }, payload => {
                // onUidNotFound
                // Create the new account entry in the database
                let user = new userModel.User()
                user.firebaseUid = payload.uid
                user.username = username
                user.idToken = idToken
                user.idTokenExp = new Date(payload.exp * 1000)

                user.save().then(user => {
                    // Generate profile image
                    generateImage(user)
                        .catch(err => console.log(`>> ${err.message}`))
                    console.log(`NEW USER REGISTERED: ${user.username}`)
                    return res.status(HttpStatus.StatusCodes.CREATED)
                        .json(getPublicUserProjection(user))
                }).catch(err => {
                    return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR)
                        .json(jrh.message(`Error: ${err.message}`))
                })
            })
        })
    })

    api.delete('/delete', auth.authorizedRequest, (req, res) => {
        let user = res.locals.user
        if (user.rights === userModel.TYPE_ADMIN) {
            return res.status(HttpStatus.StatusCodes.FORBIDDEN)
                .json(jrh.message('Admins are not allowed to remove their account'))
        }
        userModel.User.deleteOne({
            firebaseUid: user.firebaseUid
        }).then(() => {
            deleteImage(user)
            console.log(`ACCOUNT REMOVED BY USER: ${user.username}`)
            disconnectUserById(user._id.toString())
            return res.status(HttpStatus.StatusCodes.OK)
                .json(jrh.message('Account removed successfully'))
        }).catch(err => {
            return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR)
                    .json(jrh.message(`Error: ${err.message}`))
        })
    })

    api.get('/availability/:username', (req, res) => {
        let username = req.params.username
        if (!username) {
            return res.status(HttpStatus.StatusCodes.BAD_REQUEST)
                .json(jrh.message('Please include a username in the request URL'))
        }
        auth.checkUsernameConflict(username, err => {
            res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR)
                .json(jrh.message(`Error: ${err.message}`))
        }, () => {
            res.status(HttpStatus.StatusCodes.CONFLICT).send()
        }, () => {
            res.status(HttpStatus.StatusCodes.OK).send()
        })
    })

    api.put('/rights/:user_id/:rights', auth.authorizedRequest, auth.adminRights, (req, res) => {
        let userId = req.params.user_id
        let rights = req.params.rights
        if (!userId) {
            return res.status(HttpStatus.StatusCodes.BAD_REQUEST)
                .json(jrh.message('Please provide the user id in the request URL for the account you want to modify'))
        }
        if (!rights) {
            return res.status(HttpStatus.StatusCodes.BAD_REQUEST)
                .json(jrh.message('Please provide the rights in the request URL for the specified account'))
        }
        if (rights < userModel.TYPE_REGULAR || rights > userModel.TYPE_ADMIN) {
            return res.status(HttpStatus.StatusCodes.BAD_REQUEST)
                .json(jrh.message('You specified unknown rights type'))
        }
        userModel.User.findById(userId).then(user => {
            if (!user) {
                return res.status(HttpStatus.StatusCodes.NOT_FOUND)
                    .json(jrh.message('No user found for the passed user id'))
            }
            if (user.rights == rights) {
                return res.status(HttpStatus.StatusCodes.BAD_REQUEST)
                    .json(jrh.message(`The user already has the specified rights (type ${rights})`))
            }
            user.rights = rights
            user.save().then(user => {
                console.log(`USER RIGHTS CHANGE: ${res.locals.user.username} gave ${user.username} level ${rights} rights`)
                handleUserRightsChange(user._id.toString(), rights)
                res.status(HttpStatus.StatusCodes.OK)
                    .json(jrh.message(`${user.username}'s rights changed to type ${rights}`))
            }).catch(err => {
                return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR)
                        .json(jrh.message(`Error ${err.message}`))
            })
        }).catch(err => {
            return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR)
                .json(jrh.message(`Error: ${err.message}`))
        })
    })

    api.get('/leaderboard', auth.authorizedRequest, (req, res) => {
        userModel.User.countDocuments().then(count => {
            let perPage = config.usersPerPage
            let pages = paginationHelpers.getNumOfPages(count, perPage)
            let page = paginationHelpers.getCurrentPage(req, pages)
            let playingUsersMap = getPlayingUsers()
            userModel.User.find({}, 'username rights coins lastSeen joined')
                .skip((page - 1) * perPage)
                .limit(perPage)
                .sort({ coins: -1 })
                .lean()
                .then(users => {
                    users.forEach(user => {
                        user.playing = playingUsersMap.has(user._id.toString())
                    })
                    res.status(HttpStatus.StatusCodes.OK)
                        .json(paginationHelpers.getPaginatedResponse(page, pages, count, perPage, users))
                }).catch(err => {
                    return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR)
                        .json(jrh.message(`Error: ${err.message}`))
                })
                    
        }).catch(err => {
            return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR)
                .json(jrh.message(`Error: ${err.message}`))
        })
    })

    api.get('/me', auth.authorizedRequest, (req, res) => {
        res.json(getPublicUserProjection(res.locals.user))
    })

    return api
}