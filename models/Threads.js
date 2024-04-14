const mongoose = require('mongoose')
const { Schema, Types } = mongoose;

const ThreadSchema = new mongoose.Schema({
    // _id:  { type: Types.ObjectId },
    id: String,
    title: String,
    email:String,
    description:String,
    date:Date,
    replies:[
        {
          email: String,
          text: String,
          name: String,
        }
      ],
    likes:[
        {
          email: String,
        }
      ]
},{ collection: 'Thread'})


const ThreadModal = mongoose.model("Thread", ThreadSchema)
module.exports = ThreadModal