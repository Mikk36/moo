/*
 Moo v3, this time in node.js instead of PHP

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */

var util = require("util");
var iconv = require("iconv-lite");
var net = require("net");
var Mongo = require("./modules/mongo");
var NameList = require("./modules/nameList");
var MessageParser = require("./modules/messageParser");
var WebServer = require("./modules/webServer");
var Knowledge = require("./modules/knowledge");
var Calculator = require("./modules/calculator");
var Google = require("./modules/google");
var Bing = require("./modules/bing");
var Youtube = require("./modules/youtube");
var WolframAlpha = require("./modules/wolframAlpha");
var Notify = require("./modules/notify");

class Moo {
  constructor(config) {
    this.config = config;
    this.shutDown = false;
    this.name = "Moo";
    this.currentNick = "";
    this.mongo = new Mongo(this);
    this.webServer = new WebServer(this);
    this.nameList = new NameList();
    this.parser = new MessageParser(this);
    this.incomingData = "";
    // Set up IRC socket
    this.socket = new net.Socket();
    this.firstConnect = true;
    this.createSocketListeners();

    // Modules
    this.modules = {};

    this.modules.knowledge = new Knowledge(this);
    this.modules.calculator = new Calculator(this);
    this.modules.google = new Google(this);
    this.modules.bing = new Bing(this);
    this.modules.youtube = new Youtube(this);
    this.modules.wolframAlpha = new WolframAlpha(this);
    this.modules.tell = new Notify(this);
  }

  createSocketListeners() {
    var self = this;
    // Connection established
    this.socket.on("connect", function () {
      util.log("Connected");
      setTimeout(function () {
        util.log("Setting nick");
        self.nickCommand(self.config.nick);
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
      } else {
        setTimeout(function () {
          self.connect();
        }, 5000);
      }
    });

    this.socket.on("error", function (error) {
      util.log("Error " + error.name + ": " + error.message);
    });
  }

  connect() {
    util.log("Connecting");
    if (this.firstConnect) {
      var self = this;
      this.socket.setTimeout(this.config.silenceTimeout * 1000, function () {
        util.log("Silence timeout hit, destroying socket");
        self.socket.destroy();
      });
      this.firstConnect = false;
    }

    this.socket.setNoDelay();
    this.socket.connect(this.config.ircPort, this.config.ircServer);
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
    this.privmsgCommand(this.config.nickserv, "identify " + this.config.nick + " " + this.config.nickservPassword);
  }

  ghostNick() {
    this.privmsgCommand(this.config.nickserv, "ghost " + this.config.nick + " " + this.config.nickservPassword);
    var self = this;
    setTimeout(function () {
      self.nickCommand(self.config.nick);
    }, 1000);
  }

  // Commands
  nickCommand(nick) {
    this.raw("NICK " + nick + "\n");
    this.currentNick = nick;
  }

  userCommand() {
    this.raw("USER " + this.config.ident + " 0 * :" + this.config.ircRealName + "\n");
  }

  quitCommand() {
    this.raw("QUIT :" + this.config.ircQuitMsg + "\n");
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
        nick: self.config.nick,
        userhost: (self.nameList.list[self.currentNick] !== undefined ? self.nameList.list[self.currentNick].mask : null),
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

  logEvent(data) {
    this.mongo.logEvent(data);
  }
}

module.exports = Moo;
