import mongoose from 'mongoose'
import config from '../config'

const TYPE_REGULAR = 0
const TYPE_MODERATOR = 1
const TYPE_ADMIN = 2

const UserSchema = new mongoose.Schema({
    firebaseUid: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        minlength: config.usernameMinLength,
        maxlength: config.usernameMaxLength
    },
    joined: {
        type: Date,
        required: true,
        default: Date.now
    },
    lastSeen: {
        type: Date,
        required: true,
        default: Date.now
    },
    rights: {
        type: Number,
        required: true,
        default: TYPE_REGULAR
    },
    idToken: {
        type: String,
        required: true,
        select: false
    },
    idTokenExp: {
        type: Date,
        required: true
    },
    coins: {
        type: Number,
        required: true,
        default: config.freeStartingCoins
    }
}, {
    versionKey: false
})

const User = mongoose.model('User', UserSchema)

function getPublicUserProjection(user) {
    return {
        _id: user._id,
        username: user.username,
        rights: user.rights,
        coins: user.coins
    }
}

module.exports = {
    TYPE_REGULAR,
    TYPE_MODERATOR,
    TYPE_ADMIN,
    User,
    getPublicUserProjection
}