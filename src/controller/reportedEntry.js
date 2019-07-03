import Router from 'express'
import ReportedEntry from '../model/reportedEntry'
import HttpStatus from 'http-status-codes'
import * as jrh from '../helpers/jsonResponseHelpers'
import * as auth from '../middleware/authMiddleware'

function queryReportedEntry(reportId, res, cb) {
    if (!reportId) {
        return res.status(HttpStatus.BAD_REQUEST)
            .json(jrh.message('Please provide the report id in the request URL'))
    }
    ReportedEntry.findById(reportId, (err, entry) => {
        if (err) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json(jrh.message(`Error: ${err.message}`))
        }
        if (!entry) {
            return res.status(HttpStatus.NOT_FOUND)
                .json(jrh.message('No entry found for the passed report id'))
        }
        cb(entry)
    })
}

function saveEntry(entry, res, cb) {
    entry.save(err => {
        if (err) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json(jrh.message(`Error: ${err.message}`))
        }
        cb()
    })
}

module.exports = () => {
    let api = Router()
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
            }, err => {
                if (err) {
                    return res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .json(jrh.message(`Error: ${err.message}`))
                }
                return res.status(HttpStatus.OK)
                    .json(jrh.message('Entry report dismissed successfully'))
            })
        })
    })

    return api
}