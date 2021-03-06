/*
 Google module

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */
"use strict";
var http = require("http");
var entities = require("entities");
var BaseModule = require("./baseModule");

class Google extends BaseModule {
  /**
   * @param {Moo} moo
   */
  constructor(moo) {
    super();
    this.moo = moo;

    this.moo.parser.on("privMsg", this.messageHandler.bind(this));
  }

  /**
   * @param {Object} lineVars
   */
  messageHandler(lineVars) {
    var input = Google.explode(lineVars.text, " ", 2);

    if (input[0] === "!google") {
      var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
      http.get("http://ajax.googleapis.com/ajax/services/search/web?v=1.0&hl=et&userip=" + this.moo.config.googleUserIP + "&rsz=3&q=" + encodeURIComponent(input[1]), (res) => {
        var body = '';
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          var result = JSON.parse(body);
          if (result.responseData == null) {
            this.moo.privmsgCommand(to, "No valid response from Google");
            return;
          }
          var resultCount = result.responseData.results.length;
          if (resultCount === 0) {
            this.moo.privmsgCommand(to, result.responseData.cursor.moreResultsUrl);
          } else {
            if (resultCount > 3) {
              resultCount = 3;
            }
            for (var i = 0; i < resultCount; i++) {
              var item = result.responseData.results[i];
              this.moo.privmsgCommand(to, (entities.decode(decodeURIComponent(item.title)) + " " + item.url).replace("<b>", decodeURIComponent("%02")).replace("</b>", decodeURIComponent("%02")));
            }
            this.moo.privmsgCommand(to, result.responseData.cursor.moreResultsUrl + " Estimated results: " + result.responseData.cursor.estimatedResultCount);
          }
        });
      });
    }
  }
}

module.exports = Google;
