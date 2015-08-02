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
    this.config = this.moo.config;

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
    this.moo.mongo.on("connected", this.mongoConnected.bind(this));
    this.moo.parser.on("privMsg", this.messageHandler.bind(this));
  }

  mongoConnected(db) {
    this.db = db;
  }

  getAnswer(question) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (self.db === undefined) {
        reject("DB not available");
      } else {
        var collection = self.db.collection(self.config.knowledgeCollection);
        collection.findOne({question: question}).then(function (document) {
          if (document) {
            resolve(document.answer);
          } else {
            reject("No answers found");
          }
        });
      }
    });
  }

  setAnswer(question, answer) {
    var self = this;
    // TODO: instead of quitting, store for later attempt
    return new Promise(function (resolve, reject) {
      if (self.db === undefined) {
        reject();
      } else {
        var collection = self.db.collection(self.config.knowledgeCollection);
        collection.updateOne({question: question}, {
          question: question,
          answer: answer,
          modified: new Date()
        }, {
          upsert: true
        }).then(function (result) {
          resolve(result);
        }).catch(function (err) {
          reject(err);
        });
      }
    });

  }

  removeAnswer(question) {
    var self = this;
    // TODO: instead of quitting, store for later attempt
    return new Promise(function (resolve, reject) {
      if (self.db === undefined) {
        reject();
      } else {
        var collection = self.db.collection(self.config.knowledgeCollection);
        //noinspection JSCheckFunctionSignatures
        collection.deleteMany({question: question}).then(function (result) {
          if (result.deletedCount < 1) {
            reject("None removed");
          } else {
            resolve()
          }
        });
      }
    });
  }

  messageHandler(line) {
    var self = this;
    var input = Knowledge.explode(line.text, " ", 3);
    var to = (line.to.charAt(0) === "#" ? line.to : line.fromNick);
    switch (input[0]) {
      case "!learn":
        if (!this.commandCheck(to, line.fromNick, input, 3)) {
          break;
        }
        this.setAnswer(input[1], input[2]).then(function () {
          self.respondLearn(to);
        });
        break;
      case "!forget":
        if (!this.commandCheck(to, line.fromNick, input, 2)) {
          break;
        }
        this.removeAnswer(input[1]).then(function () {
          self.respondForget(to);
        }, function () {
          self.respondForgetFail(to);
        });
        break;
      case "!append":
        if (!this.commandCheck(to, line.fromNick, input, 3)) {
          break;
        }
        this.getAnswer(input[1]).then(
          function (answer) {
            return self.setAnswer(input[1], answer + " | " + input[2])
          }, function () {
            self.respondForgetFail(to);
          }
        ).then(
          function () {
            self.respondLearn(to);
          }
        );
        break;
      default:
        if (input.length === 1 && input[0].charAt(input[0].length - 1) === "?") {
          this.getAnswer(input[0].substr(0, input[0].length - 1)).then(function (answer) {
            self.moo.privmsgCommand(to, answer);
          }, function (error) {
            util.log(error);
          });
        }
    }
  }

  commandCheck(to, nick, input, length) {
    if (!this.isOperator(nick)) {
      this.respondNoPermission(to);
      return false;
    }
    if (input.length < length) {
      switch (length) {
        case 2:
          this.moo.privmsgCommand(to, "Syntax: <question>");
          break;
        case 3:
          this.moo.privmsgCommand(to, "Syntax: <question> <answer>");
          break;
      }
      return false;
    }
    return true;
  }

  respondLearn(to) {
    this.moo.privmsgCommand(to, this.getRandomLearnReply());
  }

  respondForget(to) {
    this.moo.privmsgCommand(to, this.getRandomForgetReply());
  }

  respondForgetFail(to) {
    this.moo.privmsgCommand(to, this.getRandomForgetFailReply());
  }

  respondNoPermission(to) {
    this.moo.privmsgCommand(to, "noob");
  }

  isOperator(nick) {
    return this.moo.nameList.hasMode(nick, "o");
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
