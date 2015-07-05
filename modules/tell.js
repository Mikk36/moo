/**
 * Created by Mikk on 5.07.2015.
 */

var util = require("util");
var BaseModule = require("./baseModule");

class Tell extends BaseModule {
  constructor(moo) {
    super();
    this.moo = moo;
    this.config = moo.config.bind(this.moo);

    util.log("Mongo DB: " + this.config("mongoDB"));
  }
}

module.exports = Tell;
