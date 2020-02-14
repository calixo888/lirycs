const express = require("express");
const mongodb = require("mongodb");
const cookieParser = require("cookie-parser");
const passwordHash = require("password-hash");

app = express();

// Configuring cookie parser with express
app.use(cookieParser())

// Setting JSON parsing methods for POST request data
app.use(express.urlencoded()); // HTML forms
app.use(express.json()); // API clients

// Setting view rendering engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use('/static', express.static(__dirname + '/static'))
app.engine('html', require('ejs').renderFile);

// Configuring MongoDB
const MongoClient = mongodb.MongoClient;
const ObjectId = mongodb.ObjectId;
const mongoUrl = process.env.MONGODB_URI || "mongodb://localhost:27017";


// Restricting login-only pages
const loginRestrictedPages = ["dashboard", "game", "store", "leaderboards", "logout"];  // List of pages that require login before proceeding
app.use((req, res, next) => {
  res.locals = {
    currentUser: req.cookies.currentUser,
  };

  // Checking if user is going to restricted page without logging in
  if (!req.cookies.currentUser && loginRestrictedPages.includes(req.originalUrl.split("/")[1])) {
    res.redirect("/login");
  }
  else {
    next();
  }
})


app.route("/login")
  .get((req, res) => {
    res.render("login.html", context={
      error: null
    });
  })

  .post((req, res) => {
    const loginData = req.body;

    MongoClient.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }, (err, client) => {
      if (err) throw err;

      const userCollection = client.db("lirycs").collection("users");

      userCollection.find({ username: loginData.username }).toArray((err, users) => {
        if (users.length == 1) {  // User exists
          const user = users[0]

          if (passwordHash.verify(loginData.password, user.password)) {
            // Setting cookie of logged in user
            res.cookie("currentUser", user);

            res.redirect("/dashboard");
          }
          else {
            res.render("login.html", context={
              error: "Invalid Password"
            });
          }
        }
        else {
          res.render("login.html", context={
            error: "Invalid Username"
          });
        }
      });
    });
  })

app.route("/register")
  .get((req, res) => {
    res.render("register.html", context={
      error: null,
    });
  })

  .post((req, res) => {
    const registerData = req.body;

    // Checking that password == password confirmation
    if (registerData.password != registerData.passwordConfirmation) {
      // Sending error and ending view
      res.render("register.html", context={
        error: "Password and password confirmation are not the same"
      });
      return;
    }

    MongoClient.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }, (err, client) => {
      if (err) throw err;

      const userCollection = client.db("lirycs").collection("users");

      // Checking if email exists
      userCollection.find({ email: registerData.email }).toArray((err, users) => {
        if (users.length > 0) {  // User with email exists
          // Sending error and ending view
          res.render("register.html", context={
            error: "Email is already taken. Please use a different one."
          });
        }
        else {
          // Checking if username exists
          userCollection.find({ username: registerData.username }).toArray((err, users) => {
            if (users.length > 0) {  // User with email exists
              // Sending error and ending view
              res.render("register.html", context={
                error: "Username is already taken. Please use a different one."
              });
            }
            else {
              // Register user
              // Passing in separate object instead of 'registerData' to get rid of 'passwordConfirmation' and to hash password in database
              user = {
                name: registerData.name,
                email: registerData.email,
                username: registerData.username,
                password: passwordHash.generate(registerData.password)  // Hashing password
              };

              userCollection.insertOne(user);

              // Setting cookie of logged in user
              res.cookie("currentUser", user);

              // Redirect to dashboard
              res.redirect("/dashboard");
            }
          });
        }
      });
    });
  })

app.get("/logout", (req, res) => {
  // Removing currentUser cookie
  res.clearCookie("currentUser");

  res.redirect("/");
});


app.get("/dashboard", (req, res) => {
  res.render("dashboard.html");
});

app.get("/leaderboards", (req, res) => {
  res.render("leaderboards.html");
});

app.route("/store")
  .get((req, res) => {
    res.render("store.html");
  });

app.route("/game")
  .get((req, res) => {
    res.render("game.html");
  });


// Setting up server for production
const devProduction = true;  // Variable to allow Vue.js redirects if testing production functionality
if (process.env.NODE_ENV == "production" || devProduction) {
  // Listing /public directory as static
  app.use(express.static(__dirname + "/public"));

  // Redirecting pages not caught by above Express calls to Vue
  app.get(/.*/, (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
  });
}


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[+] Lirycs server running on port ${port}...`);
});
