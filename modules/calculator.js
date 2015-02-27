/*
  Calculator module
  
  @author Mikk Kiilaspää <mikk36@mikk36.eu>
*/
var util = require("util");
//var http = require("http");
var math = require('mathjs');

module.exports = Calculator;

function Calculator(parent) {
  var self = this;
  self.parent = parent;
  
  parent.parser.on("privMsg", function(lineVars) {
    var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
    var input = self.explode(lineVars.text, " ", 2);
    
    if(input[0] === "!calc") {
      var result = "";
      try {
        result = math.eval(input[1]);
      } catch(e) {
        result = e.message;
      }
      self.parent.privmsgCommand(to, result);
    } else if(lineVars.text[0] === "=") {
      try {
        var mathString = lineVars.text.substr(1);
        var result = math.eval(mathString);
        self.parent.privmsgCommand(to, result);
      } catch(e) {
      }
    }
    // else {
    //  try {
    //    var result = math.eval(lineVars.text);
    //    self.parent.privmsgCommand(to, result);
    //  } catch(e) {
    //  }
    //  
    //}
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