/*
  WolframAlpha module
  
  @author Mikk Kiilaspää <mikk36@mikk36.eu>
*/
var util = require("util");
var Client = require("node-wolfram");
var Wolfram = false;

module.exports = WolframAlpha;

function WolframAlpha(parent) {
  var self = this;
  self.parent = parent;
  self.config = parent.config;
  
  if(!Wolfram) Wolfram = new Client(self.config("wolframAuth"));
  
  parent.parser.on("privMsg", function(lineVars) {
    var to = (lineVars.to.charAt(0) === "#" ? lineVars.to : lineVars.fromNick);
    var input = self.explode(lineVars.text, " ", 2);
    
    if(input[0] === "!wolfram") {
      Wolfram.query(input[1], function(err, result) {
        if(err) {
          self.parent.privmsgCommand(to, err);
          return;
        }
        
        for(var i = 0; i < result.queryresult.pod.length; i++) {
          var pod = result.queryresult.pod[i];
          if(pod.$.title === "Result" || pod.$.title === "Typical human computation times" || pod.$.title === "Definitions") {
            for(var j = 0; j < pod.subpod.length; j++) {
              var subpod = pod.subpod[j];
              for(var k = 0; k < subpod.plaintext.length; k++) {
                var output = pod.$.title + ": " + subpod.plaintext[k];
                self.parent.privmsgCommand(to, output);
              }
            }
          }
        }
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