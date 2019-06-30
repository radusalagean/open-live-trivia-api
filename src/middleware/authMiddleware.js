import HttpStatus from 'http-status-codes'
import * as userModel from '../model/user'
import * as admin from 'firebase-admin'
import * as jrh from '../helpers/jsonResponseHelpers'

const authorized = (req, res, next) => {
    // check if authorization header is present in the request
    console.log('Received authorized request')
    let idToken = req.headers.authorization
    if (!idToken) {
        return res.status(HttpStatus.UNAUTHORIZED)
            .json(jrh.message('Authorized header unavailable'))
    }
    console.log('Checking if the idToken is present in the database and is not expired')
    // check if the idToken is present in the database and is not expired
    userModel.User.findOne({
        idToken: idToken
    }, (err, user) => {
        if (err) {
            console.log(`Error: ${err.message}`)
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json(jrh.message('Error while searching the database for the specified idToken'))
        }
        if (!user) {
            console.log('Passed idToken not found in the db')
            checkAuthorization(idToken, res, next)
        } else {
            if (user.idTokenExp < Date.now()) {
                console.log('Passed idToken was found in the database but it\'s expired')
                checkAuthorization(idToken, res, next)
            } else {
                console.log('Passed idToken is valid')
                // Keep a ref to user in order to access later
                res.locals.user = user
                next()
            }
        }
    })
}

function assertAuthorizedHeader(req, res) {
    let idToken = req.headers.authorization
    if (!idToken) {
        res.status(HttpStatus.UNAUTHORIZED)
            .json(jrh.message('Authorized header unavailable'))
    }
    return idToken
}

function checkAuthorization(idToken, res, next) {
    verifyIdTokenWithFirebase(idToken, err => {
        // onError
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .json(jrh.message(`Error: (${err})`))
    }, (user, payload) => {
        // onUidFound
        // Update idToken and idTokenExp
        console.log(`Updating idToken(${idToken}) and idTokenExp(${payload.exp}) for uid ${payload.uid}`)
        user.idToken = idToken
        user.idTokenExp = new Date(payload.exp * 1000)
        user.save(err => {
            if (err) {
                console.log(err.message)
                return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .json(jrh.message('Error while updating idToken in the db'))
            }
            console.log('Authorization check passed')
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

// BASE METHODS

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

function verifyIdTokenWithFirebase(idToken, onError, onUidFound, onUidNotFound) {
    // Check idToken w/ Firebase Admin
    console.log('Checking idToken with Firebase Admin')
    admin.auth().verifyIdToken(idToken)
        .then(payload => {
            console.log('Firebase Auth Response')
            // Check if uid is in the database
            userModel.User.findOne({
                firebaseUid: payload.uid
            }, (err, user) => {
                if (err) {
                    console.log(`Database error: ${err.message}`)
                    return onError(err)
                }
                if (user) {
                    return onUidFound(user, payload)
                } else {
                    return onUidNotFound(payload)
                }
            })
        }).catch(error => {
            console.log(`Firebase Auth Error: ${error}`)
            onError(error.code)
        })
}

module.exports = {
    authorized,
    assertAuthorizedHeader,
    checkUsernameConflict,
    verifyIdTokenWithFirebase
}