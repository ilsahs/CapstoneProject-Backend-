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
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const mime = require('mime-types');
var FormData = require('form-data');
const axios = require('axios');

//Models
const UserModel = require('./models/Users')
const EventModel = require('./models/Events')
const CommentsModel = require("./models/Comments")

const app = express()
app.use(express.json())
app.use(cors({
    origin: ["https://qeventhub.vercel.app/"],
    methods: ["GET", "POST"],
    credentials: true
}))
app.use(cookieParser())
app.use(bodyParser.json());

dotenv.config()

//Environment Variables
const endpoint = process.env["ENDPOINT"] || "<endpoint>";
const azureApiKey = process.env["AZURE_API_KEY"] || "<api_key>";
const deploymentName = process.env["DEPLOYMENT_NAME"] || "<deployment_name";
const whisperEndpoint = process.env["WHIPER_ENDPOINT"] || "<whisper_endpoint>";
const whisperAzureApiKey = process.env["WHISPER_API_KEY"] || "<whisper_api_key>";
const whisperDeploymentName = process.env["WHISPER_DEPLOYMENT_NAME"] || "<whisper_deployment_name";
const visionDeploymentName = process.env["VISION_DEPLOYMENT_NAME"] || "<vision_deployment_name";

mongoose.connect('mongodb+srv://meera:12class34@cluster0.f34xz2a.mongodb.net/qatarEvents');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const folder = file.mimetype.startsWith('image/') ? 'images'
            : file.mimetype.startsWith('audio/') ? 'audios'
                : 'others';
        const destPath = path.join(__dirname, 'uploads', folder);
        fs.mkdirSync(destPath, { recursive: true });
        cb(null, destPath);
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
    //console.log("this is token:", token)
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
cron.schedule('0 * * * *', async () => {
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
    scrapedEvents.forEach(async e => {
        await EventModel.findOneAndUpdate(
            //check if the event exists based on the name
            { title: e.name },
            //if it exists, u update it by replacing it completely
            e,
            //else you insert a new event to the db
            { upsert: true, new: true })
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
    const token = req.cookies.token
    const decoded = jwt.verify(token, "jwt-secret-key");
    const userEmail = decoded.Email;
    //console.log(userEmail, "emaillasnaskndls")
    EventModel.find().then(events => {
        //console.log(events);
        res.json({ events: events, email: userEmail });
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

app.post('/comments', async (req, res) => {
    console.log("reaching in comments post")
    try {
        const { eventID, newComment, email } = req.body;
        console.log(eventID)
        //const event = await CommentsModel.findById(eventId);
        //console.log(event)
        console.log(email)
        console.log(newComment)


        const user = await UserModel.findOne({ Email: email });
        const name = user.Name;

        CommentsModel.findOneAndUpdate(
            { Eventid: eventID }, 
            {
                $push: {
                    Comments: { 
                        user: email,
                        name: name,
                        comment: newComment
                    }
                }
            },
            { upsert: true, new: true } 
        ).then(updatedEvent => {
            console.log('Comment added successfully');
            console.log(updatedEvent); 
        })
        .catch(error => {
            console.error('Error adding comment:', error);
        });
        console.log(name)
        
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})
//Register
app.post('/Register', (req, res) => {
    const { Name, Email, Password } = req.body;
    bcrypt.hash(Password, 10)
        .then(hash => {
            UserModel.create({ Name: Name, Email: Email, Password: hash, Skip:'false' })
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
                console.log("in user here")
                bcrypt.compare(Password, user.Password, (err, response) => {
                    if (response) {
                        console.log("in the response")
                        const token = jwt.sign({ Email: user.Email },
                            "jwt-secret-key", { expiresIn: '30m' })
                        res.cookie('token', token)
                        let checkacc = check(Email);
                        console.log("now returning")
                        return res.json({ Status: "Success", Skip: user.Skip })
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
    return res.json({ logout: true })
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

app.get("/api/thread/like", (req, res) => {
    const token = req.cookies.token
    const decoded = jwt.verify(token, "jwt-secret-key");
    const userEmail = decoded.Email;

    //console.log({ userEmail});
    return res.json({ userEmail })
})

app.post("/api/thread/like", (req, res) => {
    const { threadId, email } = req.body;

    const result = threadList.filter((thread) => thread.id === threadId);

    const threadLikes = result[0].likes;

    const authenticateReaction = threadLikes.filter((user) => user === email);

    if (authenticateReaction.length === 0) {
        threadLikes.push(email);
        return res.json({
            message: "You've reacted to the post!",
        });
    }
    res.json({
        error_message: "You can only react once!",
    });
});

app.post("/api/thread/replies", (req, res) => {
    const { id } = req.body;

    const result = threadList.filter((thread) => thread.id === id);

    res.json({
        replies: result[0].replies,
        title: result[0].title,
    });
});

app.get("/api/create/reply", async (req, res) => {
    const token = req.cookies.token
    const decoded = jwt.verify(token, "jwt-secret-key");
    const userEmail = decoded.Email;
    const user = await UserModel.findOne({ Email: userEmail });
    const name = user.Name;
    return res.json({ name })
})

app.post("/api/create/reply", async (req, res) => {
    const { id, email, reply } = req.body;

    const result = threadList.filter((thread) => thread.id === id);

    // const user = users.filter((user) => user.id === email);

    result[0].replies.unshift({
        email: email,
        // name: user[0].username,
        text: reply,
    });

    res.json({
        message: "Response added successfully!",
    });
});

const generateID = () => Math.random().toString(36).substring(2, 10);

app.get("/api/create/thread", verifyUser, async (req, res) => {
    const token = req.cookies.token
    const decoded = jwt.verify(token, "jwt-secret-key");
    const userEmail = decoded.Email;

    const user = await UserModel.findOne({ Email: userEmail });
    const name = user.Name;

    console.log({ name });
    return res.json({ name })
});

const threadList = [];

app.post("/api/create/thread", async (req, res) => {
    const { thread, email } = req.body;
    const threadId = generateID();

    threadList.unshift({
        id: threadId,
        title: thread,
        email,
        replies: [],
        likes: [],
    });

    res.json({
        message: "Thread created successfully!",
        threads: threadList,
    });
    //console.log({ thread, email, threadId });
});

app.get("/api/all/threads", (req, res) => {
    res.json({
        threads: threadList,
    });
});

//Complete Profile
app.post('/complete', upload.single('ProfilePicture'), async (req, res) => {
    try {
        //getting email from token
        const token = req.cookies.token
        const decoded = jwt.verify(token, "jwt-secret-key");
        const userEmail = decoded.Email;

        const ProfilePicture = req.file ? req.file.filename : null;

        const { Skip, DOB, selectedPreferences } = req.body;
        // console.log(userEmail, selectedPreferences, DOB, ProfilePicture);
        if (userEmail) {
            const update = await UserModel.findOneAndUpdate(
                { Email: userEmail },
                {
                    $set: {
                        DOB: DOB,
                        Preferences: selectedPreferences,
                        ProfilePicture: ProfilePicture,
                        Skip: Skip
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
app.post("/chat", upload.single('file'), async (req, res) => {
    try {
        let prompt = null;
        if (req.file) {
            const filePath = req.file.path.replaceAll('\\', '/');
            const mimeType = req.file.mimetype;
            const fileName = path.basename(filePath);

            if (mimeType.startsWith('image/')) {
                console.log("Uploaded file is an image")
                const imageData = fs.readFileSync(filePath);

                // Create form data
                var data = new FormData();
                data.append('image', imageData, { filename: req.file.originalname });

                const imgurClientId = '623bf1b7676bcd5';
                const imgurResponse = await axios.post('https://api.imgur.com/3/image', data, {
                    headers: {
                        ...data.getHeaders(),
                        Authorization: `Client-ID ${imgurClientId}`
                    }
                });

                const imgUrl = imgurResponse.data.data.link;
                console.log(imgUrl)
                console.log("Start image analysis")

                const client2 = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
                console.log("Start 2 image analysis")
                const result = await client2.getChatCompletions(visionDeploymentName, [
                    { role: "system", content: "You are a helpful assistant. Identify the location of the place the image is taken in" },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Desrcibe the image and identify the location:" },
                            { type: "image_url", image_url: { url: imgUrl } }
                        ]
                    }
                ],
                    {
                        temperature: 1,
                        max_tokens: 256,
                        top_p: 1
                    });

                for (const choice of result.choices) {
                    res.send(choice.message.content);
                }
            }

            else if (mimeType.startsWith('audio/')) {
                console.log("Uploaded file is an audio");
                const fileP = `./uploads/audios/${fileName}`;
                console.log("== Transcribe Audio Sample ==");
                const client1 = new OpenAIClient(whisperEndpoint, new AzureKeyCredential(whisperAzureApiKey));
                const audio = await readFile(fileP);
                const result1 = await client1.getAudioTranscription(whisperDeploymentName, audio);
                console.log(result1.text)
                // res.send(result1.text);
                prompt = result1.text;
            }
        }

        if (req.body && req.body.prompt) {
            prompt = req.body.prompt;
            console.log("body and prompt")
        }

        if (prompt) {
            console.log("chat completions")
            // Here you can handle text messages
            //Chat Completions
            const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
            const jsonFile = "./prompts.json"
            const fileData = await readFile(jsonFile, 'utf8');
            const prompts = JSON.parse(fileData);
            prompts[prompts.length - 1]['content'] = prompt;

            const result = await client.getChatCompletions(deploymentName, prompts,
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
    }
    catch (err) {
        res.status(500).send(err)
    }
})

const port = process.env.port || 3001

app.listen(port, () => {
    console.log("Server is Running")
})
