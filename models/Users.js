const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
   
UserID: String,
Password:String,
AccountType:String,
ProfilePicture:String,
Name:String,
DOB:String,
Email:String,
Preferences: String,
Skip: String

},{ collection: 'UserAccounts' })


const UserModel = mongoose.model("UserAccounts", UserSchema)
module.exports = UserModel