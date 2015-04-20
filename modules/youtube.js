/*
 Youtube module

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */
var https = require("https");

module.exports = Youtube;

function Youtube(parent) {
  var self = this;
  self.parent = parent;
  self.config = parent.config;

  parent.parser.on("privMsg", function (lineVars) {
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
        + matchedID + "&key=" + self.config("googleAuth"), function (res) {
          var body = "";
          res.on("data", function (chunk) {
            body += chunk;
          });
          res.on("end", function () {
            result = JSON.parse(body);
            var message = "";
            var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
            if (result.error !== undefined) {
              message += "YouTube error: " + result.error.message;
            } else {
              message += "YouTube video: \"" + result.items[0].snippet.title + "\""
              + " length: " + result.items[0].contentDetails.duration.substr(2).toLowerCase()
              + " by: " + result.items[0].snippet.channelTitle;
            }
            self.parent.privmsgCommand(to, message);
          });
        });
      }
    }
  });
}