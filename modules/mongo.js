/**
 * Created by Mikk on 4.07.2015.
 */
var util = require("util");
var events = require("events");
var mongo = require("mongodb");
var MongoClient = mongo.MongoClient;
var ObjectID = mongo.ObjectID;

class Mongo {
  constructor(moo) {
    events.EventEmitter.call(this);
    this.moo = moo;
    this.config = this.moo.config;
    var self = this;
    MongoClient.connect(this.config.mongoDB, function (error, db) {
      if (error) {
        util.log("Error connecting to MongoDB: " + error.message);
        return;
      }
      util.log("MongoDB connected");
      self.db = db;
      self.createMongoListeners();
      self.emit("connected", db);
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

  logEvent(data) {
    // TODO: instead of quitting, store for later attempt
    if (this.db === undefined) {
      return;
    }

    if (data.act === undefined || data.act.length === 0) {
      return new Error("act must be specified");
    }

    var allowedList = ["target", "nick", "userhost", "act", "text"];
    var dbData = {};
    for (var prop in data) {
      //noinspection JSUnfilteredForInLoop
      if (allowedList.indexOf(prop) === -1) {
        return new Error("Unknown data key: '" + prop + "'");
      }
      //noinspection JSUnfilteredForInLoop
      dbData[prop] = data[prop];
    }
    dbData.time = new Date();


    var collection = this.db.collection(this.config.logCollection);


    //noinspection JSDeprecatedSymbols,JSCheckFunctionSignatures
    collection.insert(dbData);
  }

  getKnowledge() {
    var self = this;
    return new Promise(function (resolve, reject) {
      var collection = self.db.collection(self.config.knowledgeCollection);
      collection.aggregate([
        {
          "$project": {
            question: 1,
            answer: 1,
            insensitive: {"$toLower": "$question"}
          }
        },
        {
          $sort: {insensitive: 1}
        }
      ]).toArray(function (err, documents) {
        if (err) {
          util.log("Error: " + err);
          reject(err);
        } else {
          resolve(documents);
        }
      });
    });
  }

  getLogsForId(id) {
    var self = this;

    var collection = self.db.collection(self.config.logCollection);
    var objectId = new ObjectID(id);
    var parallel = [];
    parallel.push(new Promise(function (resolve, reject) {
      collection.find({
        $or: [
          {target: self.config.ircChannel},
          {target: {$exists: false}}
        ],
        $and: [
          {act: {$ne: "332"}},
          {act: {$ne: "333"}}
        ],
        _id: {$lte: objectId}
      }).sort({_id: -1}).limit(6).toArray(function (err, documents) {
        if (err) {
          reject(err);
          return;
        }
        resolve(documents);
      });
    }));
    parallel.push(new Promise(function (resolve, reject) {
      collection.find({
        $or: [
          {target: self.config.ircChannel},
          {target: {$exists: false}}
        ],
        $and: [
          {act: {$ne: "332"}},
          {act: {$ne: "333"}}
        ],
        _id: {$gt: objectId}
      }).sort({_id: 1}).limit(5).toArray(function (err, documents) {
        if (err) {
          reject(err);
          return;
        }
        resolve(documents);
      });
    }));
    return new Promise(function (resolve, reject) {
      Promise.all(parallel).then(function (results) {
        var documents = [].concat.apply([], results);
        var sortedDocuments = documents.sort(Mongo.logSorter);
        resolve(sortedDocuments);
      }).catch(function (error) {
        reject(error);
      });
    });
  }

  getLogs(count) {
    var self = this;

    // A bit of safety
    count = parseInt(count, 10);
    if (count < 1) {
      count = 100;
    }
    if (count > 5000) {
      count = 5000;
    }

    return new Promise(function (resolve, reject) {
      var collection = self.db.collection(self.config.logCollection);

      collection.find({
        $or: [
          {target: self.config.ircChannel},
          {target: {$exists: false}}
        ],
        $and: [
          {act: {$ne: "332"}},
          {act: {$ne: "333"}}
        ]
      }).sort({_id: -1}).limit(count).toArray(function (err, documents) {
        if (err) {
          util.log("Error: " + err);
          reject(err);
        } else {
          if (documents.length === 0) {
            reject("No logs found");
          } else {
            var sortedDocuments = documents.sort(Mongo.logSorter);
            resolve(sortedDocuments);
          }
        }
      });
    });
  }

  static logSorter(a, b) {
    var aId = a._id.toHexString();
    var bId = b._id.toHexString();
    if (aId < bId) {
      return -1;
    }
    if (aId > bId) {
      return 1;
    }
    return 0;
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
          if (documents.length === 0) {
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

  storeNotification(from, to, message) {
    // TODO: instead of quitting, store for later attempt
    if (this.db === undefined) {
      return;
    }
    var collection = this.db.collection(this.config.notifyCollection);
    var time = new Date();


    //noinspection JSCheckFunctionSignatures
    collection.insertOne({
      from: from,
      to: to,
      toInsensitive: to.toLowerCase(),
      message: message,
      time: time,
      processed: false
    });
  }
}

Mongo.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Mongo;
