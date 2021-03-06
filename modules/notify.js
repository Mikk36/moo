/**
 * Created by Mikk on 5.07.2015.
 */
"use strict";

var BaseModule = require("./baseModule");
var Moment = require('moment');
Moment.locale("et");

class Notify extends BaseModule {
  /**
   * @param {Moo} moo
   */
  constructor(moo) {
    super();
    this.moo = moo;
    this.config = this.moo.config;
    this.db = this.moo.mongo;

    this.moo.parser.on("privMsg", this.messageHandler.bind(this));
    this.moo.parser.on("message", this.reminderHandler.bind(this));
  }

  /**
   * @param {Object} lineVars
   */
  messageHandler(lineVars) {
    var input = Notify.explode(lineVars.text, " ", 3);

    if (input[0] === "!tell") {
      var replyTo = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
      var to = input[1];
      var message = input[2];
      var from = lineVars.fromNick;

      this.db.storeNotification(from, to, message);
      this.moo.privmsgCommand(replyTo, from + ", annan teada, kui " + to + " kohal on.");
    }
  }

  /**
   * @param {Object} lineVars
   */
  reminderHandler(lineVars) {
    if (lineVars.cmd === "PRIVMSG" || "JOIN" || "NICK") {
      var from = lineVars.fromNick;
      if (lineVars.cmd === "NICK") {
        from = lineVars.text;
      }
      this.db.getNotifications(from).then((data) => {
        var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : from);
        data.forEach((notification) => {
          this.moo.privmsgCommand(to, notification.to + ": " + Moment(notification.time).fromNow() + " <" + notification.from + "> " + notification.message);
        });
      });
    }
  }
}

module.exports = Notify;
