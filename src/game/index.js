import * as ev from './events'
import * as jservice from '../game/jservice'
import * as stringHelpers from '../helpers/stringHelpers'
import config from '../config'
import Timer from './timer'

const GAME_STATE_NONE = 0
const GAME_STATE_SPLIT = 1
const GAME_STATE_TRANSITION = 2

/**
 * Characters that will always be shown in the splits
 */
const excludedCharacters = config.excludedCharacters

/**
 * Some answers from jservice come with HTML tags attached, 
 * we need to strip them out of the string
 */
const excludedHtmlTags = new RegExp(/<b>|<\/b>|<i>|<\/i>|<u>|<\/u>|<em>|<\/em>/gi)

var serverSocket

var gameState
var currentEntry
var splitTimer
var roundEndTimer
var partialAnswer
var currentValue
var splitValue
var roundAttempts
var roundAttemptsCountMap

function start(socket) {
    serverSocket = socket
    gameState = GAME_STATE_NONE
    requestNewEntry()
}

function requestNewEntry() {
    if (roundEndTimer) {
        roundEndTimer.stop()
    }
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
            clearRoundVars()
            currentEntry = entry
            roundAttempts = []
            roundAttemptsCountMap = new Map()
            startRound()
        }
        
    })
}

function startRound() {
    sanitizeQuestion()
    sanitizeAnswer()
    prepareValue()
    prepareFirstSplit()
    splitTimer = new Timer(nextSplit, config.splitInterval)
    gameState = GAME_STATE_SPLIT
    // SEND ROUND
    serverSocket.emit(ev.ROUND, {
        entryId: currentEntry.id,
        category: currentEntry.category && currentEntry.category.title ? currentEntry.category.title : undefined,
        clue: currentEntry.question,
        answer: partialAnswer,
        currentValue: currentValue,
    })
}

function sanitizeQuestion() {
    currentEntry.question = currentEntry.question.replace('\\', '')
}

function sanitizeAnswer() {
    currentEntry.answer = currentEntry.answer.trim()
    currentEntry.answer = currentEntry.answer.replace('\\', '')
    currentEntry.answer = currentEntry.answer.replace(excludedHtmlTags, '')
    currentEntry.answer = stringHelpers.trimSurroundingCharacter(currentEntry.answer, '"')
    currentEntry.answer = stringHelpers.trimSurroundingCharacter(currentEntry.answer, '\'')
}

function prepareFirstSplit() {
    let answer = currentEntry.answer
    let tmp = ''
    for (let i = 0; i < answer.length; i++) {
        tmp += excludedCharacters.has(answer.charAt(i)) ? 
            answer.charAt(i) : '_'
    }
    partialAnswer = tmp
    currentValue = parseFloat(currentEntry.value.toFixed(2))
    let missingLettersCount = stringHelpers.occurrenceCount(partialAnswer, '_')
    splitValue = parseFloat((currentValue / missingLettersCount).toFixed(2))
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
    if (splitTimer) {
        splitTimer.stop()
    }
    // Reveal new missing character
    let missingIndexes = []
    for (let i = 0; i < partialAnswer.length; i++) {
        if (partialAnswer.charAt(i) == '_') {
            missingIndexes.push(i)
        }
    }
    let rand = Math.floor(Math.random() * missingIndexes.length)
    let chosenIndex = missingIndexes[rand]
    partialAnswer = stringHelpers.replaceAt(partialAnswer, 
        chosenIndex, currentEntry.answer.charAt(chosenIndex))
    // Update the value
    currentValue = parseFloat((currentValue - splitValue).toFixed(2))
    console.log(`Split: ${partialAnswer} : ${currentValue}`)
    splitTimer = new Timer(areMoreSplitsAvailable() ? nextSplit : reveal, config.splitInterval)
    // SEND SPLIT
    serverSocket.emit(ev.SPLIT, {
        answer: partialAnswer,
        currentValue: currentValue
    })
}

function reveal() {
    if (splitTimer) {
        splitTimer.stop()
    }
    console.log(`Reveal: ${currentEntry.answer}`)
    prepareNextRound()
    serverSocket.emit(ev.REVEAL, {
        answer: currentEntry.answer
    })
}

function clearRoundVars() {
    currentEntry = undefined
    splitTimer = undefined
    partialAnswer = undefined
    currentValue = undefined
    splitValue = undefined
    roundAttempts = undefined
    roundAttemptsCountMap = undefined
}

