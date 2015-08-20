/**
 * Created by Mikk on 20.08.2015.
 */
var util = require("util");
var BaseModule = require("./baseModule");
var Moment = require('moment');
Moment.locale("et");

class Seen extends BaseModule {
  /**
   * @param {Moo} moo
   */
  constructor(moo) {
    super();
    this.moo = moo;
    this.config = this.moo.config;

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
   * @param {string} nick
   * @returns {Promise}
   */
  getLastMessage(nick) {
    return new Promise(function (resolve, reject) {
      if (this.db === undefined) {
        reject("DB not available");
      } else {
        this.db.collection(this.config.logCollection, function (err, collection) {
          if (err) {
            reject(err);
            return;
          }
          collection.findOne({
            nick: {$regex: new RegExp('^' + nick + '$', "i")},
            act: "PRIVMSG"
          }, {
            sort: {
              _id: -1
            }
          }).then(function (document) {
            if (document) {
              resolve(document);
            } else {
              reject("No entries found");
            }
          });
        });
      }
    }.bind(this));
  }

  /**
   * @param {Object} lineVars
   */
  messageHandler(lineVars) {
    var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
    var input = Seen.explode(lineVars.text, " ", 2);

    if (input[0] === "!seen") {
      this.getLastMessage(input[1]).then(function (document) {
        this.moo.privmsgCommand(to, document.nick + " oli viimati näha " + document.target + " kanalis " + Moment(document.time).fromNow() + ", kui ta ütles \"" + document.text + "\"");
      }.bind(this)).catch(function () {
        this.moo.privmsgCommand(to, "Ei leidnud midagi kasutaja " + input[1] + " kohta");
      }.bind(this));
    }
  }
}

module.exports = Seen;
