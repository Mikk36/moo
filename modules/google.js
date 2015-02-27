/*
  Google module
  
  @author Mikk Kiilaspää <mikk36@mikk36.eu>
*/
var http = require("http");
var entities = require("entities");

module.exports = Google;

function Google(parent) {
  var self = this;
  self.parent = parent;
  self.config = parent.config;
  
  parent.parser.on("privMsg", function(lineVars) {
    var input = self.explode(lineVars.text, " ", 2);
    
    if(input[0] === "!google") {
      var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
      var req = http.get("http://ajax.googleapis.com/ajax/services/search/web?v=1.0&hl=et&userip=" + self.config("googleUserIP") + "&rsz=3&q=" + encodeURIComponent(input[1]), function(res) {
        var body = '';
        res.on("data", function(chunk) {
          body += chunk;
        });
        res.on("end", function() {
          result = JSON.parse(body);
          
          var resultCount = result.responseData.results.length;
          if(resultCount === 0) {
            self.parent.privmsgCommand(to, result.responseData.cursor.moreResultsUrl);
          } else {
            if(resultCount > 3) {
              resultCount = 3;
            }
            for(var i = 0; i < resultCount; i++) {
              var item = result.responseData.results[i];
              self.parent.privmsgCommand(to, (entities.decode(decodeURIComponent(item.title)) + " " + item.url).replace("<b>", decodeURIComponent("%02")).replace("</b>", decodeURIComponent("%02")));
            }
            self.parent.privmsgCommand(to, result.responseData.cursor.moreResultsUrl + " Estimated results: " + result.responseData.cursor.estimatedResultCount);
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