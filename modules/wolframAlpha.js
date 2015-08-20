/*
 WolframAlpha module

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */
var util = require("util");
var Client = require("node-wolfram");
var BaseModule = require("./baseModule");
var Wolfram = false;

class WolframAlpha extends BaseModule {
  /**
   * @param {Moo} moo
   */
  constructor(moo) {
    super();
    this.moo = moo;

    if (!Wolfram) Wolfram = new Client(this.moo.config.wolframAuth);

    this.moo.parser.on("privMsg", this.messageHandler.bind(this));
  }

  /**
   * @param {Object} lineVars
   */
  messageHandler(lineVars) {
    var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
    var input = WolframAlpha.explode(lineVars.text, " ", 2);

    if (input[0] === "!wolfram") {
      Wolfram.query(input[1], this.wolframResponseHandler.bind(this, to));
    }
  }

  /**
   * @param {string} to
   * @param {Error} err
   * @param {Object} result
   */
  wolframResponseHandler(to, err, result) {
    if (err) {
      this.moo.privmsgCommand(to, err);
      return;
    }

    for (var i = 0; i < result.queryresult.pod.length; i++) {
      var pod = result.queryresult.pod[i];
      if (pod.$.title === "Result" || pod.$.title === "Typical human computation times" || pod.$.title === "Definitions") {
        for (var j = 0; j < pod.subpod.length; j++) {
          var subpod = pod.subpod[j];
          for (var k = 0; k < subpod.plaintext.length; k++) {
            var output = pod.$.title + ": " + subpod.plaintext[k];
            this.moo.privmsgCommand(to, output);
          }
        }
      }
    }
  }
}

module.exports = WolframAlpha;
