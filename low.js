let http = require("http");
let fs = require("fs");
const Sprinkler = require("./sprinkler.js");

const sprinkler = new Sprinkler();
sprinkler.init();

//let gpio = require('gpio');

let state = 0;
//gpio.pins[pinnumber].setType(gpio.OUTPUT).setValue(state);

let globalCSS;
let bundleCSS;
let bundleJS;
let favicon;

let index = fs.readFileSync("./index.html", "utf8");

http
  .createServer((req, res) => {
    if (req.url == "/programs") {
      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(JSON.stringify(sprinkler));
      } else if (req.method === "POST") {
        var data = "";
        req.on("data", chunk => {
          data += chunk;
        });
        req.on("end", () => {
          let body = JSON.parse(data);
          let programs = body.programs;

          if (programs) {
            console.log(programs);
            sprinkler
              .updatePrograms(programs)
              .then(results => {
                sprinkler.programs = results;
                Object.keys(sprinkler.stations).forEach(
                  s => (sprinkler.stations[s].duration = 0)
                );
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("OK");
              })
              .catch(err => {
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("Error-Program was not saved");
              });
          } else {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Incorrect Syntax Used");
          }
        });
      }
      //gpio.pins[pinnumber].setValue(state);
    } else if (req.url == "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(index);
    } else {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(80);
