import * as ev from './events'
import * as jservice from '../game/jservice'
import * as stringHelpers from '../helpers/stringHelpers'
import { 
    getPublicUserProjection 
} from '../model/user'
import config from '../config'
import Timer from './timer'
import ReportedEntry from '../model/reportedEntry'

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
var jServiceRetryInterval

// Round vars (reset every round)
var currentEntry
var splitTimer
var roundEndTimer
var partialAnswer
var currentValue
var splitValue
var roundAttempts
var roundAttemptsCountMap
var reporters

function start(socket) {
    serverSocket = socket
    gameState = GAME_STATE_NONE
    requestNewEntry()
}

function requestNewEntry() {
    if (jServiceRetryInterval) {
        clearInterval(jServiceRetryInterval)
        jServiceRetryInterval = undefined
    }
    if (roundEndTimer) {
        roundEndTimer.stop()
    }
    jservice.requestRandomEntry(err => {
        // onError
        console.log(`<!> jService ERROR: ${err.message}`)
        jServiceRetryInterval = setInterval(requestNewEntry, config.jServiceRetryInterval)
        return
    }, entry => {
        // onSuccess
        // console.log(entry)
        if (!isEntryValid(entry)) {
            console.log('<!> Invalid entry received, requesting another one...')
            requestNewEntry()
        } else {
            isEntryBanned(entry, banned => {
                if (banned) {
                    console.log(`<!> BANNED entry received, requesting another one...`)
                    requestNewEntry()
                    return
                }
                clearRoundVars()
                currentEntry = entry
                roundAttempts = []
                roundAttemptsCountMap = new Map()
                reporters = new Set()
                startRound()
            })
        }
        
    })
}

