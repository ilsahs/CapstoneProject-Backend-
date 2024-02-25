const mongoose = require('mongoose')
const { Schema, Types } = mongoose;

const EventSchema = new mongoose.Schema({
    _id:  { type: Types.ObjectId },
    title: String,
    date:String,
    location:String,
    category:String,
    summary:String,
    link:String,
    
    

},{ collection: 'Events' })


const EventModel = mongoose.model("Events", EventSchema)
module.exports = EventModel