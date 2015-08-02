/**
 * Created by Mikk on 1.08.2015.
 */
var util = require("util");

class NameList {
  constructor() {
    this.list = {};
    this.complete = true;
  }

  initializeList() {
    this.complete = false;
    this.list = {};
  }

  completeList() {
    this.complete = true;
  }

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

  addNick(nick, ident, host) {
    this.list[nick] = {
      mask: ident + "@" + host,
      mode: []
    };
  }

  removeNick(nick) {
    delete this.list[nick];
  }

  changeNick(nick, newNick) {
    var oldData = this.list[nick];
    delete this.list[nick];
    this.list[newNick] = oldData;
  }

  hasMode(nick, mode) {
    return this.list[nick].mode.indexOf(mode) !== -1;
  }

  addMode(nick, mode) {
    this.list[nick].mode.push(mode);
  }

  removeMode(nick, mode) {
    var index = this.list[nick].mode.indexOf(mode);
    this.list[nick].mode.splice(index, 1);
  }
}

module.exports = NameList;
