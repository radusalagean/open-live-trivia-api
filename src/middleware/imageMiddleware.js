const fs = require('fs')
const config = require('../config')
const mkdirp = require('mkdirp')
const jdenticon = require('jdenticon')

const parentDir = config.publicRootDirectory + '/' + config.userThumbnailsDirectory

async function generateImage(user) {
    const png = jdenticon.toPng(user._id.toString(), config.userThumbnailSize);
    mkdirp.sync(parentDir) // create directory tree if necessary
    let path = getImagePath(user)
    // Save the file
    fs.writeFile(path, png, err => {
        if (err) {
            console.log(`Error: ${err.message}`)
        }
    })
}

function deleteImage(user) {
    let path = getImagePath(user)
    // Delete the file
    fs.unlink(path, err => {
        if (err) {
          console.log(`Error: ${err.message}`)
        }
    })
}

function getImagePath(user) {
    return parentDir + '/' + user._id.toString() + '.png'
}

module.exports = {
    generateImage,
    deleteImage
}