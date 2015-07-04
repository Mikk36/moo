/*
 Calculator module

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */
var util = require("util");
var BaseModule = require("./baseModule");
var math = require('mathjs');

class Calculator extends BaseModule {
  constructor(moo) {
    super();
    this.moo = moo;

    this.moo.parser.on("privMsg", this.messageHandler.bind(this));
  }

  messageHandler(lineVars) {
    var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
    var input = Calculator.explode(lineVars.text, " ", 2);

    var result;
    if (input[0] === "!calc") {
      result = "";
      try {
        result = math.eval(input[1]);
      } catch (e) {
        result = e.message;
      }
      this.moo.privmsgCommand(to, "" + result);
    } else if (lineVars.text[0] === "=") {
      try {
        var mathString = lineVars.text.substr(1);
        result = math.eval(mathString);
        this.moo.privmsgCommand(to, "" + result);
      } catch (e) {
      }
    }
  }
}

module.exports = Calculator;
