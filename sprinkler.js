const fs = require("fs");
const rpio = require("rpio");

class Sprinkler {
  constructor() {
    this.manual = 0;
    this.stations = {
      s1: { name: "BROKEN", pin: 11, status: 0, duration: 0 },
      s2: { name: "Back", pin: 13, status: 0, duration: 0 },
      s3: { name: "Side", pin: 15, status: 0, duration: 0 },
      s4: { name: "Buckets", pin: 29, status: 0, duration: 0 },
      s5: { name: "s5", pin: 31, status: 0, duration: 0 },
      s6: { name: "s6", pin: 33, status: 0, duration: 0 },
      s7: { name: "Front", pin: 36, status: 0, duration: 0 },
      s8: { name: "Master", pin: 37, status: 0, duration: 0 },
    };
    this.masterValve = {
      station: "s8",
      enable: 1,
    };
    this.programs = [];
  }

  init() {
    Object.keys(this.stations).forEach((s) => {
      rpio.open(this.stations[s].pin, rpio.OUTPUT, rpio.HIGH);
    });

    this.getPrograms();
    this.runPrograms();
  }

  masterValveControl() {
    let status = 0;
    let duration = 0;

    Object.keys(this.stations).forEach((s) => {
      if (s !== this.masterValve.station && this.stations[s].status === 1) {
        status = 1;
      }
      if (this.stations[s].duration > duration) {
        duration = this.stations[s].duration;
      }
    });

    if (status) {
      this.turnOn(this.masterValve.station);
      this.stations[this.masterValve.station].duration = duration;
    } else {
      this.turnOff(this.masterValve.station);
    }
  }

  getPrograms() {
    try {
      this.programs = JSON.parse(fs.readFileSync("./programs.json", "utf8"));
      this.programs.forEach((p) => {
        p.timerOn = p.dailyStart;
        p.timerOff = p.dailyStart + p.timerDuration;
      });
      //this is to reset the on/off timers in case the program was
      //terminated prematurely

      if (!this.programs[0].selectedStations) {
        throw Error;
      }
    } catch (e) {
      console.log(e);
      this.programs = [];
    }
  }

  runPrograms() {
    if (this.manual) {
      this.checkManual();
    } else {
      this.checkPrograms();
    }

    if (this.masterValve.enable) {
      this.masterValveControl();
    }

    setTimeout(
      this.runPrograms.bind(this),
      (Math.floor(new Date().getTime() / 1000) + 1) * 1000 -
        new Date().getTime()
    );

    this.decreaseSprinklerDuration();
  }

  checkPrograms() {
    let today = new Date(new Date().toLocaleDateString()).getTime();
    let timeNow = new Date().getTime();
    let update = false;
    this.programs.forEach((p) => {
      if (p.type === "DOW" && p.DOW.indexOf(new Date().getDay > -1)) {
        p.dateStart = today;
      } else {
        while (today > p.dateStart) {
          p.dateStart += p.dateInterval;
          update = true;
        }
      }

      if (timeNow > p.dateStart + p.dailyStop) {
        p.dateStart += p.dateInterval;
        p.timerOn = p.dailyStart;
        p.timerOff = p.timerOn + p.timerDuration;
        update = true;
      }

      let nextOnTime = p.dateStart + p.timerOn;
      let nextOffTime = p.dateStart + p.timerOff;

      while (timeNow > nextOffTime) {
        p.timerOn = p.timerOn + p.timerInterval;
        p.timerOff = p.timerOn + p.timerDuration;
        nextOffTime = p.dateStart + p.timerOff;
        nextOnTime = p.dateStart + p.timerOn;
        update = true;
      }

      if (timeNow >= nextOnTime) {
        p.selectedStations.forEach((s) => {
          let duration = nextOffTime - Math.round(timeNow / 1000) * 1000;
          if (duration > this.stations[s].duration) {
            this.stations[s].duration = duration;
          }
        });
      }

      Object.keys(this.stations).forEach((s) => {
        if (this.stations[s].duration > 0) {
          this.turnOn(s);
        } else {
          this.turnOff(s);
        }
      });
    });

    if (update) {
      this.updatePrograms(this.programs);
    }
  }

  decreaseSprinklerDuration() {
    Object.keys(this.stations).forEach((s) => {
      if (this.stations[s].duration > 0) {
        this.stations[s].duration -= 1000;
        if (s !== "s8") {
          console.log(`${s}: ${this.stations[s].duration}`);
        }
        if (s === "s8" && this.stations[s].duration < 1) {
          this.manual = 0;
        }
      }
    });
  }

  checkManual() {
    Object.keys(this.stations).forEach((s) => {
      if (this.stations[s].duration > 0) {
        this.turnOn(s);
      } else {
        this.turnOff(s);
      }
    });
  }

  updateManual(programs) {
    Object.keys(this.stations).forEach((s) => {
      this.stations[s].duration = programs[s];
    });
  }

  turnOff(station) {
    if (this.stations[station].duration <= 0) {
      if (this.stations[station].status === 1) {
        console.log(
          `${
            this.stations[station].name
          } turned off at ${new Date().toLocaleString()}`
        );

        fs.appendFile(
          "log.txt",
          `${
            this.stations[station].name
          } turned off at ${new Date().toLocaleString()}\n\n`,
          function (err) {
            if (err) return console.log(err);
          }
        );
      }

      this.stations[station].status = 0;
      rpio.write(this.stations[station].pin, rpio.HIGH);
    }
  }

  turnOn(station) {
    if (this.stations[station].status === 0) {
      console.log(
        `${
          this.stations[station].name
        } turned on at ${new Date().toLocaleString()}\n`
      );

      fs.appendFile(
        "log.txt",
        `${
          this.stations[station].name
        } turned on at ${new Date().toLocaleString()}\n`,
        function (err) {
          if (err) return console.log(err);
        }
      );

      this.stations[station].status = 1;
      rpio.write(this.stations[station].pin, rpio.LOW);
    }
  }

  updatePrograms(data) {
    //this is a promise to handle changing the program from the clients browser in index.js
    return new Promise(function (resolve, reject) {
      fs.writeFile(
        "./programs.json",
        JSON.stringify(data, null, 1),
        "utf-8",
        function (err) {
          if (err) {
            console.log("Update Programs / Caught: " + e.message);
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });
  }
}

module.exports = Sprinkler;
