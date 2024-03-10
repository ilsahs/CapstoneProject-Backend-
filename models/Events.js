const mongoose = require('mongoose')
const { Schema, Types } = mongoose;

const EventSchema = new mongoose.Schema({
    // _id:  { type: Types.ObjectId },
    title: String,
    date:String,
    time: String,
    location:String,
    category:String,
    description:String,
    image: String
},{ collection: 'Events', versionKey: false })


const EventModel = mongoose.model("Events", EventSchema)
module.exports = EventModel