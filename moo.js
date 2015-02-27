/*
  Moo v3, this time in node.js instead of PHP
  
  @author Mikk Kiilasp‰‰ <mikk36@mikk36.eu>
*/

var util = require("util");

function Moo() {
  var self = this;
  self.startTime = Date.now();
  self.net = require("net");
  self.iconv = require("iconv-lite");
  self.shutDown = false;
  self.connection = {};
  self.name = "Moo";
  self.currentNick = "";
  self.configuration = require("./config.js");
  self.config = function(name) {
    return self.configuration.getOption(name);
  };
  self.webServer = new (require("./webServer.js"))(self);
  self.parser = new (require("./messageParser.js"))(self);
  self.incomingData = "";
  self.mysql = require("mysql");
  self.db = self.mysql.createConnection({
    host:     self.config("sqlHost"),
    user:     self.config("sqlUser"),
    password: self.config("sqlPass"),
    database: self.config("sqlDB")
  });
  
  self.MySQLHandler = function() {
    self.db = self.mysql.createConnection({
      host:     self.config("sqlHost"),
      user:     self.config("sqlUser"),
      password: self.config("sqlPass"),
      database: self.config("sqlDB")
    });
    self.db.connect(function(err) {
      if(err) {
        util.log("Error connecting to DB: " + err.code);
        setTimeout(self.MySQLHandler, 2000);
      } else {
        util.log("Connection to DB established");
      }
    });
    
    self.db.on("error", function(err) {
      if (!err.fatal) {
        util.log("Error: " + err.message);
        return;
      }

      if (err.code !== "PROTOCOL_CONNECTION_LOST") {
        util.log("Mysql error not \"Connection lost\" !?");
        util.log("Error: " + err.message);
        
        self.db.end();
      }

      util.log("Re-connecting MySQL connection: " + err.stack);
      
      self.MySQLHandler();
    });
  };
  self.MySQLHandler();
  
  // Set up IRC socket
  var net = require("net");
  self.socket = new net.Socket();
  self.socket.setTimeout(self.config("silenceTimeout") * 1000);
  
  // Connection established
  self.socket.on("connect", function() {
    util.log("Connected");
    var that = self;
    setTimeout(function() {
      util.log("Setting nick");
      that.nickCommand(that.config("nick"));
      util.log("Setting user");
      that.userCommand();
    }, 1000);
  });
  
  // Incoming data!
  self.socket.on("data", function(data) {
    var data_ = data.toString();
    if(escape(data_).indexOf("%uFFFD") !== -1) {
      data_ = self.iconv.decode(data, "iso885913");
    }
    self.incomingData += data_;
    self.processData();
  });
  
  self.socket.on("timeout", function() {
    self.socket.destroy();
  });
  
  self.socket.on("close", function(had_error) {
    util.log("Socket closed");
    if(self.shutDown === true) {
      process.exit();
    }
    
    setTimeout(function() {
      self.connect();
    }, 5000);
  });
  
  self.socket.on("error", function(error) {
    util.log("Error " + error.name + ": " + error.message);
  });
  
  self.connect = function() {
    util.log("Connecting");
    self.socket.setNoDelay();
    self.socket.connect(self.config("ircPort"), self.config("ircServer"));
  };
  
  self.quit = function() {
    util.log("Shutting down");
    self.shutDown = true;
    self.quitCommand();
  };
  
  self.raw = function(data) {
    self.socket.write(data, "utf8", function() {
      util.log("-> " + data.trim());
    });
  };
  
  self.processData = function() {
    var line;
    while(line = self.getLine()) {
      self.parser.processLine(line);
    }
  };
  
  self.checkLines = function() {
    var lineBreak = self.incomingData.indexOf("\n");
    //util.log("Line break: " + lineBreak);
    if(lineBreak !== -1) {
      return lineBreak;
    }
    
    return false;
  };
  
  self.getLine = function() {
    if(self.checkLines() === false) {
      return false;
    }
    
    var lineBreak = self.incomingData.indexOf("\r\n");
    var crlfLen = 2;
    if(lineBreak === -1) {
      lineBreak = self.incomingData.indexOf("\n");
      crlfLen = 1;
    }
    
    var line = self.incomingData.substring(0, lineBreak);
    self.incomingData = self.incomingData.substring(lineBreak + crlfLen);
    return line;
  };
  
  self.authenticate = function() {
    self.privmsgCommand("nickserv", "identify " + self.config("nick") + " " + self.config("nickservPassword"));
  };

  self.ghostNick = function() {
    self.privmsgCommand("nickserv", "ghost " + self.config("nick") + " " + self.config("nickservPassword"));
    var that = self;
    setTimeout(function() {
      that.nickCommand(that.config("nick"));
    }, 1000);
  };

  // Commands
  self.nickCommand = function(nick) {
    self.raw("NICK " + nick + "\n");
    self.currentNick = nick;
  };

  self.userCommand = function() {
    self.raw("USER " + self.config("ident") + " 0 * :" + self.config("ircRealName") + "\n");
  };

  self.quitCommand = function() {
    self.raw("QUIT :" + self.config("ircQuitMsg") + "\n");
  };

  self.pongCommand = function() {
    self.raw("PONG\n");
  };

  self.joinCommand = function(channel, key) {
    self.raw("JOIN " + channel + ((key !== undefined) ? " " + key : "") + "\n");
  };

  self.privmsgCommand = function(to, msg) {
    var lines = msg.trim().split("\n");
    for(var i in lines) {
      self.raw("PRIVMSG " + to + " :" + lines[i] + "\n");
      
      self.logEvent({
        target: to,
        nick: self.config("nick"),
        userhost: (self.parser.nameList[self.currentNick] !== undefined ? self.parser.nameList[self.currentNick].mask : null),
        act: "PRIVMSG",
        text: lines[i]
      });
    }
  };

  self.noticeCommand = function(to, msg) {
    self.raw("NOTICE " + to + " :" + msg + "\n");
  };

  self.kickCommand = function(where, who, msg) {
    self.raw("KICK " + where + " " + who + ((msg !== undefined) ? " :" + msg : ""));
  };

  self.banCommand = function(where, who, ban) {
    if(ban === undefined) {
      ban = true;
    }
    
    self.raw("MODE " + where + " " + (ban ? "+b" : "-b") + " " + who + "\n");
  };

  self.whoisCommand = function(who) {
    self.raw("WHOIS " + who + "\n");
  };

  self.whoCommand = function(what) {
    self.raw("WHO " + what + "\n");
  };
  
  // Logging
  self.logEvent = function(data) {
    if(data.act === undefined || data.act.length === 0) {
      return new Error("act must be specified");
    }
    
    var allowedList = new Array("target", "nick", "userhost", "act", "text");
    var dbData = {};
    for(var prop in data) {
      if(allowedList.indexOf(prop) === -1) {
        return new Error("Unknown data key: '" + prop + "'");
      }
      dbData[prop] = data[prop];
    }
    
    var query = self.db.query("INSERT INTO logs SET ?", dbData, function() {});
    //util.log(query);
  };
  
  // Modules
  self.modules = {};
  
  self.modules.knowledge = new (require("./modules/knowledge.js"))(self);
  self.modules.calculator = new (require("./modules/calculator.js"))(self);
  self.modules.google = new (require("./modules/google.js"))(self);
  self.modules.bing = new (require("./modules/bing.js"))(self);
  self.modules.youtube = new (require("./modules/youtube.js"))(self);
  self.modules.wolframAlpha = new (require("./modules/wolframAlpha.js"))(self);
}

var moo = new Moo();
moo.connect();

process.stdin.resume();
process.stdin.setEncoding("utf8");
 
process.stdin.on("data", function (chunk) {
  var data = chunk.trim();
  if(data == "quit") {
    moo.quit();
    return;
  }
  moo.raw(data + "\n");
});