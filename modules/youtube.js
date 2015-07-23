/*
 Youtube module

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */
var https = require("https");

class Youtube {
  constructor(moo) {
    this.moo = moo;

    this.moo.parser.on("privMsg", this.messageHandler.bind(this));
  }

  messageHandler(lineVars) {
    var self = this;
    var regExp = /http(s?):\/\/(?:youtu\.be\/|(?:[a-z]{2,3}\.)?youtube\.com\/watch(?:\?|#\!)(v=|[A-Za-z0-9_=]*&v=))([\w-]{11}).*/gi;
    var matches = lineVars.text.match(regExp);
    if (matches !== null) {
      var regExp2 = /[a-zA-Z0-9\-\_]{11}/g;
      var matches2 = matches[0].match(regExp2);
      if (matches2 !== null) {
        var matchedID = "";
        if (matches2.length > 1) {
          var regExp3 = /v=[a-zA-Z0-9\-\_]{11}/g;
          matchedID = matches[0].match(regExp3)[0].substring(2);
        } else {
          matchedID = matches2[0]
        }
        https.get("https://www.googleapis.com/youtube/v3/videos?part=id,snippet,contentDetails&id="
          + matchedID + "&key=" + this.moo.config.googleAuth, function (res) {
          var body = "";
          res.on("data", function (chunk) {
            body += chunk;
          });
          res.on("end", function () {
            var result = JSON.parse(body);
            var message = "";
            var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
            if (result.error !== undefined) {
              message += "YouTube error: " + result.error.message;
            } else {
              if (result.pageInfo.totalResults > 0) {
                message += "YouTube video: \"" + result.items[0].snippet.title + "\""
                  + " length: " + result.items[0].contentDetails.duration.substr(2).toLowerCase()
                  + " by: " + result.items[0].snippet.channelTitle;
              } else {
                message += "Youtube video not found";
              }
            }
            self.moo.privmsgCommand(to, message);
          });
        });
      }
    }
  }
}

module.exports = Youtube;
