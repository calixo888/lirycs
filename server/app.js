const express = require("express");
const mongodb = require("mongodb");
const cookieParser = require("cookie-parser");
const passwordHash = require("password-hash");
const axios = require("axios");
const rndSong = require("rnd-song");
const nodemailer = require("nodemailer");

// Global configurations for 'rnd-song' to pull a random song
const rndOptions = {
  api_key: '4120048823986300b7c8140a18addb4f',
  language: 'en'
};

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

// Global variables
const musixMatchAPIKey = "4120048823986300b7c8140a18addb4f";

// Store Item Credit Prices
const dadJokeCreditPrice = 100;

// Global API link generators
const getLyricsLink = (trackId) => {
  return `https://api.musixmatch.com/ws/1.1/track.lyrics.get?track_id=${trackId}&apikey=${musixMatchAPIKey}`;
};


function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


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
                password: passwordHash.generate(registerData.password),  // Hashing password
                credits: 0,  // Stores number of credits the user has
                storeItems: {  // Stores all lasting items bought in store
                  dadJokes: [],  // Holds all dad jokes
                  memes: [],  // Holds the links to all memes
                },
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
  // Grabbing dad jokes for currentUser
  const currentUser = req.cookies.currentUser;

  MongoClient.connect(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    const userCollection = client.db("lirycs").collection("users");

    userCollection.find({ username: currentUser.username }).toArray((err, users) => {
      if (err) throw err;

      const user = users[0];

      const dadJokes = user.storeItems.dadJokes;
      const memes = user.storeItems.memes;

      res.render("dashboard.html", context={
        dadJokes,
        memes
      });
    });
  });
});

app.get("/leaderboards", (req, res) => {
  MongoClient.connect(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    const userCollection = client.db("lirycs").collection("users");

    userCollection.find({}).limit(10).sort({credits: -1}).toArray((err, users) => {
      users.forEach(user => user["index"] = users.indexOf(user));
      res.render("leaderboards.html", context={
        users,
      });
    });
  });
});

app.get("/leaderboards/full", (req, res) => {
  MongoClient.connect(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    const userCollection = client.db("lirycs").collection("users");

    userCollection.find({}).sort({credits: -1}).toArray((err, users) => {
      users.forEach(user => user["index"] = users.indexOf(user));
      res.render("leaderboards.html", context={
        users,
      });
    });
  });
});


// STORE ROUTES
app.get("/store", (req, res) => {
    res.render("store.html");
  });

app.route("/store/buy-dad-joke")
  .get((req, res) => {
    res.render("store/buy-dad-joke.html", context={
      dadJoke: undefined
    });
  })

  .post((req, res) => {
    axios.get("https://icanhazdadjoke.com/", {
      headers: {
        "Accept": "application/json"
      }
    }).then((response) => {
      const dadJoke = response.data.joke;

      // Adding dad joke to user's collection
      MongoClient.connect(mongoUrl, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }, (err, client) => {
        if (err) throw err;

        const userCollection = client.db("lirycs").collection("users");

        // Grabbing currentUser's current dad joke repository
        let currentUserDadJokes = undefined;
        userCollection.find({ username: req.cookies.currentUser.username }).toArray((err, users) => {
          // Grabbing currentUser mongo object
          const user = users[0];

          // Getting current user Mongo object's current dad jokes list
          currentUserDadJokes = user.storeItems.dadJokes;

          // Appending new dad joke to current list
          currentUserDadJokes.push(dadJoke);

          // Calculating new credits for user by subtracting credit price
          const updatedUserCredits = user.credits - dadJokeCreditPrice;

          // Setting new credit value to 'currentUser' cookie
          let currentUser = req.cookies.currentUser;
          currentUser.credits = updatedUserCredits;
          res.cookie("currentUser", currentUser);

          // Updating currentUser to add dad joke to store items
          userCollection.updateOne({ username: req.cookies.currentUser.username }, {
            $set: {
              // Taking inner document of dadJokes and setting it to the same thing with the new dad joke appended to it
              "storeItems.dadJokes": currentUserDadJokes,
              "credits": updatedUserCredits,
            }
          });

          // Sending dad joke in JSON format for capture and parsing in frontend
          res.send({
            joke: dadJoke
          });
        });
      });
    });
  });

app.route("/store/buy-meme")
  .get((req, res) => {
    res.render("store/buy-meme.html");
  });

