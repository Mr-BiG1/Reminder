const mongoose  =  require('mongoose');
const Schema = mongoose.Schema;

const expenseSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    maximumAmount: {
        type: Number,
        required: true
    },
    currentSpent: {
        type: Number,
        required: true
    },
    percentage: {
        type: Number,
        required: false
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true // Ensuring every expense has a user
    }
});

module.exports = mongoose.model('Expense', expenseSchema);