function prepareNextRound() {
    gameState = GAME_STATE_TRANSITION
    // Start a new round after a delay
    roundEndTimer = new Timer(requestNewEntry, config.roundEndDelay)
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
    socket.emit(ev.WELCOME, getGameState(socket.client.user))
    socket.on(ev.REACTION, data => {
        if (data && data.emoji) {
            serverSocket.emit(ev.PEER_REACTION, {
                userId: socket.client.user._id.toString(),
                username: socket.client.user.username,
                emoji: data.emoji
            })
        }
    })
    socket.on(ev.ATTEMPT, data => {
        if (data && data.message && gameState == GAME_STATE_SPLIT) {
            let roundAttempt
            let correct = data.message.toLowerCase() == currentEntry.answer.toLowerCase()
            let user = socket.client.user
            let initialCoins = user.coins
            if (data.message.length > config.attemptStringMaxLength) {
                console.log(`${user.username} sent an attempt that exceeds ${config.attemptStringMaxLength} characters (${data.message.length}). Ignoring attempt`)
                return
            }
            if (!handleAttemptCost(user)) {
                return
            }
            if (correct) {
                // correct attempt
                correct = true
                rewardCurrentPrize(user)
                if (splitTimer) {
                    splitTimer.stop()
                }
                prepareNextRound()
            }
            let userId = user._id.toString()
            roundAttempt = {
                userId: userId,
                username: user.username,
                message: data.message,
                correct: correct
            }
            let pastCount = roundAttemptsCountMap.get(userId) ? 
                roundAttemptsCountMap.get(userId) : 0
            roundAttemptsCountMap.set(userId, ++pastCount)
            roundAttempts.push(roundAttempt)
            serverSocket.emit(ev.PEER_ATTEMPT, roundAttempt)
            let coinDiff = user.coins - initialCoins
            if (coinDiff != 0) {
                //SEND COIN_DIFF
                socket.emit(ev.COIN_DIFF, {
                    coinDiff: coinDiff
                })
            }
        }
    })
}

function disconnect(socket) {
    console.log(`disconnect(${socket.id})`)
    let user = socket.client.user
    if (user) {
        user.lastSeen = Date.now()
        // update diff and last seen in db
        user.save(err => {
            if (err) {
                console.log(`<!> Unable to update user ${user.username}: ${err.message}`)
                return
            }
        })
    }
}

function handleAttemptCost(user) {
    if (getFreeAttemptsLeft(user) == 0) {
        // The free attempts are used up for this round
        if (user.coins - config.extraAttemptCost < 0) {
            console.log(`${user.username} sent an attempt but was unable to pay for it, ignoring request...`)
            return false
        }
        user.coins -= config.extraAttemptCost
    }
    return true
}

function getFreeAttemptsLeft(user) {
    let pastAttempts = roundAttemptsCountMap.get(user._id.toString())
    if (!pastAttempts) {
        return config.freeAttemptsPerRound;
    }
    let diff = config.freeAttemptsPerRound - pastAttempts
    return diff < 0 ? 0 : diff
}

function rewardCurrentPrize(user) {
    if (currentValue > 0) {
        console.log(`Rewarding ${user.username} ${currentValue} coins for submitting the correct answer`)
        user.coins += currentValue
    }
}

function getGameState(user) {
    if (!gameState) {
        return {
            gameState: gameState
        }
    } else {
        return {
            gameState: gameState,
            userCoins: user.coins,
            entryId: currentEntry.id,
            category: currentEntry.category && currentEntry.category.title ? currentEntry.category.title : undefined,
            clue: currentEntry.question,
            answer: gameState == GAME_STATE_SPLIT ? partialAnswer : currentEntry.answer,
            currentValue: currentValue,
            elapsedSplitSeconds: gameState == GAME_STATE_SPLIT ? splitTimer.getElapsedSeconds() : undefined,
            totalSplitSeconds: gameState == GAME_STATE_SPLIT ? config.splitInterval / 1000 : undefined,
            freeAttemptsLeft: gameState == GAME_STATE_SPLIT ? getFreeAttemptsLeft(user) : undefined,
            attempts: roundAttempts
        }
    }
}

module.exports = {
    start,
    postAuth,
    disconnect
}