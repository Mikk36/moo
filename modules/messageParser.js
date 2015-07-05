/*
 MessageParser

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */
var events = require("events");
var util = require("util");

class MessageParser {
  constructor(moo) {
    events.EventEmitter.call(this);
    this.nameList = {};
    this.nameListComplete = true;
    this.lineVars = {};
    this.moo = moo;
    this.config = this.moo.config.bind(this.moo);
  }

  processLine(rawLine) {

    util.log("<- " + rawLine);
    //util.log("UTF-8 decoded <- " + decodeURIComponent(escape(rawLine)));

    if (rawLine[0] !== ":") {
      rawLine = ":Server " + rawLine;
    }
    var line = rawLine.substring(1);
    var parts = line.split(" ", 3);

    var params = line.substring(parts[0].length + parts[1].length + parts[2].length + 3);

    if (params.indexOf(":") !== -1) {
      params = params.substr(0, params.indexOf(" :"));
    }
    // :moo!~moo@cjfda.lakrito.ee JOIN #fuba1
    var offset1 = parts[0].indexOf("!");
    var offset2 = offset1 + 1;
    var offset3 = parts[0].indexOf("@") + 1;
    var offset4 = offset3 - offset2 - 1;
    var offset5 = line.indexOf(" :") + 2;

    this.lineVars = {
      from: parts[0],
      fromNick: parts[0].substr(0, offset1),
      fromIdent: parts[0].substr(offset2, offset4),
      fromHost: parts[0].substr(offset3),
      cmd: parts[1],
      to: parts[2],
      text: line.substr(offset5),
      params: params.trim(),
      raw: rawLine
    };

    if (offset5 === 1) {
      this.lineVars.text = "";
    }

    if (MessageParser.is_numeric(this.lineVars.cmd)) {
      this.parseServerMessage();
      this.emit("serverMessage", this.lineVars);
    } else {
      this.parseMessage();
      this.emit("message", this.lineVars);
    }
    if (this.lineVars.cmd === "PRIVMSG") {
      this.emit("privMsg", this.lineVars);
    }
  }

  parseServerMessage() {
    var cmd = parseInt(this.lineVars.cmd, 10);
    switch (cmd) {
      case 1: // I have successfully connected to the server
              // Do nothing yet
        break;
      case 376: // RPL_ENDOFMOTD
        this.moo.authenticate();
        var self = this;
        setTimeout(function () {
          self.moo.joinCommand(self.config("ircChannel"));
        }, 1000);
        break;
      case 433: // ERR_NICKNAMEINUSE
      case 436: // ERR_NICKCOLLISION
        this.moo.nickCommand(this.config("nick") + "_" + (100 + Math.floor(Math.random() * 900)));
        this.moo.ghostNick();
        break;
      case 332: // RPL_TOPIC
        this.moo.logEvent({
          target: this.lineVars.params,
          act: this.lineVars.cmd,
          text: this.lineVars.text
        });
        break;
      case 333: // Info of person who set the last topic
        var logSource = this.lineVars.raw.split(" ");
        var setter = logSource[4].split("!");
        this.moo.logEvent({
          target: logSource[3],
          nick: setter[0],
          userhost: setter[1],
          act: this.lineVars.cmd,
          text: logSource[5]
        });
        break;
      case 352: // RPL_WHOREPLY
        // Populate current channel users list
        this.nameListPopulate();
        break;
      case 315: // RPL_ENDOFWHO
        // End of current channel users list
        this.nameListComplete = true;
        break;
      case 474: // ERR_BANNEDFROMCHAN
        this.moo.privmsgCommand("ChanServ", "UNBAN " + this.config("ircChannel"));
        this.moo.joinCommand(this.config("ircChannel"));
        break;
      case 311: // RPL_WHOISUSER
    }
  }

