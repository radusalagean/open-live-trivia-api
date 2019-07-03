import HttpStatus from 'http-status-codes'
import * as userModel from '../model/user'
import * as admin from 'firebase-admin'
import * as jrh from '../helpers/jsonResponseHelpers'

/**
 * Ensure received request is authorized properly
 */
const authorizedRequest = (req, res, next) => {
    // check if authorization header is present in the request
    // console.log('Received authorized request')
    let idToken = req.headers.authorization
    if (!assertAuthorizedHeader(req, res)) {
        return
    }
    checkAuthorizationLocally(idToken, err => {
        // onError
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json(jrh.message(`Error: ${err.message}`))
    }, () => {
        // onIdTokenUnknown
        checkRequestAuthorizationWithFirebase(idToken, res, next)
    }, () => {
        // onIdTokenExpired
        checkRequestAuthorizationWithFirebase(idToken, res, next)
    }, user => {
        // onIdTokenValid
        res.locals.user = user
        next()
    })
}

/**
 * Ensure connected socket is authorized properly
 */
const authorizedSocket = (socket, data, cb) => {
    let idToken = data.idToken
    if (!idToken) {
        cb(new Error('No idToken passed'), false)
        return socket.disconnect()
    }
    checkAuthorizationLocally(idToken, err => {
        // onError
        cb(new Error(err.message), false)
        socket.disconnect()
    }, () => {
        // onIdTokenUnknown
        checkSocketAuthorizationWithFirebase(idToken, socket, cb)
    }, () => {
        // onIdTokenExpired
        checkSocketAuthorizationWithFirebase(idToken, socket, cb)
    }, user => {
        // onIdTokenValid
        socket.client.user = user
        cb(null, true)
    })
}

/**
 * Init config for socketio-auth
 */
function socketAuthConfig(authenticate, postAuthenticate, disconnect, timeout) {
    return {
        authenticate: authenticate,
        postAuthenticate: postAuthenticate,
        disconnect: disconnect,
        timeout: timeout
    }
}

/**
 * Check if the passed idToken is already saved in the database
 */
function checkAuthorizationLocally(idToken, onError, onIdTokenUnknown, onIdTokenExpired, onIdTokenValid) {
    // console.log('Checking if the idToken is present in the database and is not expired')
    userModel.User.findOne({
        idToken: idToken
    }, (err, user) => {
        if (err) {
            console.log(`Error: ${err.message}`)
            onError(err)
        }
        if (!user) {
            // console.log('Passed idToken not found in the db')
            onIdTokenUnknown()
        } else {
            if (user.idTokenExp < Date.now()) {
                // console.log('Passed idToken was found in the database but it\'s expired')
                onIdTokenExpired()
            } else {
                // console.log('Passed idToken is valid')
                onIdTokenValid(user)
            }
        }
    })
}

/**
 * Ensure received request is authorized properly as MODERATOR
 */
const moderatorRights = (req, res, next) => {
    let user = res.locals.user
    if (assertRights(user, userModel.TYPE_MODERATOR, res)) {
        next()
    }
}

/**
 * Ensure received request is authorized properly as ADMIN
 */
const adminRights = (req, res, next) => {
    let user = res.locals.user
    if (assertRights(user, userModel.TYPE_ADMIN, res)) {
        next()
    }
}

function assertRights(user, rights, res) {
    if (user.rights < rights) {
        res.status(HttpStatus.UNAUTHORIZED)
            .json(jrh.message(`You require at least rights type ${rights} for this operation`))
    }
    return user.rights >= rights
}

function assertAuthorizedHeader(req, res) {
    let idToken = req.headers.authorization
    if (!idToken) {
        res.status(HttpStatus.UNAUTHORIZED)
            .json(jrh.message('Authorized header unavailable'))
    }
    return idToken
}

function checkRequestAuthorizationWithFirebase(idToken, res, next) {
    verifyIdTokenWithFirebase(idToken, err => {
        // onError
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .json(jrh.message(`Error: (${err})`))
    }, (user, payload) => {
        // onUidFound
        updateIdToken(idToken, user, payload, err => {
            // onError
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json(jrh.message(`Error: ${err.message}`))
        }, () => {
            // onComplete
            // Keep a ref to user in order to access later
            res.locals.user = user
            next()
        })
    }, payload => {
        // onUidNotFound
        return res.status(HttpStatus.NOT_FOUND)
            .json(jrh.message('No in app-account was found for your Google account (you need to register)'))
    })
}

function checkSocketAuthorizationWithFirebase(idToken, socket, cb) {
    verifyIdTokenWithFirebase(idToken, err => {
        // onError
        cb(new Error(err), false)
        socket.disconnect()
    }, (user, payload) => {
        // onUidFound
        updateIdToken(idToken, user, payload, err => {
            // onError
            cb(new Error(err.message), false)
            socket.disconnect()
        }, () => {
            // onComplete
            socket.client.user = user
            cb(null, true)
        })
    }, payload => {
        // onUidNotFound
        cb(new Error('User id not found for the specified token, you need to register first'), false)
        socket.disconnect()
    })
}

/**
 * Update the user's idToken database entry with a new one
 */
function updateIdToken(idToken, user, firebasePayload, onError, onComplete) {
    // Update idToken and idTokenExp
    // console.log(`Updating idToken(${idToken}) and idTokenExp(${firebasePayload.exp}) for uid ${firebasePayload.uid}`)
    user.idToken = idToken
    user.idTokenExp = new Date(firebasePayload.exp * 1000)
    user.save(err => {
        if (err) {
            console.log(`Error: ${err.message}`)
            onError(err)
        }
        // console.log('Authorization check passed')
        onComplete()
    })
}

/**
 * Check if the passed username is in conflict with another registered username
 * (the operation is case-insensitive)
 */
function checkUsernameConflict(username, onError, onConflict, onNonConflict) {
    userModel.User.findOne({
        username: {
            $regex : new RegExp('^' + username + '$', 'i')
        }
    }, (err, user) => {
        if (err) {
            return onError(err)
        }
        return user ? onConflict() : onNonConflict()
    })
}

/**
 * Use Firebase Admin to check the passed idToken's validity
 */
function verifyIdTokenWithFirebase(idToken, onError, onUidFound, onUidNotFound) {
    // Check idToken w/ Firebase Admin
    // console.log('Checking idToken with Firebase Admin')
    admin.auth().verifyIdToken(idToken)
        .then(payload => {
            // console.log('Firebase Auth Response')
            // Check if uid is in the database
            userModel.User.findOne({
                firebaseUid: payload.uid
            }, (err, user) => {
                if (err) {
                    console.log(`Error: ${err.message}`)
                    return onError(err)
                }
                if (user) {
                    return onUidFound(user, payload)
                } else {
                    return onUidNotFound(payload)
                }
            })
        }).catch(error => {
            // console.log(`Firebase Auth Error: ${error}`)
            onError(error.code)
        })
}

module.exports = {
    authorizedRequest,
    authorizedSocket,
    socketAuthConfig,
    moderatorRights,
    adminRights,
    assertAuthorizedHeader,
    checkUsernameConflict,
    verifyIdTokenWithFirebase
}