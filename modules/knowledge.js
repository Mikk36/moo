/*
 Knowledge module

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */
"use strict";
var util = require("util");
var BaseModule = require("./baseModule");

class Knowledge extends BaseModule {
  /**
   * @param {Moo} moo
   */
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

  /**
   * Store the reference to the database when it has connected
   * @param {Db} db
   */
  mongoConnected(db) {
    this.db = db;
  }

  /**
   * Fetch an answer from the database
   * @param {string} question
   * @returns {Promise}
   */
  getAnswer(question) {
    return new Promise((resolve, reject) => {
      if (this.db === undefined) {
        reject("DB not available");
      } else {
        this.db.collection(this.config.knowledgeCollection, (err, collection) => {
          if (err) {
            reject(err);
            return;
          }
          collection.findOne({question: question}).then((document) => {
            if (document) {
              resolve(document.answer);
            } else {
              reject("No answers found");
            }
          });
        });
      }
    });
  }

  /**
   * Save an answer to the database
   * @param {string} question
   * @param {string} answer
   * @returns {Promise}
   */
  setAnswer(question, answer) {
    // TODO: instead of quitting, store for later attempt
    return new Promise((resolve, reject) => {
      if (this.db === undefined) {
        reject();
      } else {
        this.db.collection(this.config.knowledgeCollection, (err, collection) => {
          collection.updateOne({question: question}, {
            question: question,
            answer: answer,
            modified: new Date()
          }, {
            upsert: true
          }).then((result) => {
            resolve(result);
          }).catch((err) => {
            reject(err);
          });
        });
      }
    });

  }

  /**
   * Remove an answer from the database
   * @param {string} question
   * @returns {Promise}
   */
  removeAnswer(question) {
    // TODO: instead of quitting, store for later attempt
    return new Promise((resolve, reject) => {
      if (this.db === undefined) {
        reject();
      } else {
        this.db.collection(this.config.knowledgeCollection, (err, collection) => {
          //noinspection JSCheckFunctionSignatures
          collection.deleteMany({question: question}).then((result) => {
            if (result.deletedCount < 1) {
              reject("None removed");
            } else {
              resolve()
            }
          });
        });
      }
    });
  }

  /**
   * @param {Object} line
   */
  messageHandler(line) {
    var input = Knowledge.explode(line.text, " ", 3);
    var to = (line.to.charAt(0) === "#" ? line.to : line.fromNick);
    switch (input[0]) {
      case "!learn":
        if (!this.commandCheck(to, line.fromNick, input, 3)) {
          break;
        }
        this.setAnswer(input[1], input[2]).then(() => {
          this.respondLearn(to);
        });
        break;
      case "!forget":
        if (!this.commandCheck(to, line.fromNick, input, 2)) {
          break;
        }
        this.removeAnswer(input[1]).then(() => {
          this.respondForget(to);
        }, () => {
          this.respondForgetFail(to);
        });
        break;
      case "!append":
        if (!this.commandCheck(to, line.fromNick, input, 3)) {
          break;
        }
        this.getAnswer(input[1]).then(
          (answer) => {
            return this.setAnswer(input[1], answer + " | " + input[2])
          }, () => {
            this.respondForgetFail(to);
          }
        ).then(
          () => {
            this.respondLearn(to);
          }
        );
        break;
      default:
        if (input.length === 1 && input[0].charAt(input[0].length - 1) === "?") {
          this.getAnswer(input[0].substr(0, input[0].length - 1)).then((answer) => {
            this.moo.privmsgCommand(to, answer);
          }, (error) => {
            util.log(error);
          });
        }
    }
  }

  /**
   * Check if the sender has the permissions and the message meets the requirements
   * @param {string} to
   * @param {string} nick
   * @param {string} input
   * @param {number} length
   * @returns {boolean}
   */
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

  /**
   * Reply with a success for learning
   * @param {string} to
   */
  respondLearn(to) {
    this.moo.privmsgCommand(to, this.getRandomLearnReply());
  }

  /**
   * Reply with a success for forgetting
   * @param {string} to
   */
  respondForget(to) {
    this.moo.privmsgCommand(to, this.getRandomForgetReply());
  }

  /**
   * Reply with a failure for forgetting
   * @param {string} to
   */
  respondForgetFail(to) {
    this.moo.privmsgCommand(to, this.getRandomForgetFailReply());
  }

  /**
   * Reply with a failure for permissions
   * @param {string} to
   */
  respondNoPermission(to) {
    this.moo.privmsgCommand(to, "noob");
  }

  /**
   * Check if the user is an operator
   * @param {string} nick
   * @returns {boolean}
   */
  isOperator(nick) {
    return this.moo.nameList.hasMode(nick, "o");
  }

  /**
   * Get a random integer between min and max
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  static getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Get a random Learn success reply
   * @returns {string}
   */
  getRandomLearnReply() {
    return this.learnReplies[Knowledge.getRandomInt(0, this.learnReplies.length - 1)];
  }

  /**
   * Get a random forget success reply
   * @returns {string}
   */
  getRandomForgetReply() {
    return this.forgetReplies[Knowledge.getRandomInt(0, this.forgetReplies.length - 1)];
  }

  /**
   * Get a random forget fail reply
   * @returns {string}
   */
  getRandomForgetFailReply() {
    return this.forgetFailReplies[Knowledge.getRandomInt(0, this.forgetFailReplies.length - 1)];
  }
}

module.exports = Knowledge;
