/**
 * Created by Mikk on 5.07.2015.
 */

var util = require("util");
var BaseModule = require("./baseModule");
var Moment = require('moment');
Moment.locale("et");

class Notify extends BaseModule {
  constructor(moo) {
    super();
    this.moo = moo;
    this.config = this.moo.config;
    this.moo.mongo.on("connected", this.mongoConnected.bind(this));

    this.moo.parser.on("privMsg", this.messageHandler.bind(this));
    this.moo.parser.on("message", this.reminderHandler.bind(this));
  }

  mongoConnected(db) {
    this.db = db;
  }

  messageHandler(lineVars) {
    var input = Notify.explode(lineVars.text, " ", 3);

    if (input[0] === "!tell") {
      var replyTo = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
      var to = input[1];
      var message = input[2];
      var from = lineVars.fromNick;

      this.storeNotification(from, to, message);
      this.moo.privmsgCommand(replyTo, from + ", annan teada, kui " + to + " kohal on.");
    }
  }

  reminderHandler(lineVars) {
    var self = this;
    if (lineVars.cmd === "PRIVMSG" || "JOIN" || "NICK") {
      var from = lineVars.fromNick;
      if (lineVars.cmd === "NICK") {
        from = lineVars.text;
      }
      this.getNotifications(from).then(function (data) {
        var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
        data.forEach(function (notification) {
          self.moo.privmsgCommand(to, notification.to + ": " + Moment(notification.time).fromNow() + " <" + notification.from + "> " + notification.message);
        });
      });
    }
  }

  storeNotification(from, to, message) {
    if (this.db === undefined) {
      return;
    }
    var collection = this.db.collection(this.config.notifyCollection);
    var time = new Date();


    //noinspection JSDeprecatedSymbols,JSCheckFunctionSignatures
    collection.insert({
      from: from,
      to: to,
      toInsensitive: to.toLowerCase(),
      message: message,
      time: time,
      processed: false
    });
  }

  getNotifications(nick) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var collection = self.db.collection(self.config.notifyCollection);
      //noinspection JSDeprecatedSymbols,JSCheckFunctionSignatures
      collection.find({
        toInsensitive: nick.toLowerCase(),
        processed: false
      }).sort({time: 1}).toArray(function (err, documents) {
        if (err) {
          util.log("Error: " + err);
          reject(err);
        } else {
          if (documents.length == 0) {
            reject("No unprocessed notifications found");
          } else {
            documents.forEach(function (document) {
              //noinspection JSDeprecatedSymbols,JSCheckFunctionSignatures
              collection.update(
                {
                  _id: document._id
                }, {
                  $set: {
                    processed: true
                  }
                }
              );
            });
            resolve(documents);
          }
        }
      });
    });
  }
}

module.exports = Notify;
