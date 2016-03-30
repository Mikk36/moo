/**
 * Created by Mikk on 1.08.2015.
 */
"use strict";
var util = require("util");

class NameList {
  constructor() {
    this.list = {};
    this.complete = true;
  }

  /**
   * Mark the list as being empty
   */
  initializeList() {
    this.complete = false;
    this.list = {};
  }

  /**
   * Mark the list as having been completed
   */
  completeList() {
    this.complete = true;
  }

  /**
   * Add an entry to the list
   * @param {string} line - Raw line from the server
   */
  populate(line) {
    if (this.complete) {
      this.initializeList();
    }
    var data = line.split(" ");
    var modes = {};
    modes["+"] = "v";
    modes["@"] = "o";
    var name = data[7];
    var ident = data[4];
    var host = data[5];
    var mode = data[8].substr(-1);
    this.list[name] = {
      mask: ident + "@" + host,
      mode: []
    };
    if (modes[mode] !== undefined) {
      mode = modes[mode];
      if (this.list[name].mode.indexOf(mode) === -1) {
        this.list[name].mode.push(mode);
      }
    }
  }

  /**
   * Add a nick to the list
   * @param {string} nick
   * @param {string} ident
   * @param {string} host
   */
  addNick(nick, ident, host) {
    this.list[nick] = {
      mask: ident + "@" + host,
      mode: []
    };
  }

  /**
   * Remove a nick from the list
   * @param {string} nick
   */
  removeNick(nick) {
    delete this.list[nick];
  }

  /**
   * Change a nick in the list to a new one
   * @param {string} nick
   * @param {string} newNick
   */
  changeNick(nick, newNick) {
    var oldData = this.list[nick];
    delete this.list[nick];
    this.list[newNick] = oldData;
  }

  /**
   * Check if a user has a specific mode
   * @param {nick} nick
   * @param {string} mode
   * @returns {boolean}
   */
  hasMode(nick, mode) {
    return this.list[nick].mode.indexOf(mode) !== -1;
  }

  /**
   * Add a mode to an user
   * @param {string} nick
   * @param {string} mode
   */
  addMode(nick, mode) {
    this.list[nick].mode.push(mode);
  }

  /**
   * Remove a mode from an user
   * @param {string} nick
   * @param {string} mode
   */
  removeMode(nick, mode) {
    var index = this.list[nick].mode.indexOf(mode);
    this.list[nick].mode.splice(index, 1);
  }
}

module.exports = NameList;
