const express = require("express")
const mongoose = require('mongoose')
const cors = require("cors")
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const UserModel = require('./models/Users')
const multer = require('multer');
const path = require('path');
const { errorMonitor } = require("events")

const app = express()
app.use(express.json())
app.use(cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
}))
app.use(cookieParser())

mongoose.connect('mongodb+srv://meera:12class34@cluster0.f34xz2a.mongodb.net/qatarEvents');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Specify the destination folder
    },
    filename: function (req, file, cb) {
        // Generate a unique filename (you can use a library like `uuid`)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

// Serve static files from the 'uploads' folder
app.use('/uploads', express.static('uploads'));

const verifyUser = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.json("Token is missing")
    } else {
        jwt.verify(token, "jwt-secret-key", (err, decoded) => {
            if (err) {
                return res.json("Error with token")
            } else {
                req.decoded = decoded;
                next()

            }
        })
    }
}

app.get('/dashboard', verifyUser, (req, res) => {
    res.json("Success")
})

app.get('/all', (req, res) => {
    UserModel.find().then((result) => {
        res.send(result);
    }).catch((err) => {
        res.send(err)
    })
})

app.post('/Register', (req, res) => {
    const { Name, Email, Password } = req.body;
    bcrypt.hash(Password, 10)
        .then(hash => {
            UserModel.create({ Name: Name, Email: Email, Password: hash })
                .then(user => res.json("Success"))
                .catch(err => res.json(err))
        }).catch(err => res.json(err))
})

app.post('/test', verifyUser, (req, res) => {
    const email = req.decoded.Email;
    console.log(email)
    res.send(email)

})
function check(email) {
    UserModel.findOne({ Email: email })
        .then(user => {
            if (user.ProfilePicture == null || user.DOB == null) {
                return "incomp"
            }
            return "Success"
        })
}

app.post('/complete', upload.single('ProfilePicture'), async (req, res) => {

    try {
        //getting email from token
        const token = req.cookies.token
        const decoded = jwt.verify(token, "jwt-secret-key");
        const userEmail = decoded.Email;


        
        const ProfilePicture = req.file ? req.file.filename : null;

        const { DOB, selectedPreferences } = req.body;
        // console.log(userEmail, selectedPreferences, DOB, ProfilePicture);
        if (userEmail) {
            const update = await UserModel.findOneAndUpdate(
                { Email: userEmail },
                {
                    $set: {
                        DOB: DOB,
                        Preferences: selectedPreferences,
                        ProfilePicture: ProfilePicture
                    },
                },
                { new: true, useFindAndModify: false }
            );

            if (!update) {
                return res.status(404).json({ error: 'User not found' });
            }
        }

        res.json({ message: 'Success' });
    }
    catch (error) {
        console.error("Error:", error);
        return res.status(401).json("Invalid token");
    }


})

app.post('/login', (req, res) => {
    const { Email, Password } = req.body;
    UserModel.findOne({ Email: Email })
        .then(user => {
            if (user) {
                bcrypt.compare(Password, user.Password, (err, response) => {
                    if (response) {
                        const token = jwt.sign({ Email: user.Email },
                            "jwt-secret-key", { expiresIn: '30m' })
                        res.cookie('token', token)
                        let checkacc = check(Email);
                        return res.json({ Status: "Success" })
                    } else {
                        return res.json("The password is incorrect")
                    }
                })
            } else {
                return res.json("No record existed")
            }
        })
})


app.listen(3001, () => {
    console.log("Server is Running")
})