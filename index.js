const express = require("express")
const mongoose = require('mongoose')
const cors = require("cors")
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
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
const WebSocket = require('ws');
const moment = require('moment');

//Models
const UserModel = require('./models/Users')
const EventModel = require('./models/Events')
const CommentsModel = require("./models/Comments")
const ThreadModal = require("./models/Threads")
dotenv.config()

const wss = new WebSocket.Server({ port: 3002 }); // Choose a suitable port

//Environment Variables
const endpoint = process.env["ENDPOINT"] || "<endpoint>";
const azureApiKey = process.env["AZURE_API_KEY"] || "<api_key>";
const deploymentName = process.env["DEPLOYMENT_NAME"] || "<deployment_name";
const whisperEndpoint = process.env["WHIPER_ENDPOINT"] || "<whisper_endpoint>";
const whisperAzureApiKey = process.env["WHISPER_API_KEY"] || "<whisper_api_key>";
const whisperDeploymentName = process.env["WHISPER_DEPLOYMENT_NAME"] || "<whisper_deployment_name";
const visionDeploymentName = process.env["VISION_DEPLOYMENT_NAME"] || "<vision_deployment_name";
// const db = process.env["MODB"] 

// const app = express()
// app.use(express.json())
// const dev = process.env["NODE_ENV"] 
// const VITE_ORIGIN = process.env["VITE_ORIGIN"] 
// const LOCAL_ORIGIN = process.env["LOCAL_ORIGIN"] 
// const origin = dev === "production" ? VITE_ORIGIN : LOCAL_ORIGIN
// console.log(dev, VITE_ORIGIN, LOCAL_ORIGIN, origin)

// app.use(cors({
//     origin: [origin],
//     methods: ["GET", "POST"],
//     credentials: true
// }))
// app.use(cookieParser())
// app.use(bodyParser.json());

// console.log(db)
// mongoose.connect(db);

const app = express()
app.use(express.json())
app.use(cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
}))
app.use(cookieParser())
app.use(bodyParser.json());

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
const picstorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const destPath = path.join(__dirname, 'ProfilePictures');
        fs.mkdirSync(destPath, { recursive: true });
        cb(null, destPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const uploadPic = multer({ storage: picstorage });

app.use('/ProfilePictures', express.static('ProfilePictures'));
const verifyUser = (req, res, next) => {
    const token = req.cookies.token;
    //console.log("this is token:", token)
    if (!token || token === "undefined") {
        return res.status(401).json("Token is missing");
    } else {
        jwt.verify(token, "jwt-secret-key", (err, decoded) => {
            if (err) {
                console.error("Error with token verification:", err);
                return res.status(401).json("Error with token");
            } else {
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

const setCategory = async(eventName, eventDescription) => {

    const categories = [ "Arts & Culture", "Community", "Entertainment", "Education", "Sports", "Leisure", "Tourism", "Professional", "Business", "Health", "Fitness", "Food", "Environmental", "Outdoor", "Special Events", "Other"
    ];
    
    const prompt = [
        {
            role: "system",
            content: `You are a knowledgeable assistant. Given the event name and, if available, a brief description, choose the most appropriate category from this list: ${categories.join(", ")}. If the description is insufficient or not provided, categorize as "Other". Respond with only the category name.`
        },
        {
            role: "user",
            content: `Event Name: ${eventName}${eventDescription ? "\nDescription: " + eventDescription : ""}`
        }
    ];

    try {
        const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
        const result = await client.getChatCompletions(deploymentName, prompt, { maxTokens: 60 });
        for (const choice of result.choices) {
            return choice.message.content;
        }
    } catch (err) {
        console.error("Error in getting completions:", err);
    }
}

const updateEvents = (scrapedEvents) => {
    console.log(`Total Events: ${scrapedEvents.length}`)
    scrapedEvents.forEach(async e => {
        let dates = e.date.split(' - ');
        let startDate = moment(dates[0], "DD MMMM YYYY").toDate(); // Parse the start date
        startDate.setDate(startDate.getDate() + 1);
        let eD = dates.length > 1 ? moment(dates[1], "DD MMMM YYYY").toDate() : null;
        let endDate;
        if (eD != null) {
            eD.setDate(eD.getDate() + 1);
            endDate = eD.getTime() === startDate.getTime() ? null : eD;// Parse the end date if it exists

        }
        else {
            endDate = null
        }

        // Construct the event object
        let event = {
            title: e.name,
            startDate: startDate,
            endDate: endDate,
            time: e.time,
            location: e.location,
            category: e.category == "Other"? await setCategory(e.name, e.description):e.category,
            description: e.description,
            image: e.image
        };

        await EventModel.findOneAndUpdate(
            { title: e.name }, // Check if the event exists based on the name
            event, // If it exist, update it with the new event object
            { upsert: true, new: true }) // Insert a new event if it doesn't exist
            .then(() => {
                console.log(`Event ${e.name} updated/added successfully`);
            })
            .catch(error => {
                console.error(`Error updating/adding event: ${error}`);
            });
    })
}

const getCurrentWeekandTime = () => {
    const today = new Date();
    const todayDate = today.toDateString()
    const currentDayOfWeek = today.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday

    // Calculate the start date (Sunday) of the current week
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - currentDayOfWeek);

    // Calculate the end date (Saturday) of the current week
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - currentDayOfWeek));

    const startD = startDate.toDateString(); // Get the date portion
    const endD = endDate.toDateString();

    const currentTime = today.toLocaleTimeString()

    return { startD, endD, currentTime, todayDate };
}

app.get('/user/preferences/', (req, res) => {
    const token = req.cookies.token;

    // Check if token is available
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, "jwt-secret-key");
        const userEmail = decoded.Email;

        UserModel.findOne({ Email: userEmail }, 'Preferences')
            .then((result) => {
                if (result) {
                    res.send(result);
                } else {
                    res.status(404).send({ message: "User not found" });
                }
            })
            .catch((err) => {
                console.error("Error fetching user preferences:", err);
                res.status(500).send({ message: "Internal server error" });
            });
    } catch (error) {
        // Handle token verification error
        console.error("Error decoding token:", error);
        res.status(401).send({ message: "Unauthorized" });
    }
});


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
    CommentsModel.find().then((result) => {
        res.send(result);
    }).catch((err) => {
        res.send(err)
    })
})

