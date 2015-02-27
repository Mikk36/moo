/*
  Youtube module
  
  @author Mikk Kiilaspää <mikk36@mikk36.eu>
*/
var util = require("util");
var http = require("http");

module.exports = Youtube;

function Youtube(parent) {
  var self = this;
  self.parent = parent;
  
  parent.parser.on("privMsg", function(lineVars) {
    var regExp = /http(s?):\/\/(?:youtu\.be\/|(?:[a-z]{2,3}\.)?youtube\.com\/watch(?:\?|#\!)(v=|[A-Za-z0-9_=]*&v=))([\w-]{11}).*/gi;
    var matches = lineVars.text.match(regExp);
    if(matches !== null) {
      var regExp2 = /[a-zA-Z0-9\-\_]{11}/g;
      var matches2 = matches[0].match(regExp2);
      if(matches2 !== null) {
        var matchedID = "";
        if(matches2.length > 1) {
          var regExp3 = /v=[a-zA-Z0-9\-\_]{11}/g;
          matchedID = matches[0].match(regExp3)[0].substring(2);
        } else {
          matchedID = matches2[0]
        }
        var req = http.get("http://gdata.youtube.com/feeds/api/videos/" + matchedID + "?v=2&alt=jsonc", function(res) {
          var body = "";
          res.on("data", function(chunk) {
            body += chunk;
          });
          res.on("end", function() {
            result = JSON.parse(body);
            message = "";
            var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
            if(result.error !== undefined) {
              message += "YouTube error: " + result.error.message;
            } else {
              message += "YouTube video: \"" + result.data.title + "\" by: " + result.data.uploader;
            }
            self.parent.privmsgCommand(to, message);
          });
        });
      }
    }
  });
}