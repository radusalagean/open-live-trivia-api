import mongoose from 'mongoose'
import config from '../config'

export default callback => {
  console.log('connecting to db')
  let db = mongoose.connect(config.mongoUrl, { useNewUrlParser: true })
  callback(db)
}