function isEntryBanned(entry, cb) {
    ReportedEntry.findOne({
        entryId: entry.id,
        banned: true
    }, (err, entry) => {
        if (err) {
            console.log(`Error: ${err.message}`)
        }
        cb(entry ? true : false)
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
    // console.log(`Split: ${partialAnswer} : ${currentValue}`)
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
    // console.log(`Split: ${partialAnswer} : ${currentValue}`)
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
    // console.log(`Reveal: ${currentEntry.answer}`)
    prepareNextRound()
    serverSocket.emit(ev.REVEAL, {
        answer: currentEntry.answer
    })
}

function clearRoundVars() {
    currentEntry = undefined
    splitTimer = undefined
    roundEndTimer = undefined
    partialAnswer = undefined
    currentValue = undefined
    splitValue = undefined
    roundAttempts = undefined
    roundAttemptsCountMap = undefined
    reporters = undefined
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
    if (!entry || !entry.id || !entry.question.trim() ||
            !entry.answer.trim() || !entry.answer.trim() || 
            entry.answer.includes('_')) {
        return false
    }
    return true
}

function postAuth(socket, data) {
    if (socket.client.initialized) {
        console.log(`${socket.client.user.username} attempted to double-authenticate, ignoring request...`)
        return
    }
    // console.log(`postAuth(${socket.id})`)
    socket.emit(ev.WELCOME, getGameState(socket.client.user))
    // Send the game state as soon as the player is authenticated
    socket.broadcast.emit(ev.PEER_JOIN, {
        userId: socket.client.user._id.toString(),
        username: socket.client.user.username
    })
    // Handle events coming from the client app
    socket.on(ev.REACTION, data => onReaction(socket, data))
    socket.on(ev.ATTEMPT, data => onAttempt(socket, data))
    socket.on(ev.REPORT_ENTRY, data => onReportEntry(socket, data))
    socket.on(ev.REQUEST_PLAYER_LIST, data => onRequestPlayerList(socket, data))
    socket.client.initialized = true
}

// SOCKET EVENT: REACTION
function onReaction(socket, data) {
    if (data && data.emoji) {
        serverSocket.emit(ev.PEER_REACTION, {
            userId: socket.client.user._id.toString(),
            username: socket.client.user.username,
            emoji: data.emoji
        })
    }
}

// SOCKET EVENT: ATTEMPT
function onAttempt(socket, data) {
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
}

// SOCKET EVENT: REPORT_ENTRY
function onReportEntry(socket, data) {
    let user = socket.client.user
    console.log(`Received entry report from ${user.username}`)
    if (gameState && currentEntry) {
        ReportedEntry.findOne({
            entryId: currentEntry.id
        }, (err, reportedEntry) => {
            if (err) {
                console.log(`Error: ${err.message}`)
                socket.emit(ev.ENTRY_REPORTED_ERROR)
                return
            }
            if (reportedEntry) {
                console.log('Reported entry found in the db, add the user as a reporter')
                let previousReports = reportedEntry.reporters.filter(reporter => reporter._id == user.id)
                if (previousReports.length > 0) {
                    console.log('The entry was already reported by the user, ignoring request')
                    reporters.add(user._id.toString())
                    socket.emit(ev.ENTRY_REPORTED_OK)
                } else {
                    console.log(`The entry was reported before by other users, adding ${user.username} to reporters`)
                    reportedEntry.reporters.push(user)
                    reportedEntry.lastReported = Date.now()
                    reportedEntry.save(err => {
                        if (err) {
                            console.log(`Error: ${err.message}`)
                            socket.emit(ev.ENTRY_REPORTED_ERROR)
                            return
                        }
                        console.log('Entry reported successfully')
                        reporters.add(user._id.toString())
                        socket.emit(ev.ENTRY_REPORTED_OK)
                    })
                }
            } else {
                console.log('This entry wasn\'t reported by anyone else yet, submitting report')
                let report = new ReportedEntry()
                report.entryId = currentEntry.id
                report.category = currentEntry.category ? currentEntry.category.title : undefined
                report.clue = currentEntry.question
                report.answer = currentEntry.answer
                report.reporters = [ user ]
                report.save(err => {
                    if (err) {
                        console.log(`Error: ${err.message}`)
                        socket.emit(ev.ENTRY_REPORTED_ERROR)
                        return
                    }
                    console.log('Entry reported successfully')
                    reporters.add(user._id.toString())
                    socket.emit(ev.ENTRY_REPORTED_OK)
                })
            }
        })
    }
}

// SOCKET EVENT: REQUEST_PLAYER_LIST
function onRequestPlayerList(socket, data) {
    let userMap = getPlayingUsers()
    socket.emit(ev.PLAYER_LIST, Array.from(userMap.values()))
}

function getPlayingUsers() {
    let clientSockets = Object.values(serverSocket.sockets.sockets)
    let userMap = new Map()
    clientSockets.forEach(clientSocket => {
        let user = clientSocket.client.user
        if (user) {
            userMap.set(user._id.toString(), getPublicUserProjection(user))
        }
    })
    // Sort by user's coins (descending)
    userMap = new Map([...userMap.entries()].sort((a, b) => b[1].coins - a[1].coins))
    return userMap
}

function getPlayingUsersCount() {
    let clientSockets = Object.values(serverSocket.sockets.sockets)
    let count = 0
    clientSockets.forEach(clientSocket => {
        if (clientSocket.client.user) {
            count++
        }
    })
    return count
}

function disconnect(socket) {
    // console.log(`disconnect(${socket.id})`)
    let user = socket.client.user
    if (user) {
        user.lastSeen = Date.now()
        serverSocket.emit(ev.PEER_LEFT, {
            userId: socket.client.user._id.toString(),
            username: user.username
        })
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
        return config.freeAttemptsPerRound
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
            entryReported: reporters.has(user._id.toString()),
            players: getPlayingUsersCount(),
            attempts: roundAttempts
        }
    }
}

function disconnectEveryone() {
    let clientSockets = Object.values(serverSocket.sockets.sockets)
    let disconnectedCount = 0
    clientSockets.forEach(clientSocket => {
        clientSocket.disconnect()
        disconnectedCount++
    })
    return disconnectedCount
}

module.exports = {
    start,
    postAuth,
    disconnect,
    getPlayingUsers,
    disconnectEveryone
}