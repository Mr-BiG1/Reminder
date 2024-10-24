require('dotenv').config();
const express = require('express');
const routes = express.Router();
const twilio = require('twilio');
const cron = require('node-cron');
const ReminderSchema = require('../models/message');
const ExpenseSchema = require('../models/expense');
const userSchema = require('../models/users');
const moment = require('moment');
const { body, validationResult } = require('express-validator');
const {
    getIndex,
    setReminder,
    getEvents,
    getEventById,
    deleteEvent,
    updateEventData,
    loginRender,
    searchEvent,
    expenseKeeper,
    addExpense,
    setMonthlyExpenseLimit,
    updateExpense,
    deleteEventExpense,
    registerRender,
    updateRegister,
    postLogin,
    logout 
} = require('../controllers/routerControllers');
const users = require('../models/users');

// Middleware to check if user is authenticated
const isAuth = (req, res, next) => {
    if (req.session.isAuth) {
        next();
    } else {
        res.redirect('/user/login');
    }
};

// Middleware to check if user is already logged    
const isGuest = (req, res, next) => {
    if (req.session.isAuth) {
        res.redirect('/'); 
    } else {
        next();
    }
};

// Main route
routes.get('/', isAuth, getIndex);

// Set Reminder with validation
routes.post('/set-reminder',
    isAuth,
    [
        body('email').isEmail().withMessage('Must be a valid email'),
        body('reminderTime').isISO8601().toDate().withMessage('Must be a valid date'),
        body('title').notEmpty().withMessage('Title is required'),
        body('description').optional().isString(),
    ],
    setReminder
);

// Schedule page to view all events
routes.get('/schedule', isAuth, getEvents);

// Get event by ID
routes.get('/events/:id', isAuth, getEventById);

// Delete event by ID
routes.get('/delete/:id', isAuth, deleteEvent);

// Update event details
routes.post('/update/:id', isAuth, updateEventData);

// Search event
routes.post('/search', isAuth, searchEvent);

// Expense keeper
routes.get('/expense-keeper', isAuth, expenseKeeper);

// Add Expense
routes.get('/reminderv1/new/expense/', isAuth, addExpense);

// Set monthly expense limit
routes.post('/reminderv1/new/expense/', isAuth, setMonthlyExpenseLimit);

// Update expense 
routes.post('/update/expense/:id', isAuth, updateExpense);

// Delete expense 
routes.get('/delete/expense/:id', isAuth, deleteEventExpense);

// Login route 
routes.get('/user/login', isGuest, loginRender);
routes.post('/user/login', postLogin);

// User registration 
routes.get('/user/register', isGuest, registerRender);
routes.post('/user/register', updateRegister);

// User logout
routes.get('/user/logout', isAuth,logout );
// Background job to check for reminders
cron.schedule('* * * * *', async () => {
    try {
        await CheckExpense();
        const now = new Date();
        const events = await ReminderSchema.find({
            reminderTime: { $lte: now },
            sent: false
        });

        events.forEach(async (event) => {
            const formattedTime = moment(event.reminderTime).format('LLLL');
            await send_sms(`You have a reminder for event: ${event.title} at ${formattedTime}`);

            event.sent = true;
            await event.save();
        });
    } catch (error) {
        console.error('Error during cron job:', error);
    }
});

// SMS sending function
const send_sms = async (message) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        const client = new twilio(accountSid, authToken);
        
        // Replace 'whatsapp:add from whatsapp number' with your own WhatsApp number or u can add number on the env file.
        await client.messages.create({
            body: message,
            from: 'whatsapp:add from whatsapp number',
            to: 'whatsapp:add to whatsapp number '
        });

        console.log('SMS sent:', message);
    } catch (error) {
        console.log('Error sending SMS:', error);
    }
};

// Check expense limits
const CheckExpense = async () => {
    try {
        // Fetch all expenses
        const expenseData = await ExpenseSchema.find().populate('user'); 

        if (expenseData.length > 0) {
            // Iterate through each expense
            expenseData.forEach(expenses => {
                // Check if the current spent exceeds the maximum allowed amount
                if (expenses.maximumAmount <= expenses.currentSpent) {
                    // Ensure that the user's data is available
                    if (expenses.user && expenses.user.name) {
                        // Send an SMS with the user's name and expense details
                        send_sms(`Dear ${expenses.user.name}, your limit for ${expenses.title} is out of limit. Your current expense is ${expenses.currentSpent}, and your limit is ${expenses.maximumAmount}.`);
                    } else {
                        console.log(`User not found for expense: ${expenses._id}`);
                    }
                }
            });
        } else {
            console.log(`No expense data found.`);
        }
    } catch (error) {
        console.error('Error during expense check:', error);
    }
};

module.exports = routes;

