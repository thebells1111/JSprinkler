const Sprinkler = require("./sprinkler.js");

const sprinkler = new Sprinkler();
sprinkler.init();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const path = require("path");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/static", express.static("public"));
app.use(express.static("public"));
app.use(cors());

app.get("/programs", (req, res) => {
  res.json(sprinkler);  
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
});

app.get("/manual", (req, res) => {
  res.sendFile(path.join(__dirname + "/manual.html"));
});

app.post("/programs", (req, res) => {
  let programs = req.body.programs;

  if (programs) {
    console.log(programs)
    sprinkler
      .updatePrograms(programs)
      .then(results => {
        sprinkler.programs = results;
        Object.keys(sprinkler.stations).forEach(
          s => (sprinkler.stations[s].duration = 0)
        );
        res.send("OK");
      })
      .catch(err => {
        res.status(500).send("Error-Program was not saved");
      });
  } else {
    res.status(400).send("Incorrect Syntax Used");
  }
});

app.post("/manual", (req, res) => {
  let programs = req.body.programs;

  if (programs) {
    console.log(programs);
    sprinkler.updateManual(programs);
    res.send("OK");
  } else {
    res.status(400).send("Incorrect Syntax Used");
  }
});

app.post("/toggle_manual", (req, res) => {
  sprinkler.manual = req.body.manual;
  if (req.body.manual) {
    Object.keys(sprinkler.stations).forEach(s => {
      sprinkler.stations[s].duration = 0;
    });
  }
  res.send("OK");
});

app.listen(8000, () => console.log("server started"));
