function error(errorCode, message) {
    return {
        errorCode: errorCode,
        message: message
    }
}

function message(message) {
    return {
        message: message
    }
}

module.exports = {
    error,
    message
}