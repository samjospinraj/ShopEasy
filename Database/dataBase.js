require('dotenv').config();
const mongoose = require('mongoose');

if(!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
}

const connect = mongoose.connect(process.env.MONGODB_URI);

connect.then( () => {
    console.log(`Database connected successfull`);
}) .catch( (err) => {
    console.error(err);
    process.exit(1);
})

module.exports = mongoose;