app.post('/comments', async (req, res) => {
    try {
        const { eventID, newComment, email } = req.body;
        // console.log(eventID)
        //const event = await CommentsModel.findById(eventId);
        //console.log(event)
        // console.log(email)
        // console.log(newComment)


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
        })
            .catch(error => {
                console.error('Error adding comment:', error);
            });

    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})
//Register
app.post('/Register', (req, res) => {
    const { Name, Email, Password } = req.body;
    UserModel.findOne({ Email: Email })
    .then(user => {
        if (user) {
            var err = "User with this account exists, please register with a different email or login instead.";
            res.json(err);
        }})
    bcrypt.hash(Password, 10)
        .then(hash => {
            UserModel.create({ Name: Name, Email: Email, Password: hash, Skip: 'false' })
                .then(user => res.json("Success"))
                .catch(err => res.json(err))
        }).catch(err => res.json(err))
})
// Profile

app.get('/profile', verifyUser, (req, res) => {
    const token = req.cookies.token
    const decoded = jwt.verify(token, "jwt-secret-key");
    const userEmail = decoded.Email;
    var ProfilePicture;
    var DOB;
    var preferences;
    var username;
    UserModel.findOne({ Email: userEmail })
        .then(user => {
            if (user) {
                ProfilePicture = user.ProfilePicture;
                DOB = user.DOB;
                preferences = user.Preferences;
                username = user.Name
                res.json({ username: username, preferences: preferences, DOB: DOB, ProfilePicture: ProfilePicture, Email: userEmail });
            }
        }).catch(err => {
            console.error("Error fetching profile:", err);
            res.status(500).json(err);
        });
})

