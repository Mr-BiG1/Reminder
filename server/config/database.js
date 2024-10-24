require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        mongoose.set('strictQuery', false);
        
        const conn = await mongoose.connect(process.env.MongoBD_Url);
        console.log(`Database connected: ${conn.connection.host}`);
    } catch (error) {
        console.log(error);
        throw error; // re-throw the error to avoid uncaught promise rejection
    }
}

module.exports = connectDB;