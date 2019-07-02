import http from 'http'
import HttpStatus from 'http-status-codes'

function requestRandomEntry(onError, onSuccess) {
    console.log('requestRandomEntry')
    let rawResponse
    let entryArray
    let req = http.request(getOptions, res => {
        console.log(`response code: ${res.statusCode}`)
        res.on('data', data => {
            if (res.statusCode == HttpStatus.OK) {
                rawResponse = data.toString()
            }
        })

        res.on('end', () => {
            if (rawResponse) {
                entryArray = JSON.parse(rawResponse)
                onSuccess(entryArray[0])
            } else {
                onError('No response returned')
            }
        })
    })
    req.on('error', err => {
        console.log(err.message)
        onError(err)
    })
    req.end()
}

const getOptions = {
    host: 'jservice.io',
    port: 80,
    path: '/api/random',
    method: 'GET'
}

module.exports = {
    requestRandomEntry
}