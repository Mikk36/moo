/*
 Bing module

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */
var util = require("util");
var https = require("https");
var BaseModule = require("./baseModule");

class Bing extends BaseModule {
  constructor(moo) {
    super();
    this.moo = moo;
    this.config = this.moo.config;
    this.moo.parser.on("privMsg", this.messageHandler.bind(this));
  }

  messageHandler(lineVars) {
    var input = Bing.explode(lineVars.text, " ", 2);

    if (input[0] === "!bing") {
      var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);

      var options = {
        hostname: "api.datamarket.azure.com",
        path: "/Bing/Search/Web?\$format=json&\$top=3&Market='et-EE'&Query='" + encodeURIComponent(input[1]) + "'",
        auth: this.config.bingAuth + ":" + this.config.bingAuth
      };

      var self = this;
      https.get(options, function (res) {
        var body = '';
        res.on("data", function (chunk) {
          body += chunk;
        });
        res.on("end", function () {
          var result = JSON.parse(body);
          var resultCount = result.d.results.length;
          if (resultCount > 0) {
            if (resultCount > 3) {
              resultCount = 3;
            }
            for (var i = 0; i < resultCount; i++) {
              var item = result.d.results[i];
              self.moo.privmsgCommand(to, item.Title + " " + item.Url);
            }
          }
        });
      });
    }
  }
}

module.exports = Bing;
