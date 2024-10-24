require('dotenv').config();
const ReminderSchema = require('../models/message');
const ExpenseSchema = require('../models/expense');
const UserSchema = require('../models/users');
const mongoose = require('mongoose');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

// Middleware to check if the user is authenticated
const isAuth = (req, res, next) => {
    if (req.session.isAuth) {
        next();
    } else {
        res.redirect('/user/login');
    }
};

// Render the index page
const getIndex = (req, res) => {
    res.render('index');
};

// Set a reminder (protected route)
const setReminder = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, reminderTime, title, description } = req.body;
        const now = new Date();

        const reminder = new ReminderSchema({
            title,
            description,
            startTime: now,
            reminderTime: new Date(reminderTime),
            email,
            sent: false
        });

        await reminder.save();
        res.redirect('/schedule');
    } catch (error) {
        console.error('Error setting reminder:', error);
        res.status(500).json({ message: 'Error setting reminder' });
    }
};

// Get all events for the schedule page (protected route)
const getEvents = async (req, res) => {
    try {
        const data = await ReminderSchema.find();
        res.render('schedule', {
            data: data.map(item => ({
                ...item.toObject(),
                startTime: moment(item.startTime).format('YYYY-MM-DD hh:mm A'),
                reminderTime: moment(item.reminderTime).format('YYYY-MM-DD hh:mm A')
            }))
        });
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ message: 'Error fetching schedule' });
    }
};

// Get event by ID (protected route)
const getEventById = async (req, res) => {
    try {
        const id = req.params.id;
        const event = await ReminderSchema.findById(id);
        if (!event) {
            return res.status(404).send('Event not found!');
        }

        const formattedEvent = {
            ...event.toObject(),
            startTime: moment(event.startTime).format('YYYY-MM-DD hh:mm A'),
            reminderTime: moment(event.reminderTime).format('YYYY-MM-DD hh:mm A')
        };
        res.render('event', { data: formattedEvent });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ message: 'Error fetching event' });
    }
};

// Delete a single reminder by ID (protected route)
const deleteEvent = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid event ID' });
    }

    await ReminderSchema.findByIdAndDelete(id);
    res.redirect('/schedule');
};

// Render the update event page (protected route)
const updateEvent = async (req, res) => {
    try {
        const id = req.params.id;
        const event = await ReminderSchema.findById(id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.render('update', { data: event });
    } catch (error) {
        console.error('Error fetching event for update:', error);
        res.status(500).json({ message: 'Error fetching event for update' });
    }
};

// Update event data (protected route)
const updateEventData = async (req, res) => {
    try {
        const id = req.params.id;
        const { email, reminderTime, title, description } = req.body;

        const event = await ReminderSchema.findById(id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Update event fields
        event.email = email;
        event.reminderTime = new Date(reminderTime);
        event.title = title;
        event.description = description;

        await event.save();
        res.redirect(`/events/${id}`);
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ message: 'Error updating event' });
    }
};

// Search for events (protected route)
const searchEvent = async (req, res) => {
    try {
        const searchTerm = req.body.searchTerm;
        const regex = new RegExp(searchTerm, "i");

        const data = await ReminderSchema.find({
            $or: [
                { title: regex },
                { description: regex }
            ]
        });

        let error = null;
        if (data.length === 0) {
            error = { error: "No events found for the search term." };
        }

        res.render('search', { data, error });
    } catch (error) {
        console.error('Error searching events:', error);
        res.status(500).json({ message: 'Error searching events' });
    }
};

// Expense keeper (protected route)
const expenseKeeper = async (req, res) => {
    try {
        const userId = req.session.user._id; 
        const data = await ExpenseSchema.find({ user: userId });

        let percentageArray = [];
        data.forEach(expense => {
            let percentage = 0;

            if (expense.currentSpent && expense.maximumAmount) {
                percentage = (expense.currentSpent / expense.maximumAmount) * 100;
            }

            percentageArray.push({
                ...expense._doc,
                percentage: percentage.toFixed(2)
            });
        });

        res.render('expense', { data: percentageArray });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ message: 'Error fetching expenses' });
    }
};

