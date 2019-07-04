import mongoose from 'mongoose'
import uniqueValidator from 'mongoose-unique-validator'

const ReportedEntrySchema = new mongoose.Schema({
    entryId: {
        type: Number,
        required: true,
        unique: true
    },
    category: String,
    clue: String,
    answer: String,
    reporters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    banned: {
        type: Boolean,
        required: true,
        default: false
    },
    lastReported: {
        type: Date,
        required: true,
        default: Date.now
    }
}, {
    versionKey: false
})

ReportedEntrySchema.plugin(uniqueValidator)

const ReportedEntry = mongoose.model('ReportedEntry', ReportedEntrySchema)

module.exports = ReportedEntry