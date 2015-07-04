/*
 Moo v3, this time in node.js instead of PHP

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */

var util = require("util");
var iconv = require("iconv-lite");
var net = require("net");
var mysql = require("mysql");
var Mongo = require("./modules/mongo");
var WebServer = require("./modules/webServer");
var Calculator = require("./modules/calculator");
var MessageParser = require("./modules/messageParser");
var Configuration = require("./config");

class Moo {
  constructor() {
    this.startTime = Date.now();
    this.net = require("net");
    this.shutDown = false;
    this.connection = {};
    this.name = "Moo";
    this.currentNick = "";
    this.webServer = new WebServer(this);
    this.parser = new MessageParser(this);
    this.incomingData = "";
    this.mongo = new Mongo(this);
    this.MySQLHandler();

    // Set up IRC socket
    this.socket = new net.Socket();
    var self = this;
    this.socket.setTimeout(this.config("silenceTimeout") * 1000, function () {
      util.log("Silence timeout hit, destroying socket");
      self.socket.destroy();
    });
    this.createSocketListeners();

    // Modules
    this.modules = {};

    this.modules.knowledge = new (require("./modules/knowledge.js"))(this);
    this.modules.calculator = new Calculator(this);
    this.modules.google = new (require("./modules/google.js"))(this);
    this.modules.bing = new (require("./modules/bing.js"))(this);
    this.modules.youtube = new (require("./modules/youtube.js"))(this);
    this.modules.wolframAlpha = new (require("./modules/wolframAlpha.js"))(this);
  }

  config(name) {
    return Configuration.getOption(name);
  }

  MySQLHandler() {
    this.db = mysql.createConnection({
      host: this.config("sqlHost"),
      user: this.config("sqlUser"),
      password: this.config("sqlPass"),
      database: this.config("sqlDB")
    });

    this.db.connect(function (err) {
      if (err) {
        util.log("Error connecting to DB: " + err.code);
        setTimeout(self.MySQLHandler, 2000);
      } else {
        util.log("Connection to DB established");
      }
    });

    var errorHandler = function (err) {
      if (!err.fatal) {
        util.log("Error: " + err.message);
        return;
      }

      if (err.code !== "PROTOCOL_CONNECTION_LOST") {
        util.log("Mysql error not \"Connection lost\" !?");
        util.log("Error: " + err.message);

        this.db.end();
      }

      util.log("Re-connecting MySQL connection: " + err.stack);

      this.MySQLHandler();
    };

    this.db.on("error", errorHandler.bind(this));
  }

  createSocketListeners() {
    var self = this;
    // Connection established
    this.socket.on("connect", function () {
      util.log("Connected");
      setTimeout(function () {
        util.log("Setting nick");
        self.nickCommand(self.config("nick"));
        util.log("Setting user");
        self.userCommand();
      }, 1000);
    });

    // Incoming data!
    this.socket.on("data", function (data) {
      var data_ = data.toString();
      if (data_.indexOf("\uFFFD") !== -1) {
        data_ = iconv.decode(data, "iso885913");
      }
      self.incomingData += data_;
      self.processData();
    });

    this.socket.on("timeout", function () {
      self.socket.destroy();
    });

    this.socket.on("close", function () {
      util.log("Socket closed");
      if (self.shutDown === true) {
        process.exit();
      }

      setTimeout(function () {
        self.connect();
      }, 5000);
    });

    this.socket.on("error", function (error) {
      util.log("Error " + error.name + ": " + error.message);
    });
  }

  connect() {
    util.log("Connecting");
    this.socket.setNoDelay();
    this.socket.connect(this.config("ircPort"), this.config("ircServer"));
  }

  quit() {
    util.log("Shutting down");
    this.shutDown = true;
    this.quitCommand();
  }

  raw(data) {
    this.socket.write(data, "utf8", function () {
      util.log("-> " + data.trim());
    });
  }

  processData() {
    var line;
    while (line = this.getLine()) {
      this.parser.processLine(line);
    }
  }

  checkLines() {
    var lineBreak = this.incomingData.indexOf("\n");
    //util.log("Line break: " + lineBreak);
    if (lineBreak !== -1) {
      return lineBreak;
    }

    return false;
  }

  getLine() {
    if (this.checkLines() === false) {
      return false;
    }

    var lineBreak = this.incomingData.indexOf("\r\n");
    var crlfLen = 2;
    if (lineBreak === -1) {
      lineBreak = this.incomingData.indexOf("\n");
      crlfLen = 1;
    }

    var line = this.incomingData.substring(0, lineBreak);
    this.incomingData = this.incomingData.substring(lineBreak + crlfLen);
    return line;
  }

  authenticate() {
    this.privmsgCommand("nickserv", "identify " + this.config("nick") + " " + this.config("nickservPassword"));
  }

  ghostNick() {
    this.privmsgCommand("nickserv", "ghost " + this.config("nick") + " " + this.config("nickservPassword"));
    var self = this;
    setTimeout(function () {
      self.nickCommand(self.config("nick"));
    }, 1000);
  }

  // Commands
  nickCommand(nick) {
    this.raw("NICK " + nick + "\n");
    this.currentNick = nick;
  }

  userCommand() {
    this.raw("USER " + this.config("ident") + " 0 * :" + this.config("ircRealName") + "\n");
  }

  quitCommand() {
    this.raw("QUIT :" + this.config("ircQuitMsg") + "\n");
  }

  pongCommand() {
    this.raw("PONG\n");
  }

  joinCommand(channel, key) {
    this.raw("JOIN " + channel + ((key !== undefined) ? " " + key : "") + "\n");
  }

  privmsgCommand(to, msg) {
    var self = this;
    var lines = msg.trim().split("\n");
    lines.forEach(function (line) {
      self.raw("PRIVMSG " + to + " :" + line + "\n");

      self.logEvent({
        target: to,
        nick: self.config("nick"),
        userhost: (self.parser.nameList[self.currentNick] !== undefined ? self.parser.nameList[self.currentNick].mask : null),
        act: "PRIVMSG",
        text: line
      });
    });
  }

  noticeCommand(to, msg) {
    this.raw("NOTICE " + to + " :" + msg + "\n");
  }

  kickCommand(where, who, msg) {
    this.raw("KICK " + where + " " + who + ((msg !== undefined) ? " :" + msg : ""));
  }

  banCommand(where, who, ban) {
    if (ban === undefined) {
      ban = true;
    }

    this.raw("MODE " + where + " " + (ban ? "+b" : "-b") + " " + who + "\n");
  }

  whoisCommand(who) {
    this.raw("WHOIS " + who + "\n");
  }

  whoCommand(what) {
    this.raw("WHO " + what + "\n");
  }

  // Logging
  logEvent(data) {
    if (data.act === undefined || data.act.length === 0) {
      return new Error("act must be specified");
    }

    var allowedList = ["target", "nick", "userhost", "act", "text"];
    var dbData = {};
    for (var prop in data) {
      //noinspection JSUnfilteredForInLoop
      if (allowedList.indexOf(prop) === -1) {
        return new Error("Unknown data key: '" + prop + "'");
      }
      //noinspection JSUnfilteredForInLoop
      dbData[prop] = data[prop];
    }

    this.db.query("INSERT INTO logs SET ?", dbData, function () {
    });
    //util.log(query);
  }
}

module.exports = Moo;
