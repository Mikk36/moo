/*
  Knowledge module
  
  @author Mikk Kiilaspää <mikk36@mikk36.eu>
*/
var util = require("util");

module.exports = Knowledge;

function Knowledge(parent) {
  var self = this;
  self.parent = parent;

  self.learnReplies = new Array(
    'I learn new things!',
    'Teach me!',
    'Touch me!',
    'More, I need more!',
    'Thank You, Master!'
  );

  self.forgetReplies = new Array(
    'Yay, less trash in my head!',
    'Never heard about this, right?',
    'General public must not know about this!'
  );

  self.forgetFailReplies = new Array(
    "You've been mistaken here",
    "What!?"
  );
  
  parent.parser.on("privMsg", function(lineVars) {
    var input = self.explode(lineVars.text, " ", 3);
    
    if(input[0] === "!learn") {
      var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
      // Are you op in my channel?
      if(self.parent.parser.nameList[lineVars.fromNick] !== undefined && self.parent.parser.nameList[lineVars.fromNick].mode.indexOf("o") !== -1) {
        // Missing parameters?
        if(input.length < 3) {
          self.parent.privmsgCommand(to, "Syntax: <question> <answer>");
        } else {
          // Do we have a definition with the same name already?
          self.parent.db.query("SELECT answer FROM definitions WHERE question = ? LIMIT 1", [input[1]], function(err, result) {
            if(err !== null) {
              self.parent.privmsgCommand(to, "Something went wrong here: " + err.toString());
            } else {
              var learnQuery = "";
              if(result.length > 0) {
                learnQuery = "UPDATE definitions SET answer = " + self.parent.db.escape(input[2]) + " WHERE question = " + self.parent.db.escape(input[1]);
              } else {
                learnQuery = "INSERT INTO definitions  (question, answer, created) VALUES (" + self.parent.db.escape(input[1]) + ", " + self.parent.db.escape(input[2]) + ", CURRENT_TIMESTAMP)";
              }
              self.parent.db.query(learnQuery, function(err2, result2) {
                if(err2 !== null) {
                  self.parent.privmsgCommand(to, "Something went wrong here: " + err2.toString());
                } else {
                  self.parent.privmsgCommand(to, self.getRandomLearnReply());
                }
              });
            }
          });
        }
      } else {
        self.parent.privmsgCommand(to, "noob");
      }
    } else if(input[0] === "!forget") {
      var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
      // Are you op in my channel?
      if(self.parent.parser.nameList[lineVars.fromNick] !== undefined && self.parent.parser.nameList[lineVars.fromNick].mode.indexOf("o") !== -1) {
        // Missing parameters?
        if(input.length < 2) {
          self.parent.privmsgCommand(to, "Syntax: <question>");
        } else {
          // Does the definition even exist?
          self.parent.db.query("SELECT answer FROM definitions WHERE question = ? LIMIT 1", [input[1]], function(err, result) {
            if(err !== null) {
              self.parent.privmsgCommand(to, "Something went wrong here: " + err.toString());
            } else {
              var forgetQuery = "";
              if(result.length > 0) {
                forgetQuery = "DELETE FROM definitions WHERE question = " + self.parent.db.escape(input[1]);
                self.parent.db.query(forgetQuery, function(err2, result2) {
                  if(err2 !== null) {
                    self.parent.privmsgCommand(to, "Something went wrong here: " + err2.toString());
                  } else {
                    self.parent.privmsgCommand(to, self.getRandomForgetReply());
                  }
                });
              } else {
                self.parent.privmsgCommand(to, self.getRandomForgetFailReply());
              }
            }
          });
        }
      } else {
        self.parent.privmsgCommand(to, "noob");
      }
    } else if(input[0] === "!change") {
      var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
      // Are you op in my channel?
      if(self.parent.parser.nameList[lineVars.fromNick] !== undefined && self.parent.parser.nameList[lineVars.fromNick].mode.indexOf("o") !== -1) {
        // Missing parameters?
        if(input.length < 3) {
          self.parent.privmsgCommand(to, "Syntax: <question> <what to add>");
        } else {
          // Does the definition even exist?
          self.parent.db.query("SELECT answer FROM definitions WHERE question = ? LIMIT 1", [input[1]], function(err, result) {
            if(err !== null) {
              self.parent.privmsgCommand(to, "Something went wrong here: " + err.toString());
            } else {
              var changeQuery = "";
              if(result.length > 0) {
                changeQuery = "UPDATE definitions SET answer = CONCAT(answer, ' | ', " + self.parent.db.escape(input[2]) + ") WHERE question = " + self.parent.db.escape(input[1]);
                self.parent.db.query(changeQuery, function(err2, result2) {
                  if(err2 !== null) {
                    self.parent.privmsgCommand(to, "Something went wrong here: " + err2.toString());
                  } else {
                    self.parent.privmsgCommand(to, self.getRandomLearnReply());
                  }
                });
              } else {
                self.parent.privmsgCommand(to, self.getRandomForgetFailReply());
              }
            }
          });
        }
      } else {
        self.parent.privmsgCommand(to, "noob");
      }
    } else if(input.length === 1 && input[0].charAt(input[0].length-1) === "?") {
      self.parent.db.query("SELECT answer FROM definitions WHERE question = ? LIMIT 1", [input[0].substr(0, input[0].length - 1)], function(err, result) {
        if(result.length > 0) {
          var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
          self.parent.privmsgCommand(to, result[0].answer);
        }
        console.log(err);
      });
    }
  });
  
  self.getRandomInt = function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  
  self.getRandomLearnReply = function() {
    return self.learnReplies[self.getRandomInt(0, self.learnReplies.length - 1)];
  };
  
  self.getRandomForgetReply = function() {
    return self.forgetReplies[self.getRandomInt(0, self.forgetReplies.length - 1)];
  };
  
  self.getRandomForgetFailReply = function() {
    return self.forgetFailReplies[self.getRandomInt(0, self.forgetFailReplies.length - 1)];
  };
  
  self.explode = function(input, delimiter, limit) {
    var s = input.split( delimiter );
    if (limit > 0) {
      if (limit >= s.length) {
        return s;
      }
      return s.slice(0, limit - 1).concat([s.slice(limit - 1).join(delimiter)]);
    }
    return s;
  };
}