const mongoose = require('mongoose')

const EventSchema = new mongoose.Schema({
   
    title: String,
    date:String,
    location:String,
    category:String,
    summary:String,
    link:String,
    
    

},{ collection: 'Events' })


const EventModal = mongoose.model("Events", EventSchema)
module.exports = EventModal