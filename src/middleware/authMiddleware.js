const HttpStatus = require('http-status-codes');
const userModel = require('../model/user');
const admin = require('firebase-admin');
const jrh = require('../helpers/jsonResponseHelpers');

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
    userModel.User.findOne({
        idToken: idToken
    }).then(user => {
        if (!user) {
            // console.log('Passed idToken not found in the db')
            onIdTokenUnknown()
        } else if (user.idTokenExp < Date.now()) {
            // console.log('Passed idToken was found in the database but it\'s expired')
            onIdTokenExpired()
        } else {
            // console.log('Passed idToken is valid')
            onIdTokenValid(user)
        }
    }).catch(err => {
        console.log(`Error: ${err.message}`)
        onError(err)
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
    user.save().then(user => {
        // console.log('Authorization check passed')
        onComplete()
    }).catch(err => {
        console.log(`Error: ${err.message}`)
        onError(err)
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
    }).then(user => {
        return user ? onConflict() : onNonConflict()
    }).catch(err => {
        onError(err)
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
            }).then(user => {
                if (user) {
                    return onUidFound(user, payload)
                } else {
                    return onUidNotFound(payload)
                }
            }).catch(err => {
                console.log(`Error: ${err.message}`)
                onError(err)
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