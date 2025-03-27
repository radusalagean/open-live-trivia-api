const fs = require('fs')
const config = require('../config')
const mkdirp = require('mkdirp')
const jdenticon = require('jdenticon')

const parentDir = config.publicRootDirectory + '/' + config.userThumbnailsDirectory

async function generateImage(user) {
    jdenticon.configure({
        lightness: {
            color: [0.40, 0.80],
            grayscale: [0.34, 0.90]
        },
        saturation: {
            color: 0.50,
            grayscale: 0.31
        },
        backColor: "#0000",
        padding: 0
    })
    const png = jdenticon.toPng(user.username, config.userThumbnailSize);
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