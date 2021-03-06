"use strict";

require("dotenv").config();
const express = require("express"),
	  mongoose = require("mongoose"),
	  bodyParser = require("body-parser"),
	  ejs = require("ejs"),
	  passport = require("passport"),
	  passportLocalMongoose = require("passport-local-mongoose"),
	  LocalStrategy = require("passport-local"),
	  session = require("express-session"),
	  User = require("./models/user");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

mongoose.connect("mongodb://localhost:27017/AuthDB",{
	useNewUrlParser:true,
	useUnifiedTopology:true,
	useCreateIndex:true
})
.then(()=> console.log("DB connected!"))
.catch(error => console.log(error.message));

const app = express();

app.use(express.static("public"));
app.set("view engine","ejs");
app.use(bodyParser.urlencoded({extended:true}));

app.use(session({
	secret:"This is THE SECRET",
	resave:false,
	saveUninitialized:false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://demo-tknpd.run-us-west2.goorm.io/auth/google/secrets",
	userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/",function(req,res){
	res.render("home");
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });

app.get("/register",function(req,res){
	res.render("register");
});

app.get("/login",function(req,res){
	res.render("login");
});

app.get("/secrets",function(req,res){
	User.find({"secret": {$ne: null}}, function(err,foundUsers){
		if(err){
			console.log(err);
		}
		else{
			if(foundUsers){
				res.render("secrets",{usersWithSecrets:foundUsers});
			}
		}
	});
});

app.get("/submit",function(req,res){
	if(req.isAuthenticated()){
		res.render("submit");
	}
	else{
		res.redirect("/login");
	}
});

app.post("/register",function(req,res){
	
	User.register({username:req.body.username},req.body.password,function(err,user){
		if(err){
			console.log(err);
			res.redirect("/register");
		}
		else{
			passport.authenticate("local")(req, res, function(){
				res.redirect("/secrets");
			});
		}
	});
	
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/secrets",
    failureRedirect: "/login"
}) ,function(req, res){
});

app.post("/submit",function(req,res){
	const submittedSecret = req.body.secret;
	
	User.findById(req.user._id,function(err,foundUser){
		if(err){
			console.log(err);
		}
		else{
			if(foundUser){
				foundUser.secret = submittedSecret;
				foundUser.save(function(err){
					if(err){
						console.log(err);
					}
					else{
						res.redirect("/secrets");
					}
				});
			}
		}
	});
});

app.get("/logout",function(req,res){
	req.logout();
	res.redirect("/");
});

app.listen(3000,function(){
	console.log("Server started on port 3000!");
});