app.post('/profile', uploadPic.single('ProfilePicture'), async (req, res) => {
    try {
        //getting email from token
        const token = req.cookies.token
        const decoded = jwt.verify(token, "jwt-secret-key");
        const userEmail = decoded.Email;

        const ProfilePicture = req.file ? req.file.filename : null;

        const { Name, DOB, selectedPreferences } = req.body;
        //  console.log(userEmail, selectedPreferences, DOB, ProfilePicture,Name);
        if (userEmail) {
            const update = await UserModel.findOneAndUpdate(
                { Email: userEmail },
                {
                    $set: {
                        DOB: DOB,
                        Preferences: selectedPreferences,
                        ProfilePicture: "http://localhost:3001/ProfilePictures/" + ProfilePicture,
                        Name: Name
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

//Skip
app.post('/skip', async (req, res) => {
    const token = req.cookies.token
    const decoded = jwt.verify(token, "jwt-secret-key");
    const userEmail = decoded.Email;
    const { skip } = req.body;
    if (userEmail) {
        const update = await UserModel.findOneAndUpdate(
            { Email: userEmail },
            {
                $set: {
                    Skip: skip
                },
            },
            { new: true, useFindAndModify: false }
        );
        if (!update) {
            return res.status(404).json({ error: 'User not found' });
        }
    }
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

app.post("/api/thread/like", async (req, res) => {
    const { threadId, email } = req.body;
    console.log(threadId)
    try {
        const thread = await ThreadModal.findOne({ id: threadId });
        console.log(thread)
        if (!thread) {
            return res.status(404).json({ error_message: "Thread not found" });
        }  
        const threadLikes = thread.likes;
        const liked = thread.likes.some((like) => like.email === email);
        //const liked = threadLikes.includes(email);
        console.log(threadLikes)
        console.log(liked)
        if (!liked) {
            thread.likes.unshift({
                email: email,
            });
            await thread.save();
            return res.json({ message: "You've reacted to the post!" });
        }
        res.json({ error_message: "You can only react once!" });
    } catch (error) {
        console.error("Error liking thread:", error);
        res.status(500).json({ error_message: "Internal server error" });
    }
});

app.post("/api/thread/replies", async(req, res) => {
    const { id } = req.body;
    try {
        // Find the thread by its ID
        const thread = await ThreadModal.findOne({ id });
        if (!thread) {
            return res.status(404).json({ message: "Thread not found" });
        }
        res.json({
            replies: thread.replies,
            title: thread.title,
        });
    } catch (error) {
        console.error("Error fetching thread replies:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/api/create/reply", async (req, res) => {
    const token = req.cookies.token
    const decoded = jwt.verify(token, "jwt-secret-key");
    const userEmail = decoded.Email;

    return res.json({ userEmail })
})

app.post("/api/create/reply", async (req, res) => {
    const { id, email, reply } = req.body;
    let name = ""
    console.log(email)
    try {
        const thread = await ThreadModal.findOne({ id });
        if (!thread) {
            return res.status(404).json({ message: "Thread not found" });
        }
        const user = await UserModel.findOne({ Email: email });
        console.log(user.Name)
        if(user.Name == null){
            name = email
        }else{
            name = user.Name
        }
        
        thread.replies.unshift({
            email: email,
            text: reply,
            name: user.Name,
        });
        await thread.save();
        res.json({
            message: "Response added successfully!",
            thread: thread 
        });
    } catch (error) {
        console.error("Error adding reply:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

const generateID = () => Math.random().toString(36).substring(2, 10);

app.get("/api/create/thread", verifyUser, async (req, res) => {
    const token = req.cookies.token
    const decoded = jwt.verify(token, "jwt-secret-key");
    const userEmail = decoded.Email;

    const user = await UserModel.findOne({ Email: userEmail });
    const name = user.Name;

    return res.json({ name })
});

const threadList = [];

app.post("/api/create/thread", async (req, res) => {
    const { thread, description, email } = req.body;
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const formattedDate = `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
    try {
        const newThread = await ThreadModal.create({
            id:generateID(),
            title: thread,
            email: email,
            date: formattedDate,
            description: description,
            replies: [],
            likes: [],
        });

        const threads = await ThreadModal.find();

        res.json({
            message: "Thread created successfully!",
            threads: threads, // Return all threads
        });
    } catch (error) {
        console.error("Error creating thread:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/all/threads", async (req, res) => {
    const threads = await ThreadModal.find();
    res.json({
        threads: threads,
    });
});

//Complete Profile
app.post('/complete', uploadPic.single('ProfilePicture'), async (req, res) => {
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
        CommentsModel.find({ Eventid: eventId }).then((result) => {

            //console.log("this is result of comments", result)
            res.send(result);
        }).catch((err) => {
            res.send(err)
        })

    } catch (err) {
        console.error(err.message);

    }
});

//Get events based on category
app.get('/:category', (req, res) => {
    const category = req.params.category;
    try {
        EventModel.find({ category: category }).then((result) => {
            res.json(result);
        }).catch((err) => {
            res.send(err)
        })
    } catch (err) {
        console.error(err.message);

    }
    // const filteredEvents = events.filter(event => event.category === category);
    // res.json(filteredEvents);
});

app.get('/events/this-week/:dateRange', async (req, res) => {
    const dateRange = req.params.dateRange.split(' - '); // Split date range into start and end dates
    const startDate = new Date(dateRange[0]);
    const endDate = new Date(dateRange[1]);

    try {
        const filteredEvents = await EventModel.find({
            $or: [
                { startDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
                { endDate: { $gte: new Date(startDate), $lte: new Date(endDate) } }
            ]
        });

        res.json(filteredEvents);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Internal Server Error');
    }
});

const sendMessage = (ws, message) => {
    try {
        ws.send(JSON.stringify(message));
    } catch (error) {
        console.error('Error sending message:', error);
    }
};

//Chatbot
wss.on('connection', async (ws) => {
    // Handle incoming messages from the client
    ws.on('message', async (message) => {
        let prompt = null;
        const eventsList = await EventModel.find({});

        const { startD: sDate, endD: eDate, currentTime: cTime, todayDate: todayD } = getCurrentWeekandTime();

        const promptEngineering = `The current date and time is ${todayD} ${cTime}. The date range for the current week starts from ${sDate} and ends at ${eDate}. In addition, this is the list of events happening in Qatar: ${eventsList}. Based on this list, answer my question if it is related to events. `;

        // Handle the message (if needed)
        let mess;
        try {
            mess = JSON.parse(message);

        } catch (error) {
            console.error('Error parsing message:', error);
            return;
        }

        //Check the type of the file
        if (mess.type === 'file') {
            // Here you have the file's content in Base64, its mimeType, and fileName
            const { mimeType, content, fileName } = mess;
            const extension = fileName.match(/\.([^.]+)$/)[1];
            const folder = mimeType.startsWith('image/') ? 'uploads/images'
                : mimeType.startsWith('audio/') ? 'uploads/audios'
                    : 'others';
            const fileName1 = `file-${Date.now()}.${extension}`;
            const filePath = path.join(__dirname, folder, fileName1);

            // Ensure directory exists
            const directory = path.dirname(filePath);
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }

            //Check if the file content is not empty
            if (content && content.trim() !== '') {
                // Write the content to the file
                fs.writeFileSync(filePath, content, 'base64', (err) => {
                    if (err) {
                        console.error('Error writing file:', err);
                    } else {
                        console.log('File saved successfully:', filePath);
                    }
                });
            } else {
                console.error('Invalid or empty file content');
            }

            //If the file is of the type image:
            if (mimeType.startsWith('image/')) {
                console.log("Uploaded file is an image")
                const imageData = fs.readFileSync(filePath);

                // Upload the image to imgur
                var data = new FormData();
                data.append('image', imageData, { filename: fileName1 });

                const imgurClientId = '1cdfeb66ec6c452';
                const imgurResponse = await axios.post('https://api.imgur.com/3/image', data, {
                    headers: {
                        ...data.getHeaders(),
                        Authorization: `Client-ID ${imgurClientId}`
                    }
                });

                const imgUrl = imgurResponse.data.data.link;
                console.log(imgUrl)

                //Vision API Call
                console.log("Start image analysis")

                const client2 = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
                const result = await client2.streamChatCompletions(visionDeploymentName, [
                    { role: "system", content: promptEngineering + "You are a helpful assistant. Identify the location of the place the image is taken in and if any, do suggest events taking place near this place" },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Identify the location in a concise manner. Mention any important landmarks visible in the image and if any events occuring nearby, do suggest:" },
                            { type: "image_url", image_url: { url: imgUrl } }
                        ]
                    }
                ],
                    {
                        temperature: 1,
                        max_tokens: 256,
                        top_p: 1
                    });

                for await (const res of result) {
                    for (const choice of res.choices) {
                        if (choice.delta && choice.delta.content) {
                            ws.send(choice.delta.content);
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                }

                const endOfConversationMessage = { type: 'endConversation' };
                sendMessage(ws, endOfConversationMessage);
            }

            //If the file content is audio:
            else if (mimeType.startsWith('audio/')) {
                console.log("Uploaded file is an audio");
                const fileP = `./uploads/audios/${fileName1}`;
                console.log("== Transcribe Audio Sample ==");
                const client1 = new OpenAIClient(whisperEndpoint, new AzureKeyCredential(whisperAzureApiKey));
                const audio = await readFile(fileP);
                const result1 = await client1.getAudioTranscription(whisperDeploymentName, audio);
                // res.send(result1.text);
                prompt = result1.text;

            }

        } else {
            prompt = mess['content'];
        }

        try {
            if (mess.mimeType?.startsWith('audio/') || mess.type === 'text') {
                //Read prompts from the JSON file and append them
                const jsonFile = "./prompts.json";
                const fileData = await readFile(jsonFile, 'utf8');
                const prompts = JSON.parse(fileData);

                prompts[0]["content"] += promptEngineering
                prompts[prompts.length - 1]['content'] = prompt;

                // Stream chat completions using the combined prompts
                const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
                const events = await client.streamChatCompletions(deploymentName, prompts);
                for await (const event of events) {
                    for (const choice of event.choices) {
                        if (choice.delta && choice.delta.content) {
                            ws.send(choice.delta.content);
                            await new Promise(resolve => setTimeout(resolve, 100)); // 500 ms delay
                        }
                    }
                }

                const endOfConversationMessage = { type: 'endConversation' };
                sendMessage(ws, endOfConversationMessage);
            }
        } catch (error) {
            console.error('Error occurred while streaming chat completions:', error);
            // Handle errors and send an appropriate response
            ws.send(JSON.stringify({ error: 'Internal Server Error' }));
        }
    });
});

const port = process.env.port || 3001

app.listen(port, () => {
    console.log("Server is Running")
})

// app.listen(port, async() => {
//     const data = await readFile(jsonFilePath, 'utf8');
//         const scrapedEvents = JSON.parse(data);
//         // Assuming updateEvents is an async function
//         updateEvents(scrapedEvents);
//     console.log("Server is Running")
// })
