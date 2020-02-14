const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

app = express();

// Coniguring middleware
app.use(cors());
app.use(bodyParser.json());


app.get("/api/test", (req, res) => {
  res.send("Hello World!");
});


if (process.env.NODE_ENV == "production") {
  app.use(express.static(__dirname + "/public"));

  app.get(/.*/, (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
  });
}


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[+] Lirycs server running on port ${port}...`);
});
