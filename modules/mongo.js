/**
 * Created by Mikk on 4.07.2015.
 */
var util = require("util");
var MongoClient = require("mongodb").MongoClient;

class Mongo {
  constructor(moo) {
    this.moo = moo;
    var self = this;
    MongoClient.connect(this.moo.config("mongoDB"), function (error, db) {
      if (error) {
        util.log("Error connecting to MongoDB: " + error.message);
        return;
      }
      util.log("MongoDB connected");
      self.db = db;
      self.createMongoListeners();
    });
  }

  createMongoListeners() {
    this.db.on("error", function (error) {
      util.log("MongoDB error: " + error.message);
    });
    this.db.on("reconnect", function () {
      util.log("MongoDB reconnected");
    });
    this.db.on("timeout", function () {
      util.log("MongoDB timeout");
    });
    this.db.on("close", function () {
      util.log("MongoDB closed");
    });
  }
}

module.exports = Mongo;
