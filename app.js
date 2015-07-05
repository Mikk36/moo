/**
 * Created by Mikk on 5.07.2015.
 */
var Moo = require("./moo");
var config = require("./config");

var moo = new Moo(config);
moo.connect();

process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdin.on("data", function (chunk) {
  var data = chunk.trim();
  if (data == "quit") {
    moo.quit();
    return;
  }
  moo.raw(data + "\n");
});
