const express = require('express');
const expressLayout = require('express-ejs-layouts');
const connectDB = require('./server/config/database');
const session = require('express-session');
const MongoDBSession = require('connect-mongodb-session')(session);
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const PORT = 8080;

// Add db connection 
connectDB();

// Create a session store with MongoDB
const store = new MongoDBSession({
    uri: process.env.MongoBD_Url, 
    collection: 'mySessions'
});

const app = express();

// Set up session middleware
app.use(session({
    secret: 'your_secret_key', 
    resave: false,
    saveUninitialized: false,
    store: store, 
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, 
        secure: false 
    }
}));

app.use(expressLayout);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('layout', './layouts/main');
app.use(express.static('public'));

// Middleware to pass user information to views
app.use((req, res, next) => {
    if (req.session.isAuth) {
        res.locals.user = req.session.user;
    } else {
        res.locals.user = null; 
    }
    next();
});

// Set up routes
app.use('', require('./server/routes/route'));

app.listen(PORT, () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
