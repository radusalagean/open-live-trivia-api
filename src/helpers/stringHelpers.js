/**
 * Replace the character from a specific index with a string
 * @param {String} string the original string
 * @param {Number} index the index of the character that needs to be replaced
 * @param {String} replace the string that will replace the target character
 */
function replaceAt(string, index, replace) {
    return string.substring(0, index) + replace + string.substring(index + 1);
}

function occurrenceCount(originalStr, query) {
    return originalStr.split(query).length - 1
}

function trimSurroundingCharacter(str, character) {
    if (str.charAt(0) === character && str.charAt(str.length -1) === character) {
        str = str.substr(1, str.length -2);
    }
    return str
}

module.exports = {
    replaceAt,
    occurrenceCount,
    trimSurroundingCharacter
}