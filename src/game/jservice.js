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
                // TEST
                // rawResponse = `[
                //     {
                //         "id": 5367,
                //         "answer": "\'Edelweiss\'",
                //         "question": "This song from \'The Sound of Music\' ends with \'Bless my homeland forever\'",
                //         "value": 100,
                //         "airdate": "1990-05-23T12:00:00.000Z",
                //         "created_at": "2014-02-11T22:50:03.157Z",
                //         "updated_at": "2014-02-11T22:50:03.157Z",
                //         "category_id": 739,
                //         "game_id": null,
                //         "invalid_count": null,
                //         "category": {
                //             "id": 739,
                //             "title": "broadway lyrics",
                //             "created_at": "2014-02-11T22:50:03.098Z",
                //             "updated_at": "2014-02-11T22:50:03.098Z",
                //             "clues_count": 25
                //         }
                //     }
                // ]`
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