// Add expense (protected route)
const addExpense = async (req, res) => {
    res.render('modifyexpense');
};

// Set monthly expense limit (protected route)
const setMonthlyExpenseLimit = async (req, res) => {
    try {
        const { monthlyExpenseLimit, title } = req.body;
        const userId = req.session.user._id; 

        let currentSpent = 0;
        const expense = new ExpenseSchema({
            title,
            maximumAmount: monthlyExpenseLimit,
            currentSpent,
            user: userId // Attach the user ID to the expense
        });

        await expense.save();
        res.redirect('/expense-keeper');
    } catch (error) {
        console.error('Error setting monthly expense limit:', error);
        res.status(500).json({ message: 'Error setting monthly expense limit' });
    }
};

// Update expense (protected route)
const updateExpense = async (req, res) => {
    try {
        const id = req.params.id;
        const { currentSpent } = req.body;

        if (!id || currentSpent === undefined) {
            return res.status(400).json({ message: 'ID or currentSpent is missing' });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid Expense ID' });
        }

        const existingExpense = await ExpenseSchema.findById(id);
        if (!existingExpense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        // Update the document
        existingExpense.currentSpent = currentSpent;
        await existingExpense.save();

        res.redirect('/expense-keeper');
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ message: 'Error updating expense' });
    }
};

// Delete expense (protected route)
const deleteEventExpense = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid expense ID' });
    }

    await ExpenseSchema.findByIdAndDelete(id);
    res.redirect('/expense-keeper');
};

// Login route
const loginRender = async (req, res) => {
    res.render('login');
};

// Register route
const registerRender = async (req, res) => {
    res.render('register');
};

// Post Register
const updateRegister = async (req, res) => {
    const { email, name, password } = req.body;

    let user = await UserSchema.findOne({ email });

    if (user) {
        return res.render('register', { error: 'Email is already registered!' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    user = new UserSchema({
        name,
        email,
        password: hashedPassword
    });

    await user.save();
    res.redirect('/user/login');
};

// Post Login
const postLogin = async (req, res) => {
    const { email, password } = req.body;

    const user = await UserSchema.findOne({ email });

    if (!user) {
        return res.render('login', { error: 'Invalid email or password!' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        return res.render('login', { error: 'Invalid email or password!' });
    }

    req.session.isAuth = true;
    req.session.user = { _id: user._id, name: user.name, email: user.email };
    res.redirect('/');
};

// Logout route
const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        res.redirect('/user/login');
    });
};

// SMS sending function
const send_sms = async (message) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        const client = require('twilio')(accountSid, authToken);

        await client.messages.create({
            body: message,
            from: 'whatsapp:+14155238886',
            to: 'whatsapp:+13828853022'
        });

        console.log('SMS sent:', message);
    } catch (error) {
        console.error('Error sending SMS:', error);
    }
};

// Check Expense function (check limits and send SMS)
const CheckExpense = async () => {
    try {
        const expenseData = await ExpenseSchema.find().populate('user');

        if (expenseData.length > 0) {
            expenseData.forEach(expense => {
                if (expense.maximumAmount <= expense.currentSpent) {
                    if (expense.user) {
                        send_sms(`Dear ${expense.user.name}, your limit for ${expense.title} is out of limit. Your current expense is $${expense.currentSpent}, and your limit is $${expense.maximumAmount}.`);
                    } else {
                        console.error(`User not found for expense: ${expense._id}`);
                    }
                }
            });
        } else {
            console.log('No expense data found.');
        }
    } catch (error) {
        console.error('Error during expense check:', error);
    }
};

module.exports = {
    getIndex,
    setReminder,
    getEvents,
    getEventById,
    deleteEvent,
    updateEvent,
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
    logout,
    CheckExpense
};
