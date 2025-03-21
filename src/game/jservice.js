const http = require('http');
const HttpStatus = require('http-status-codes');

var running

function requestRandomEntry(onError, onSuccess) {
    // console.log('Requesting random entry...')
    let rawResponse
    let entryArray
    let req = http.request(getOptions, res => {
        // console.log(`Response code: ${res.statusCode}`)
        res.on('data', data => {
            if (res.statusCode == HttpStatus.OK) {
                rawResponse = data.toString()
            }
        })

        res.on('end', () => {
            if (rawResponse) {
                entryArray = JSON.parse(rawResponse)
                running = true
                onSuccess(entryArray[0])
            } else {
                running = false
                onError('No response returned')
            }
        })
    })
    req.on('error', err => {
        console.log(`Error: ${err.message}`)
        running = false
        onError(err)
    })
    req.end()
}

function isServiceRunning() {
    return running
}

const getOptions = {
    host: 'localhost',
    port: 3000,
    path: '/api/random',
    method: 'GET'
}

module.exports = {
    requestRandomEntry,
    isServiceRunning
}