const express = require('express');
const session = require('express-session');
require('./Cron_Job/deliveryTime')
const morgan = require('morgan');
const path = require('path');
const { config } = require('dotenv');
const userRoter = require('./Router/User/userRouter');
const ProductRouter = require('./Router/User/productRouter')
const adminRoter = require('./Router/Admin/adminRouter');
const cartRouter = require('./Router/User/cartRouter');
const profileRouter = require('./Router/User/accountRouter');
const adminProfileRouter = require('./Router/Admin/profileRouter');
const OrderRouter = require('./Router/User/orderRouter');
const reviewRouter = require('./Router/User/reviewRouter');
const mongoose = require('./Database/dataBase');
const bodyParser = require('body-parser');

config();
const app = express();
const PORT = process.env.PORT;

// Session 
app.use(session({
    secret : process.env.SESSION_SECRET, // Change this to a strong secret
    resave : false,
    saveUninitialized : false,
    cookie : {
        secure: false, // Set to true if using HTTPS
        httpOnly : true,
        // maxAge : 24 * 60 * 60 * 1000 // 24 hours
    }
}));


// Engine Setup
app.set('view engine' , 'ejs' );
app.set('views' , path.resolve(__dirname , 'views'));

// Required to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use('/Uploads', express.static('Uploads'));
app.use(express.static("Views"));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Router Of User And Admin 
app.use( '/' , ProductRouter , userRoter , cartRouter , profileRouter , OrderRouter , reviewRouter );
app.use( '/Admin' , adminRoter , adminProfileRouter );

// SERVER RUN
app.listen( PORT , () => {
    console.log( `Server is run on : HTTP://LOCALHOST:${PORT}/Admin/dashboard and HTTP://LOCALHOST:${PORT}`  );
});