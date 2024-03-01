const express = require("express")
const mongoose = require('mongoose')
const cors = require("cors")
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const Comments = require('./models/Comments')
const multer = require('multer');
const path = require('path');
const { errorMonitor } = require("events")
const bodyParser = require("body-parser")
const dotenv = require("dotenv")
const cron = require('node-cron');
const fs = require('fs');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

//Models
const UserModel = require('./models/Users')
const EventModel = require('./models/Events')

const app = express()
app.use(express.json())
app.use(cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
}))
app.use(cookieParser())
app.use(bodyParser.json());

dotenv.config()

const {OpenAIClient, AzureKeyCredential} = require("@azure/openai");
const CommentsModel = require("./models/Comments")
const endpoint = process.env["ENDPOINT"] || "<endpoint>";
const azureApiKey = process.env["AZURE_API_KEY"] || "<api key>";

mongoose.connect('mongodb+srv://meera:12class34@cluster0.f34xz2a.mongodb.net/qatarEvents');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); 
    },
    filename: function (req, file, cb) {        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

app.use('/uploads', express.static('uploads'));

const verifyUser = (req, res, next) => {
    const token = req.cookies.token;
    console.log("this is token:", token)
    if (!token || token === "undefined") {
        console.log("here 1")
        return res.status(401).json("Token is missing");
    } else {
        console.log("here 2")
        jwt.verify(token, "jwt-secret-key", (err, decoded) => {
            if (err) {
                console.log("here 3")
                console.error("Error with token verification:", err);
                return res.status(401).json("Error with token");
            } else {
                console.log("here 4")
                req.decoded = decoded;

                next();
            }
        });
    }
}

const pythonScriptPath = './scraping/scraping.py';
const jsonFilePath = './scraping/events_data.json';
const command = `python ${pythonScriptPath}`;
const readFile = promisify(fs.readFile);

//Schedule web scraping for every hour: 0 * * * *
//every 5 minutes: */5 * * * *
cron.schedule('*/5 * * * *', async () => {
// const scrape = async () => {
    console.log('Running Python script...');
    // Execute the Python script
    try {
        const { stdout, stderr } = await exec(command);
        if (stderr) {
            console.error(`Python script STDERR: ${stderr}`);
        }
        console.log(`Python script STDOUT: ${stdout}`);
        
        // Read the JSON file
        const data = await readFile(jsonFilePath, 'utf8');
        const scrapedEvents = JSON.parse(data);
        // Assuming updateEvents is an async function
        updateEvents(scrapedEvents);
    } catch (error) {
        console.error(`Error: ${error}`);
    }
}, 
{
    scheduled: true,
    timezone: 'Asia/Qatar'
});

const updateEvents = (scrapedEvents) => {
    console.log(`Total Events: ${scrapedEvents.length}`)
    scrapedEvents.forEach (async e => {
    await EventModel.findOneAndUpdate(
        //check if the event exists based on the name
        {title: e.name},
        //if it exists, u update it by replacing it completely
        e,
        //else you insert a new event to the db
        {upsert: true, new: true})
        .then(() => {
            console.log(`Event ${e.name} updated/added successfully`);
        })
        .catch(error => {
            console.error(`Error updating/adding event: ${error}`);
        });
    })
}

// Dashboard
app.get('/dashboard', verifyUser, (req, res) => {
    EventModel.find().then(events => {
        //console.log(events);
        res.json(events);
    }).catch(err => {
        console.error("Error fetching events:", err);
        res.status(500).json(err);
    });
})

//All users
app.get('/all', (req, res) => {
    //console.log("testing log")
    UserModel.find().then((result) => {
        res.send(result);
    }).catch((err) => {
        res.send(err)
    })
})

//All Comments
app.get('/allcomments', (req, res) => {
    Comments.find().then((result) => {
        res.send(result);
    }).catch((err) => {
        res.send(err)
    })
})

//Register
app.post('/Register', (req, res) => {
    const { Name, Email, Password } = req.body;
    bcrypt.hash(Password, 10)
        .then(hash => {
            UserModel.create({ Name: Name, Email: Email, Password: hash })
                .then(user => res.json("Success"))
                .catch(err => res.json(err))
        }).catch(err => res.json(err))
})

//Login
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

//Logout
app.get('/logout', (req, res) => {
    res.clearCookie('token')
    return res.json({logout : true})
})

//Test
app.post('/test', verifyUser, (req, res) => {
    const email = req.decoded.Email;
    //console.log(email)
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

//Complete Profile
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

//Get comments based on event ID
app.get('/comments/:eventId', async (req, res) => {
    const eventId = req.params.eventId;
    try {
        Comments.find({ Eventid: eventId }).then((result) => {
         
            //console.log("this is result of comments", result)
            res.send(result);
        }).catch((err) => {
            res.send(err)
        })

    } catch (err) {
      console.error(err.message);
      
    }
});

//Chatbot
app.post("/chat", async(req, res) => {
    const {prompt} = req.body
    try{
    const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
    const deploymentId = "events-hub";
    jsonFile = "./prompts.json"
    const fileData = await readFile(jsonFile, 'utf8');
    const prompts = JSON.parse(fileData);
    prompts[prompts.length -1]['content'] = prompt;

    const result = await client.getChatCompletions(deploymentId, prompts,
    {
      temperature: 1,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0 
    },
    );
    for (const choice of result.choices) {
       res.send(choice.message.content);
     }
    }
    catch(err){
        res.status(500).send(err)
    }
})

const port = process.env.port || 3001

app.listen(port, () => {
    console.log("Server is Running")
})