app.route("/store/gamble")
  .get((req, res) => {
    res.render("store/gamble.html");
  })

  .post((req, res) => {
    const creditAmount = parseInt(req.query.creditAmount);

    let failureRate = undefined;
    switch (creditAmount) {
      case 10:
        failureRate = 0.5;
        break;
      case 50:
        failureRate = 0.6;
        break;
      case 100:
        failureRate = 0.7;
        break;
      case 500:
        failureRate = 0.8;
        break;
    }

    // Grabbing currentUser saved in cookies
    const currentUser = req.cookies.currentUser;

    // Generating random gamble outcome
    const gambleResult = Math.random() >= failureRate;

    // Getting value to add to credits
    // First, gamble fee is subtracted
    // Then, if gamble is successful, prize credits are added
    // Else, if gamble isn't successful, nothing is added
    let endCreditTransactionAmount = -creditAmount;
    switch (creditAmount) {
      case 10:
        if (gambleResult) endCreditTransactionAmount += 20 + creditAmount;
        break;
      case 50:
        if (gambleResult) endCreditTransactionAmount += 150 + creditAmount;
        break;
      case 100:
        if (gambleResult) endCreditTransactionAmount += 300 + creditAmount;
        break;
      case 500:
        if (gambleResult) endCreditTransactionAmount += 2000 + creditAmount;
        break;
    }

    // Subtracting creditAmount from user credits
    MongoClient.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }, (err, client) => {
      if (err) throw err;

      const userCollection = client.db("lirycs").collection("users");

      // Modifying currentUser's database credits value
      userCollection.updateOne({ username: currentUser.username }, {
        $set: {
          credits: currentUser.credits + endCreditTransactionAmount
        }
      });

      // Modifying 'currentUser' cookie
      currentUser.credits = currentUser.credits + endCreditTransactionAmount;
      res.cookie("currentUser", currentUser);

      res.send({
        result: gambleResult,
        creditsLeft: currentUser.credits
      });
    });
  });

app.route("/store/send-to-friend")
  .get((req, res) => {
    res.render("store/send-to-friend.html", context={
      initialSuccess: null,
      initialError: null
    });
  })

  .post((req, res) => {
    const sendToFriendData = req.body;
    const targetUsername = sendToFriendData.username;
    const creditAmount = parseInt(sendToFriendData.creditAmount);

    MongoClient.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }, (err, client) => {
      if (err) throw err;

      const userCollection = client.db("lirycs").collection("users");

      // Validating that this target user exists
      userCollection.find({ username: targetUsername }).toArray((err, users) => {
        if (err) throw err;

        if (users.length == 0) {  // No user exists
          res.render("store/send-to-friend.html", context={
            initialSuccess: null,
            initialError: "User does not exist."
          });
        }

        else {
          // Adding to target user's credit amount
          const targetUser = users[0];
          const targetUserNewCreditAmount = targetUser.credits + creditAmount

          userCollection.updateOne({ username: targetUser.username }, {
            $set: {
              credits: targetUserNewCreditAmount
            }
          });

          // Subtracting from currentUser's credit amount
          const currentUser = req.cookies.currentUser;
          const currentUserNewCreditAmount = currentUser.credits - creditAmount;

          userCollection.updateOne({ username: currentUser.username }, {
            $set: {
              credits: currentUserNewCreditAmount
            }
          });

          // Modifying 'currentUser' cookie's credit amount
          currentUser.credits = currentUserNewCreditAmount;
          res.cookie("currentUser", currentUser);

          // Re-rendering page with success message
          res.render("store/send-to-friend.html", context={
            initialSuccess: `Successfully transferred ${creditAmount} to ${targetUser.username}.`,
            initialError: null
          });
        }
      });
    });
  });


// GAME ROUTES
app.route("/game")
  .get((req, res) => {
    res.render("game.html");
  });

