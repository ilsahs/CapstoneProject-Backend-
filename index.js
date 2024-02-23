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
const bodyParser = require("body-parser")
const dotenv = require("dotenv")

//const chatRoutes = require("./routes/chatRoutes")

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

app.post("/chat", async(req, res) => {
    const {prompt} = req.body
    try{
    const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
    const deploymentId = "events-hub";
    const result = await client.getChatCompletions(deploymentId, [
    {
      "role": "system",
      "content": "You are the assistant for providing information about upcoming events. Users will inquire about details such as event titles, dates, locations, and summaries. Your goal is to create informative and contextually appropriate responses.\n\n1. User Interaction:\n    - Users will initiate conversations with questions related to events.\n    - The assistant should respond in a friendly and informative manner, addressing queries about event details.\n\n2. Event Information:\n    - The dataset provided contains details about various events, including titles, dates, locations, categories, and summaries.\n\n3. Context Handling:\n    - Maintain context within the conversation to ensure coherent and relevant responses.\n    - If the user asks follow-up questions, the assistant should refer to previous responses or provide additional details.\n\n4. Output Format:\n    - The assistant should output responses in a structured format, including relevant event details such as titles, dates, and summaries.\n\nExample Queries:\n- \"Tell me about the upcoming events.\"\n- \"When is the next event taking place?\"\n- \"Give me more details about the 'Special Concert' event.\"\n\nEvaluation Criteria:\n- Responses should be accurate, informative, and contextually relevant.\n- The assistant should handle various types of queries related to event details effectively.\n"
    },
    {
      "role": "user",
      "content": "Tell me about the Qatar Airways Grand Prix of Qatar Moto GP 2023."
    },
    {
      "role": "assistant",
      "content": "The Qatar Airways Grand Prix of Qatar Moto GP 2023 is a sports event that will take place from 17 Nov to 19 Nov at the Lusail International Circuit. It's a thrilling race where top riders compete under dazzling lights for victory. You can find more information about the event [here](https://visitqatar.com/intl-en/events-calendar/motogp-qatar-airways-grand-prix-2023)"
    },
    {
      "role": "user",
      "content": "What is the World Innovation Summit for Education (WISE) 2023 about?"
    },
    {
      "role": "assistant",
      "content": "The World Innovation Summit for Education (WISE) 2023 is a business summit focused on building the future of education. It aims to engage in discussions and explore solutions to pressing educational challenges. The summit will be held from 28 Nov to 29 Nov at the Qatar National Convention Center. You can find more information [here](https://www.wise-qatar.org)"
    },
    {
      "role": "user",
      "content": "Tell me more about the Katara Traditional Dhow Festival."
    },
    {
      "role": "assistant",
      "content": "The Katara Traditional Dhow Festival is a free event held from 28 Nov to 02 Dec at Katara Beach. It's the 13th edition of the festival, where traditional dhows will be showcased. You can find more information [here](https://www.katara.net)."
    },
    {
      "role": "user",
      "content": "What is the Made in Qatar exhibition about?"
    },
    {
      "role": "assistant",
      "content": "The Made in Qatar exhibition is a free event taking place from 29 Nov to 02 Dec at the Doha Exhibition & Convention Center (DECC). It is a platform that brings together local companies and factories to support and promote Qatari products. You can find more information [here](https://www.madeinqatar.com.qa/)."
    },
    // {
    //   "role": "user",
    //   "content": "What sport events are being held?",
    // },
    {
        "role": "assistant",
        "content": prompt,
    }
    ],
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