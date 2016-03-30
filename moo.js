/*
 Moo v3, this time in node.js instead of PHP

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */
"use strict";

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
var Seen = require("./modules/seen");

class Moo {
  /**
   * @param {Object} config
   */
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
    this.modules.seen = new Seen(this);
  }

  createSocketListeners() {
    // Connection established
    this.socket.on("connect", () => {
      util.log("Connected");
      setTimeout(() => {
        util.log("Setting nick");
        this.nickCommand(this.config.nick);
        util.log("Setting user");
        this.userCommand();
      }, 1000);
    });

    // Incoming data!
    this.socket.on("data", (data) => {
      var data_ = data.toString();
      if (data_.indexOf("\uFFFD") !== -1) {
        data_ = iconv.decode(data, "iso885913");
      }
      this.incomingData += data_;
      this.processData();
    });

    this.socket.on("timeout", () => {
      this.socket.destroy();
    });

    this.socket.on("close", () => {
      util.log("Socket closed");
      if (this.shutDown === true) {
        process.exit();
      } else {
        setTimeout(() => {
          this.connect();
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
      this.socket.setTimeout(this.config.silenceTimeout * 1000, () => {
        util.log("Silence timeout hit, destroying socket");
        this.socket.destroy();
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

  /**
   * Write raw data to socket
   * @param {string} data
   */
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

  /**
   * @returns {number|boolean}
   */
  checkLines() {
    var lineBreak = this.incomingData.indexOf("\n");
    //util.log("Line break: " + lineBreak);
    if (lineBreak !== -1) {
      return lineBreak;
    }

    return false;
  }

  /**
   * Get line from incomingData buffer or false if no data
   * @returns {string|boolean}
   */
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
    setTimeout(() => {
      this.nickCommand(this.config.nick);
    }, 1000);
  }

  // Commands
  /**
   * Change nick
   * @param {string} nick
   */
  nickCommand(nick) {
    this.raw("NICK " + nick + "\n");
    this.currentNick = nick;
  }

  /**
   * Identify yourself to the server
   */
  userCommand() {
    this.raw("USER " + this.config.ident + " 0 * :" + this.config.ircRealName + "\n");
  }

  quitCommand() {
    this.raw("QUIT :" + this.config.ircQuitMsg + "\n");
  }

  pongCommand() {
    this.raw("PONG\n");
  }

  /**
   * Join a channel
   * @param {string} channel
   * @param {string} [key]
   */
  joinCommand(channel, key) {
    this.raw("JOIN " + channel + ((key !== undefined) ? " " + key : "") + "\n");
  }

  /**
   * Send a message
   * @param {string} to
   * @param {string} msg
   */
  privmsgCommand(to, msg) {
    var lines = msg.trim().split("\n");
    lines.forEach((line) => {
      this.raw("PRIVMSG " + to + " :" + line + "\n");

      this.logEvent({
        target: to,
        nick: this.config.nick,
        userhost: (this.nameList.list[this.currentNick] !== undefined ? this.nameList.list[this.currentNick].mask : null),
        act: "PRIVMSG",
        text: line
      });
    });
  }

  /**
   * Send a notice
   * @param {string} to
   * @param {string} msg
   */
  noticeCommand(to, msg) {
    this.raw("NOTICE " + to + " :" + msg + "\n");
  }

  /**
   * Kick a user
   * @param {string} where
   * @param {string} who
   * @param {string} [msg]
   */
  kickCommand(where, who, msg) {
    this.raw("KICK " + where + " " + who + ((msg !== undefined) ? " :" + msg : ""));
  }

  /**
   * Ban or unban an user
   * @param {string} where
   * @param {string} who
   * @param {boolean} [ban=true]
   */
  banCommand(where, who, ban) {
    if (ban === undefined) {
      ban = true;
    }

    this.raw("MODE " + where + " " + (ban ? "+b" : "-b") + " " + who + "\n");
  }

  /**
   * Send a WHOIS command about an user
   * @param {string} who
   */
  whoisCommand(who) {
    this.raw("WHOIS " + who + "\n");
  }

  /**
   * Send a WHO command
   * @param {string} what
   */
  whoCommand(what) {
    this.raw("WHO " + what + "\n");
  }

  /**
   *
   * @param {Object} data
   * @param {string} data.act
   * @param {string} [data.target]
   * @param {string} [data.nick]
   * @param {string} [data.userhost]
   * @param {string} [data.text]
   */
  logEvent(data) {
    this.mongo.logEvent(data);
  }
}

module.exports = Moo;