  parseMessage() {
    switch (this.lineVars.cmd) {
      case "PING":
        if (this.lineVars.from == "Server") {
          this.moo.pongCommand();
        }
        break;
      case "PRIVMSG":
        this.moo.logEvent({
          target: this.lineVars.to,
          nick: this.lineVars.fromNick,
          userhost: this.lineVars.fromIdent + "@" + this.lineVars.fromHost,
          act: this.lineVars.cmd,
          text: this.lineVars.text
        });

        if (this.lineVars.text.toLowerCase() == "quit()" && this.config("adminUsers").indexOf(this.lineVars.fromNick.toLowerCase()) !== -1) {
          this.moo.quit();
        }

        if (this.lineVars.to[0] !== "#") {
          var ctcpCheck = this.lineVars.text.split(" ", 1);
          switch (encodeURI(ctcpCheck)) {
            case "%01FINGER%01":
              this.moo.noticeCommand(this.lineVars.fromNick, "Stop touching me!");
              break;
            case "%01VERSION%01":
              this.moo.noticeCommand(this.lineVars.fromNick, String.fromCharCode(1) + "VERSION Moo 3.0 powered by Node.js" + String.fromCharCode(1));
              break;
            case "%01PING":
              this.moo.noticeCommand(this.lineVars.fromNick, this.lineVars.text);
              break;
            case "%01TIME%01":
              this.moo.noticeCommand(this.lineVars.fromNick, String.fromCharCode(1) + " :" + (new Date().toISOString()) + String.fromCharCode(1));
              break;
          }
        }
        break;
      case "QUIT":
        this.moo.logEvent({
          nick: this.lineVars.fromNick,
          userhost: this.lineVars.fromIdent + "@" + this.lineVars.fromHost,
          act: this.lineVars.cmd,
          text: this.lineVars.text
        });
        break;
      case "NOTICE":
        break;
      case "JOIN":
        if (this.lineVars.fromNick === this.moo.currentNick) {
          this.nameListComplete = false;
          this.nameList = {};
          this.moo.whoCommand(this.lineVars.to);
        }
        this.nameListAdd();

        this.moo.logEvent({
          target: this.lineVars.to,
          nick: this.lineVars.fromNick,
          userhost: this.lineVars.fromIdent + "@" + this.lineVars.fromHost,
          act: this.lineVars.cmd
        });
        break;
      case "KICK":
        if (this.lineVars.params == this.moo.currentNick) {
          this.moo.joinCommand(this.lineVars.to);
        }
        this.moo.logEvent({
          target: this.lineVars.to,
          nick: this.lineVars.fromNick,
          userhost: this.lineVars.fromIdent + "@" + this.lineVars.fromHost,
          act: this.lineVars.cmd,
          text: this.lineVars.params + ":" + this.lineVars.text
        });
        this.nameListRemove();
        break;
      case "PART":
        this.moo.logEvent({
          target: this.lineVars.to,
          nick: this.lineVars.fromNick,
          userhost: this.lineVars.fromIdent + "@" + this.lineVars.fromHost,
          act: this.lineVars.cmd,
          text: this.lineVars.text
        });
        this.nameListRemove();
        break;
      case "NICK":
        this.moo.logEvent({
          nick: this.lineVars.fromNick,
          userhost: this.lineVars.fromIdent + "@" + this.lineVars.fromHost,
          act: this.lineVars.cmd,
          text: this.lineVars.text
        });
        break;
      case "TOPIC":
        this.moo.logEvent({
          target: this.lineVars.to,
          nick: this.lineVars.fromNick,
          userhost: this.lineVars.fromIdent + "@" + this.lineVars.fromHost,
          act: this.lineVars.cmd,
          text: this.lineVars.text
        });
        break;
      case "MODE": // :mikk36!~mikk36@68.32.305.16.dyn.estpak.ee MODE #lfs -c
        if (this.lineVars.to[0] == "#") {
          this.moo.logEvent({
            target: this.lineVars.to,
            nick: this.lineVars.fromNick,
            userhost: this.lineVars.fromIdent + "@" + this.lineVars.fromHost,
            act: this.lineVars.cmd,
            text: this.lineVars.params
          });
        }
        var params = this.lineVars.params.split(" ");
        if (params.length > 1) {
          var side = "";
          var sides = ["+", "-"];
          var modes = ["o", "v"];
          var paramNumber = 0;
          for (var i = 0; i < params[0].length; i++) {
            if (sides.indexOf(params[0][i]) !== -1) {
              side = params[0][i];
            } else {
              paramNumber++;
              if (modes.indexOf(params[0][i]) !== -1) {
                if (params[paramNumber] !== undefined) {
                  var currentMode = this.nameList[params[paramNumber]].mode.indexOf(params[0][i]);
                  if (side == "+") {
                    if (currentMode === -1) {
                      this.nameList[params[paramNumber]].mode.push(params[0][i]);
                    }
                  } else {
                    if (currentMode !== -1) {
                      this.nameList[params[paramNumber]].mode.splice(currentMode, 1);
                    }
                  }
                }
              }
            }
          }
        }
        break;
    }
  }

  nameListPopulate() {
    if (this.nameListComplete === false) {
      var data = this.lineVars.raw.split(" ");
      var modes = {};
      modes["+"] = "v";
      modes["@"] = "o";
      var name = data[7];
      var ident = data[4];
      var host = data[5];
      var mode = data[8].substr(-1);
      this.nameList[name] = {
        mask: ident + "@" + host,
        mode: []
      };
      if (modes[mode] !== undefined) {
        mode = modes[mode];
        if (this.nameList[name].mode.indexOf(mode) === -1) {
          this.nameList[name].mode.push(mode);
        }
      }
    }
  }

  nameListAdd() {
    this.nameList[this.lineVars.fromNick] = {
      mask: this.lineVars.fromIdent + "@" + this.lineVars.fromHost,
      mode: []
    };
  }

  nameListRemove() {
    delete this.nameList[this.lineVars.fromNick];
  }

  static is_numeric(mixed_var) {
    return (typeof(mixed_var) === "number" || typeof(mixed_var) === "string") && mixed_var !== "" && !isNaN(mixed_var);
  }

}

MessageParser.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = MessageParser;
