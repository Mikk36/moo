/*
  Bing module
  
  @author Mikk Kiilaspää <mikk36@mikk36.eu>
*/
var util = require("util");
var https = require("https");

module.exports = Bing;

function Bing(parent) {
  var self = this;
  self.parent = parent;
  self.config = parent.config;
  
  parent.parser.on("privMsg", function(lineVars) {
    var input = self.explode(lineVars.text, " ", 2);
    
    if(input[0] === "!bing") {
      var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
      
      var options = {
        hostname: "api.datamarket.azure.com",
        path: "/Bing/Search/Web?\$format=json&\$top=3&Market='et-EE'&Query='" + encodeURIComponent(input[1]) + "'",
        auth: self.config("bingAuth") + ":" + self.config("bingAuth")
      };
      var req = https.get(options, function(res) {
        var body = '';
        res.on("data", function(chunk) {
          body += chunk;
        });
        res.on("end", function() {
          
          result = JSON.parse(body);
          
          var resultCount = result.d.results.length;
          if(resultCount > 0) {
            if(resultCount > 3) {
              resultCount = 3;
            }
            for(var i = 0; i < resultCount; i++) {
              var item = result.d.results[i];
              self.parent.privmsgCommand(to, item.Title + " " + item.Url);
            }
          }
        });
      });
    }
  });
  
  self.explode = function(input, delimiter, limit) {
    var s = input.split( delimiter );
    if (limit > 0) {
      if (limit >= s.length) {
        return s;
      }
      return s.slice(0, limit - 1).concat([s.slice(limit - 1).join(delimiter)]);
    }
    return s;
  };
}