const Router = require('express')
const ReportedEntry = require('../model/reportedEntry')
const HttpStatus = require('http-status-codes')
const jrh = require('../helpers/jsonResponseHelpers')
const paginationHelpers = require('../helpers/paginationHelpers')
const auth = require('../middleware/authMiddleware')
const game = require('../game')
const config = require('../config')

function queryReportedEntry(reportId, res, cb) {
    if (!reportId) {
        return res.status(HttpStatus.BAD_REQUEST)
            .json(jrh.message('Please provide the report id in the request URL'))
    }
    ReportedEntry.findById(reportId).then(entry => {
        if (!entry) {
            return res.status(HttpStatus.NOT_FOUND)
                .json(jrh.message('No entry found for the passed report id'))
        }
        cb(entry)
    }).catch(err => {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .json(jrh.message(`Error: ${err.message}`))
    })
}

function saveEntry(entry, res, cb) {
    entry.save().then(entry => {
        cb()
    }).catch(err => {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .json(jrh.message(`Error: ${err.message}`))
    })
}

module.exports = () => {
    let api = Router()

    api.get('/get_reports', auth.authorizedRequest, auth.moderatorRights, (req, res) => {
        // Exclude the current entry being played
        let currentEntry = game.getCurrentEntryId()
        let findCriteria = {
            entryId: { $ne: currentEntry }
        }
        // if the banned query is in the url, narrow the search
        // otherwise, return all reports
        let banned = req.query.banned
        if (banned) {
            findCriteria.banned = banned
        }
        ReportedEntry.countDocuments(findCriteria).then(count => {
            let perPage = config.reportedEntriesPerPage
            let pages = paginationHelpers.getNumOfPages(count, perPage)
            let page = paginationHelpers.getCurrentPage(req, pages)
            ReportedEntry.find(findCriteria)
                .skip((page - 1) * perPage)
                .limit(perPage)
                .sort({ lastReported: -1 })
                .populate('reporters', 'username')
                .then(reportedEntries => {
                    res.status(HttpStatus.OK)
                        .json(paginationHelpers.getPaginatedResponse(page, pages, count, perPage, reportedEntries))
                }).catch(err => {
                    return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .json(jrh.message(`Error: ${err.message}`))
                })
        }).catch(err => {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json(jrh.message(`Error: ${err.message}`))
        })
    })

    api.put('/ban/:report_id', auth.authorizedRequest, auth.moderatorRights, (req, res) => {
        queryReportedEntry(req.params.report_id, res, entry => {
            if (entry.banned) {
                return res.status(HttpStatus.BAD_REQUEST)
                    .json(jrh.message('The entry is already banned'))
            }
            entry.banned = true
            saveEntry(entry, res, () => {
                return res.status(HttpStatus.OK)
                    .json(jrh.message('The entry has been banned successfully'))
            })
        })
    })

    api.put('/unban/:report_id', auth.authorizedRequest, auth.moderatorRights, (req, res) => {
        queryReportedEntry(req.params.report_id, res, entry => {
            if (!entry.banned) {
                return res.status(HttpStatus.BAD_REQUEST)
                    .json(jrh.message('The entry is not banned yet'))
            }
            entry.banned = false
            saveEntry(entry, res, () => {
                return res.status(HttpStatus.OK)
                    .json(jrh.message('The entry has been unbanned successfully'))
            })
        })
    })

    api.put('/dismiss/:report_id', auth.authorizedRequest, auth.moderatorRights, (req, res) => {
        queryReportedEntry(req.params.report_id, res, entry => {
            ReportedEntry.deleteOne({
                _id: entry._id
            }).then(() => {
                return res.status(HttpStatus.OK)
                    .json(jrh.message('Entry report dismissed successfully'))
            }).catch(err => {
                return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .json(jrh.message(`Error: ${err.message}`))
            })
        })
    })

    return api
}