app.route("/game/guess-the-song")
  .get(async (req, res) => {
    // Getting 3 random song titles
    let songTitles = [];
    for (let i = 0; i < 3; i++) {
      rndSong(rndOptions, function(err, rnd) {
        if (!err) {
          songTitles.push(rnd.track.track_name)
        } else { console.log(new Error(err)); }
      });
    }

    // Grabbing random song
    rndSong(rndOptions, function(err, rnd) {
      if (!err) {
        // Grabbing random track ID
        const trackId = rnd.track.track_id;

        // Generating lyrics API link
        const lyricsLink = getLyricsLink(trackId);

        // Pushing new title to songTitles
        songTitles.push(rnd.track.track_name);

        // Making API call
        axios.get(lyricsLink)
          .then((response) => {
            // Grabbing lyrics body and splitting on newlines, which splits up all the sentences
            let lyrics = response.data.message.body.lyrics.lyrics_body.split("\n").slice(0, -2);
            lyrics = lyrics.filter(lyric => lyric.length > 5);

            // Grabbing random lyric from the lyrics sentences
            const randomLyric = lyrics[Math.floor(Math.random()*lyrics.length)];

            res.render("games/guess-the-song.html", context={
              lyric: randomLyric,
              songTitles: songTitles,
              correctSong: rnd.track.track_name
          });
        });

      } else { console.log(new Error(err)); }
    });
  })

  .post((req, res) => {
    const operation = req.query.operation;

    // Calculating credit amount server-side
    let credits = undefined;
    if (operation == "add") {
      credits = Math.floor(Math.random() * 10) + 10;
    }
    else {
      credits = Math.floor(Math.random() * 5) + 5;
    }

    // Adding/subtracting credits from user's total credits
    MongoClient.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }, (err, client) => {
      if (err) throw err;

      const userCollection = client.db("lirycs").collection("users");

      // Modifying 'currentUser' cookie
      let currentUser = req.cookies.currentUser;

      let endCredits = undefined;
      if (operation == "add") {  // Add credits
        endCredits = currentUser.credits + credits;
      }
      else {  // Subtract credits
        endCredits = currentUser.credits - credits;
      }

      currentUser.credits = endCredits;

      // Updating Mongo user with 'currentUser' cookie data
      userCollection.updateOne({ username: req.cookies.currentUser.username }, {
        $set: {
          credits: endCredits
        }
      });

      res.cookie("currentUser", currentUser);

      res.send({ credits })
    });
  })

// app.route("/game/guess-the-lyric")
//   .get((req, res) => {
//     // Getting three random lyrics
//     let songLyrics = [];
//     for (var i = 0; i < 3; i++) {
//       rndSong(rndOptions, function(err, rnd) {
//         if (!err) {
//           // Grabbing random track ID
//           const trackId = rnd.track.track_id;
//
//           // Generating lyrics API link
//           const lyricsLink = getLyricsLink(trackId);
//
//           // Making API call
//           axios.get(lyricsLink)
//             .then((response) => {
//               // Grabbing lyrics body and splitting on newlines, which splits up all the sentences
//               let lyrics = response.data.message.body.lyrics.lyrics_body.split("\n").slice(0, -2);
//               lyrics = lyrics.filter(lyric => lyric.length > 5);
//
//               // Grabbing random lyric from the lyrics sentences
//               const randomLyric = lyrics[Math.floor(Math.random()*lyrics.length)];
//
//               songLyrics.push(randomLyric);
//           });
//
//         } else { console.log(new Error(err)); }
//       });
//     }
//
//     // Getting rid of 'undefined' lyrics
//     songLyrics = songLyrics.filter(function (el) {
//       return el != null;
//     });
//
//     // Getting one song + lyric
//     rndSong(rndOptions, function(err, rnd) {
//       if (!err) {
//         // Grabbing random track ID
//         const trackId = rnd.track.track_id;
//
//         // Generating lyrics API link
//         const lyricsLink = getLyricsLink(trackId);
//
//         // Making API call
//         axios.get(lyricsLink)
//           .then((response) => {
//             // Grabbing lyrics body and splitting on newlines, which splits up all the sentences
//             let lyrics = response.data.message.body.lyrics.lyrics_body.split("\n").slice(0, -2);
//             lyrics = lyrics.filter(lyric => lyric.length > 5);
//
//             // Grabbing random lyric from the lyrics sentences
//             const randomLyric = lyrics[Math.floor(Math.random()*lyrics.length)];
//
//             console.log(songLyrics)
//
//             res.render("games/guess-the-lyric.html", context={
//               song: rnd.track.track_name,
//               correctLyric: randomLyric,
//               songLyrics: songLyrics,
//           });
//         });
//
//       } else { console.log(new Error(err)); }
//     });
//   })


// API METHODS
app.post("/api/send-email", async (req, res) => {
  const name = req.query.name;
  const email = req.query.email;
  const message = req.query.message;

  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "gamestrike.info@gmail.com",
      pass: "#gamestrike4life"
    }
  });

  let info = await transporter.sendMail({
    from: email,
    to: "calix.huang1@gmail.com",
    subject: "Lirycs - Contact Us",
    text: message
  });
})


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
