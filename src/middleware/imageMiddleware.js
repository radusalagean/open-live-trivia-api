import fs from 'fs'
import config from '../config'
import mkdirp from 'mkdirp'
import GeoPattern from 'geopattern'
import randomColor from 'randomcolor'
import { convert } from 'convert-svg-to-png'

const parentDir = config.publicRootDirectory + '/' + config.userThumbnailsDirectory

async function generateImage(user) {
    let pattern = GeoPattern.generate(user.username, {
        color: randomColor()
    })
    let svg = pattern.toSvg()
    let png = await convert(svg, {
        width: config.userThumbnailSize,
        height: config.userThumbnailSize
    })
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