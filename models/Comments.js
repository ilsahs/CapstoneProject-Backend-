const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    Eventid: String,
    "Comments": [
      {
        user: String,
        name: String,
        comment: String
      }
    ]
  },{ collection: 'Comments' });
  
  const CommentsModel = mongoose.model('Comments', commentSchema);

  module.exports = CommentsModel