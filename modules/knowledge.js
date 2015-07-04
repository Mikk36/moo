/*
 Knowledge module

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */
var util = require("util");
var BaseModule = require("./baseModule");

class Knowledge extends BaseModule {
  constructor(moo) {
    super();
    this.moo = moo;

    this.learnReplies = [
      'I learn new things!',
      'Teach me!',
      'Touch me!',
      'More, I need more!',
      'Thank You, Master!'
    ];

    this.forgetReplies = [
      'Yay, less trash in my head!',
      'Never heard about this, right?',
      'General public must not know about this!'
    ];

    this.forgetFailReplies = [
      "You've been mistaken here",
      "What!?"
    ];

    moo.parser.on("privMsg", this.messageHandler.bind(this));
  }

  messageHandler(lineVars) {
    var input = Knowledge.explode(lineVars.text, " ", 3);
    var to;
    var self = this;
    if (input[0] === "!learn") {
      to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
      // Are you op in my channel?
      if (this.moo.parser.nameList[lineVars.fromNick] !== undefined && this.moo.parser.nameList[lineVars.fromNick].mode.indexOf("o") !== -1) {
        // Missing parameters?
        if (input.length < 3) {
          this.moo.privmsgCommand(to, "Syntax: <question> <answer>");
        } else {
          // Do we have a definition with the same name already?
          this.moo.db.query("SELECT answer FROM definitions WHERE question = ? LIMIT 1", [input[1]], function (err, result) {
            if (err !== null) {
              self.moo.privmsgCommand(to, "Something went wrong here: " + err.toString());
            } else {
              var learnQuery = "";
              if (result.length > 0) {
                learnQuery = "UPDATE definitions SET answer = " + self.moo.db.escape(input[2]) + " WHERE question = " + self.moo.db.escape(input[1]);
              } else {
                learnQuery = "INSERT INTO definitions  (question, answer, created) VALUES (" + self.moo.db.escape(input[1]) + ", " + self.moo.db.escape(input[2]) + ", CURRENT_TIMESTAMP)";
              }
              self.moo.db.query(learnQuery, function (err2, result2) {
                if (err2 !== null) {
                  self.moo.privmsgCommand(to, "Something went wrong here: " + err2.toString());
                } else {
                  self.moo.privmsgCommand(to, self.getRandomLearnReply());
                }
              });
            }
          });
        }
      } else {
        this.moo.privmsgCommand(to, "noob");
      }
    } else if (input[0] === "!forget") {
      to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
      // Are you op in my channel?
      if (this.moo.parser.nameList[lineVars.fromNick] !== undefined && this.moo.parser.nameList[lineVars.fromNick].mode.indexOf("o") !== -1) {
        // Missing parameters?
        if (input.length < 2) {
          this.moo.privmsgCommand(to, "Syntax: <question>");
        } else {
          // Does the definition even exist?
          this.moo.db.query("SELECT answer FROM definitions WHERE question = ? LIMIT 1", [input[1]], function (err, result) {
            if (err !== null) {
              self.moo.privmsgCommand(to, "Something went wrong here: " + err.toString());
            } else {
              var forgetQuery = "";
              if (result.length > 0) {
                forgetQuery = "DELETE FROM definitions WHERE question = " + self.moo.db.escape(input[1]);
                self.moo.db.query(forgetQuery, function (err2, result2) {
                  if (err2 !== null) {
                    self.moo.privmsgCommand(to, "Something went wrong here: " + err2.toString());
                  } else {
                    self.moo.privmsgCommand(to, self.getRandomForgetReply());
                  }
                });
              } else {
                self.moo.privmsgCommand(to, self.getRandomForgetFailReply());
              }
            }
          });
        }
      } else {
        this.moo.privmsgCommand(to, "noob");
      }
    } else if (input[0] === "!change") {
      to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
      // Are you op in my channel?
      if (this.moo.parser.nameList[lineVars.fromNick] !== undefined && this.moo.parser.nameList[lineVars.fromNick].mode.indexOf("o") !== -1) {
        // Missing parameters?
        if (input.length < 3) {
          this.moo.privmsgCommand(to, "Syntax: <question> <what to add>");
        } else {
          // Does the definition even exist?
          this.moo.db.query("SELECT answer FROM definitions WHERE question = ? LIMIT 1", [input[1]], function (err, result) {
            if (err !== null) {
              self.moo.privmsgCommand(to, "Something went wrong here: " + err.toString());
            } else {
              var changeQuery = "";
              if (result.length > 0) {
                changeQuery = "UPDATE definitions SET answer = CONCAT(answer, ' | ', " + self.moo.db.escape(input[2]) + ") WHERE question = " + self.moo.db.escape(input[1]);
                self.moo.db.query(changeQuery, function (err2, result2) {
                  if (err2 !== null) {
                    self.moo.privmsgCommand(to, "Something went wrong here: " + err2.toString());
                  } else {
                    self.moo.privmsgCommand(to, self.getRandomLearnReply());
                  }
                });
              } else {
                self.moo.privmsgCommand(to, self.getRandomForgetFailReply());
              }
            }
          });
        }
      } else {
        this.moo.privmsgCommand(to, "noob");
      }
    } else if (input.length === 1 && input[0].charAt(input[0].length - 1) === "?") {
      this.moo.db.query("SELECT answer FROM definitions WHERE question = ? LIMIT 1", [input[0].substr(0, input[0].length - 1)], function (err, result) {
        if (result.length > 0) {
          var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
          self.moo.privmsgCommand(to, result[0].answer);
        }
        console.log(err);
      });
    }
  }

  static getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getRandomLearnReply() {
    return this.learnReplies[Knowledge.getRandomInt(0, this.learnReplies.length - 1)];
  }

  getRandomForgetReply() {
    return this.forgetReplies[Knowledge.getRandomInt(0, this.forgetReplies.length - 1)];
  }

  getRandomForgetFailReply() {
    return this.forgetFailReplies[Knowledge.getRandomInt(0, this.forgetFailReplies.length - 1)];
  }
}

module.exports = Knowledge;
