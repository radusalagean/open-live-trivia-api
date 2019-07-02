import * as ev from './events'
import * as jservice from '../game/jservice'
import * as stringHelper from '../helpers/stringHelpers'
import config from '../config'

/**
 * Characters that will always be shown in the splits
 */
const excludedCharacters = new Set([' ', '"'])

var currentEntry
var interval
var partialAnswer
var currentValue
var splitValue

function start() {
    requestNewEntry()
}

function requestNewEntry() {
    clearInterval(interval)
    jservice.requestRandomEntry(err => {
        // onError
        // TODO
    }, entry => {
        // onSuccess
        console.log(entry)
        if (!isEntryValid(entry)) {
            console.log('<!> Invalid entry received, requesting another one...')
            requestNewEntry()
        } else {
            // TODO check if entry is banned
            currentEntry = entry
            startRound()
        }
        
    })
}

function startRound() {
    sanitizeAnswer()
    prepareValue()
    prepareFirstSplit()
    interval = setInterval(nextSplit, config.splitInterval)
}

function sanitizeAnswer() {
    currentEntry.answer = currentEntry.answer.trim()
}

function prepareFirstSplit() {
    let answer = currentEntry.answer
    let tmp = ''
    for (let i = 0; i < answer.length; i++) {
        tmp += excludedCharacters.has(answer.charAt(i)) ? 
            answer.charAt(i) : '_'
    }
    partialAnswer = tmp
    currentValue = currentEntry.value.toFixed(2)
    let missingLettersCount = stringHelper.occurrenceCount(partialAnswer, '_')
    console.log(`missing letters: ${missingLettersCount}`)
    splitValue = (currentValue / missingLettersCount).toFixed(2)
    console.log(`Split value: ${splitValue}`)
    console.log(`Split: ${partialAnswer} : ${currentValue}`)
}

function prepareValue() {
    // Allowed values: [10 : 100] (increment unit: 10)
    if (!currentEntry.value) {
        currentEntry.value = Math.floor(((Math.random() * 10) + 1)) * 10
        console.log(`<!> The entry has no value assigned, generated a random value instead (${currentEntry.value})`)
    } else {
        // original values need to be altered in order to match the allowed values from above
        currentEntry.value /= 10
    }
}

function nextSplit() {
    clearInterval(interval)
    // Reveal new missing character
    let missingIndexes = []
    for (let i = 0; i < partialAnswer.length; i++) {
        if (partialAnswer.charAt(i) == '_') {
            missingIndexes.push(i)
        }
    }
    let rand = Math.floor(Math.random() * missingIndexes.length)
    let chosenIndex = missingIndexes[rand]
    partialAnswer = stringHelper.replaceAt(partialAnswer, 
        chosenIndex, currentEntry.answer.charAt(chosenIndex))
    // Update the value
    currentValue = (currentValue - splitValue).toFixed(2)
    console.log(`Split: ${partialAnswer} : ${currentValue}`)
    if (areMoreSplitsAvailable()) {
        interval = setInterval(nextSplit, config.splitInterval)
    } else {
        interval = setInterval(reveal, config.splitInterval)
    }

}

function reveal() {
    clearInterval(interval)
    console.log(`Reveal: ${currentEntry.answer}`)
    prepareNextRound()
}

function prepareNextRound() {
    // Clear round vars
    currentEntry = undefined
    interval = undefined
    partialAnswer = undefined
    currentValue = undefined
    splitValue = undefined
    // Start a new round after a delay
    interval = setInterval(requestNewEntry, config.roundEndDelay)
}

function areMoreSplitsAvailable() {
    return partialAnswer.split('_').length > 2
}

function isEntryValid(entry) {
    if (!entry || !entry.question.trim() ||
            !entry.answer.trim() || !entry.answer.trim() || 
            entry.answer.includes('_')) {
        return false
    }
    return true
}

function postAuth(socket, data) {
    console.log(`postAuth(${socket.id})`)
    socket.on(ev.JOIN, () => {
        console.log(`ON JOIN from ${socket.client.id}`)
        socket.emit(ev.WELCOME, 'game state')
    })
}

function disconnect(socket) {
    console.log(`disconnect(${socket.id})`)
}

module.exports = {
    start,
    postAuth,
    disconnect
}