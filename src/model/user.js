import mongoose from 'mongoose'

const TYPE_REGULAR = 0
const TYPE_MODERATOR = 1
const TYPE_ADMIN = 2

const UserSchema = new mongoose.Schema({
    firebaseUid: {
        type: String,
        required: true,
        select: false
    },
    username: {
        type: String,
        required: true,
        maxlength: 50
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
        default: 100
    }
})

const User = mongoose.model('User', UserSchema)

module.exports = {
    TYPE_REGULAR,
    TYPE_MODERATOR,
    TYPE_ADMIN,
    User
}