import mongoose from 'mongoose'

const ReportedEntrySchema = new mongoose.Schema({
    entryId: {
        type: Number,
        required: true
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
    }
})

const ReportedEntry = mongoose.model('ReportedEntry', ReportedEntrySchema)

module.exports = ReportedEntry