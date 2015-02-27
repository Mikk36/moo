/*
  MessageParser
  
  @author Mikk Kiilasp‰‰ <mikk36@mikk36.eu>
*/
var events = require("events");
var util = require("util");

module.exports = MessageParser;

function MessageParser(parent) {
  events.EventEmitter.call(this);
  var self = this;
  self.nameList = {};
  self.nameListComplete = true;
  self.lineVars = {};
  self.parent = parent;
  self.config = parent.config;
  
  self.processLine = function(rawLine) {
    
    util.log("<- " + rawLine);
    //util.log("UTF-8 decoded <- " + decodeURIComponent(escape(rawLine)));
    
    if(rawLine[0] !== ":") {
      rawLine = ":Server " + rawLine;
    }
    line = rawLine.substring(1);
    var parts = line.split(" ", 3);
    
    var params = line.substring(parts[0].length + parts[1].length + parts[2].length + 3);
    
    if(params.indexOf(":") !== -1) {
      params = params.substr(0, params.indexOf(" :"));
    }
    // :moo!~moo@cjfda.lakrito.ee JOIN #fuba1
    var offset1 = parts[0].indexOf("!");
    var offset2 = offset1 + 1;
    var offset3 = parts[0].indexOf("@") + 1;
    var offset4 = offset3 - offset2 - 1;
    var offset5 = line.indexOf(" :") + 2;
    
    self.lineVars = {
      from:       parts[0],
      fromNick:   parts[0].substr(0, offset1),
      fromIdent:  parts[0].substr(offset2, offset4),
      fromHost:   parts[0].substr(offset3),
      cmd:        parts[1],
      to:         parts[2],
      text:       line.substr(offset5),
      params:     params.trim(),
      raw:        rawLine
    };
    
    if(offset5 === 1) {
      self.lineVars.text = "";
    }
    
    if(is_numeric(self.lineVars.cmd)) {
      self.parseServerMessage();
      self.emit("serverMessage", self.lineVars);
    } else {
      self.parseMessage();
      self.emit("message", self.lineVars);
    }
    if(self.lineVars.cmd === "PRIVMSG") {
      self.emit("privMsg", self.lineVars);
    }
  };
  
  self.parseServerMessage = function() {
    //util.log(self.lineVars);
    var cmd = parseInt(self.lineVars.cmd);
    switch(cmd) {
      case 001: // I have successfully connected to the server
        // Do nothing yet
        break;
      case 376: // RPL_ENDOFMOTD
        self.parent.authenticate();
        var that = self;
        setTimeout(function() {
          that.parent.joinCommand(that.config("ircChannel"));
        }, 1000);
        
        break;
      case 433: // ERR_NICKNAMEINUSE
      case 436: // ERR_NICKCOLLISION
        self.parent.nickCommand(self.config("nick") + "_" + (100 + Math.floor(Math.random() * 900)));
        self.parent.ghostNick();
        break;
      case 332: // RPL_TOPIC
        self.parent.logEvent({
          target:   self.lineVars.params,
          act:      self.lineVars.cmd,
          text:     self.lineVars.text
        });
        break;
      case 333: // Info of person who set the last topic
        var logSource = self.lineVars.raw.split(" ");
        var setter = logSource[4].split("!");
        self.parent.logEvent({
          target:   logSource[3],
          nick:     setter[0],
          userhost: setter[1],
          act:      self.lineVars.cmd,
          text:     logSource[5]
        });
        break;
      case 352: // RPL_WHOREPLY
        // Populate current channel users list
        self.nameListPopulate();
        break;
      case 315: // RPL_ENDOFWHO
        // End of current channel users list
        self.nameListComplete = true;
        break;
      case 474: // ERR_BANNEDFROMCHAN
        self.parent.privmsgCommand("ChanServ", "UNBAN " + self.config("ircChannel"));
        self.parent.joinCommand(that.config("ircChannel"));
        break;
      case 311: // RPL_WHOISUSER
    };
  };
  
  self.parseMessage = function() {
    //util.log(self.lineVars);
    switch(self.lineVars.cmd) {
      case "PING":
        if(self.lineVars.from == "Server") {
          self.parent.pongCommand();
        }
        break;
      case "PRIVMSG":
        self.parent.logEvent({
          target:   self.lineVars.to,
          nick:     self.lineVars.fromNick,
          userhost: self.lineVars.fromIdent + "@" + self.lineVars.fromHost,
          act:      self.lineVars.cmd,
          text:     self.lineVars.text
        });
        
        if(self.lineVars.text.toLowerCase() == "quit()" && self.config("adminUsers").indexOf(self.lineVars.fromNick.toLowerCase()) !== -1) {
          self.parent.quit();
        }
        
        if(self.lineVars.to[0] !== "#") {
          var ctcpCheck = self.lineVars.text.split(" ", 1);
          switch(escape(ctcpCheck)) {
            case "%01FINGER%01":
              self.parent.noticeCommand(self.lineVars.fromNick, "Stop touching me!");
              break;
            case "%01VERSION%01":
              self.parent.noticeCommand(self.lineVars.fromNick, String.fromCharCode(1) + "VERSION Moo 3.0 powered by Node.js" + String.fromCharCode(1));
              break;
            case "%01PING":
              self.parent.noticeCommand(self.lineVars.fromNick, self.lineVars.text);
              break;
            case "%01TIME%01":
              self.parent.noticeCommand(self.lineVars.fromNick, String.fromCharCode(1) + " :" + (new Date().toISOString()) + String.fromCharCode(1));
              break;
          }
        }
        break;
      case "QUIT":
        self.parent.logEvent({
          nick:     self.lineVars.fromNick,
          userhost: self.lineVars.fromIdent + "@" + self.lineVars.fromHost,
          act:      self.lineVars.cmd,
          text:     self.lineVars.text
        });
        break;
      case "NOTICE":
        break;
      case "JOIN":
        if(self.lineVars.fromNick === self.parent.currentNick) {
          self.nameListComplete = false;
          self.nameList = {};
          self.parent.whoCommand(self.lineVars.to);
        }
        self.nameListAdd();
        
        self.parent.logEvent({
          target:   self.lineVars.to,
          nick:     self.lineVars.fromNick,
          userhost: self.lineVars.fromIdent + "@" + self.lineVars.fromHost,
          act:      self.lineVars.cmd
        });
        break;
      case "KICK":
        if(self.lineVars.params == self.parent.currentNick) {
          self.parent.joinCommand(self.lineVars.to);
        }
        self.parent.logEvent({
          target:   self.lineVars.to,
          nick:     self.lineVars.fromNick,
          userhost: self.lineVars.fromIdent + "@" + self.lineVars.fromHost,
          act:      self.lineVars.cmd,
          text:     self.lineVars.params + ":" + self.lineVars.text
        });
        self.nameListRemove();
        break;
      case "PART":
        self.parent.logEvent({
          target:   self.lineVars.to,
          nick:     self.lineVars.fromNick,
          userhost: self.lineVars.fromIdent + "@" + self.lineVars.fromHost,
          act:      self.lineVars.cmd,
          text:     self.lineVars.text
        });
        self.nameListRemove();
        break;
      case "NICK":
        self.parent.logEvent({
          nick:     self.lineVars.fromNick,
          userhost: self.lineVars.fromIdent + "@" + self.lineVars.fromHost,
          act:      self.lineVars.cmd,
          text:     self.lineVars.text
        });
        break;
      case "TOPIC":
        self.parent.logEvent({
          target:   self.lineVars.to,
          nick:     self.lineVars.fromNick,
          userhost: self.lineVars.fromIdent + "@" + self.lineVars.fromHost,
          act:      self.lineVars.cmd,
          text:     self.lineVars.text
        });
        break;
      case "MODE": // :mikk36!~mikk36@68.32.305.16.dyn.estpak.ee MODE #lfs -c
        if(self.lineVars.to[0] == "#") {
          self.parent.logEvent({
            target:   self.lineVars.to,
            nick:     self.lineVars.fromNick,
            userhost: self.lineVars.fromIdent + "@" + self.lineVars.fromHost,
            act:      self.lineVars.cmd,
            text:     self.lineVars.params
          });
        }
        var params = self.lineVars.params.split(" ");
        if(params.length > 1) {
          var side = "";
          var sides = new Array("+", "-");
          var modes = new Array("o", "v");
          var paramNumber = 0;
          for(var i = 0; i < params[0].length; i++) {
            if(sides.indexOf(params[0][i]) !== -1) {
              side = params[0][i];
            } else {
              paramNumber++;
              if(modes.indexOf(params[0][i]) !== -1) {
                if(params[paramNumber] !== undefined) {
                  var currentMode = self.nameList[params[paramNumber]].mode.indexOf(params[0][i]);
                  if(side == "+") {
                    if(currentMode === -1) {
                      self.nameList[params[paramNumber]].mode.push(params[0][i]);
                    }
                  } else {
                    if(currentMode !== -1) {
                      self.nameList[params[paramNumber]].mode.splice(currentMode, 1);
                    }
                  }
                }
              }
            }
          }
        }
        break;
    }
  };
  
  self.nameListPopulate = function() {
    if(self.nameListComplete === false) {
      var data = self.lineVars.raw.split(" ");
      var modes = {};
      modes["+"] = "v";
      modes["@"] = "o";
      var name = data[7];
      var ident = data[4];
      var host = data[5];
      var mode = data[8].substr(-1);
      self.nameList[name] = {
        mask: ident + "@" + host,
        mode: new Array()
      };
      if(modes[mode] !== undefined) {
        mode = modes[mode];
        if(self.nameList[name].mode.indexOf(mode) === -1) {
          self.nameList[name].mode.push(mode);
        }
      }
    }
  };
  
  self.nameListAdd = function() {
    self.nameList[self.lineVars.fromNick] = {
      mask: self.lineVars.fromIdent + "@" + self.lineVars.fromHost,
      mode: new Array()
    };
  };
  
  self.nameListRemove = function() {
    delete self.nameList[self.lineVars.fromNick];
  };
  
  function is_numeric (mixed_var) {
    return (typeof(mixed_var) === "number" || typeof(mixed_var) === "string") && mixed_var !== "" && !isNaN(mixed_var);
  }

};

MessageParser.prototype.__proto__ = events.EventEmitter.prototype;