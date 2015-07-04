/*
  Configuration

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
*/

var options = {
  nick:                 "nickname",
  ident:                "someIdent",
  ircRealName:          "Moo the Cow",
  nickserv:             "nickserv",
  chanserv:             "chanserv",
  nickservPassword:     "something",
  ircQuitMsg:           "Good bye, cruel world...",
  ircServer:            "serverAddress",
  ircPort:              6667,
  ircChannel:           "#something",
  ircChannelKey:        false, //or password as a string
  sqlHost:              "localhost",
  sqlUser:              "username",
  sqlPass:              "password",
  sqlDB:                "databaseName",
  mongoDB: "mongodb://localhost:27017/database",
  silenceTimeout:       300,
  httpPort:             38080,
  httpDefaultLogAmount: 100,
  httpLogAmountLimit:   5000,
  googleUserIP:         "publicIP", //for google requests,
  adminUsers:           ["yourNick"],
  bingAuth:             "key",
  wolframAuth:          "key",
  googleAuth:           "key" // https://code.google.com/apis/console
};

exports.getOption= function(name) {
  if(typeof name != "string") {
    return new Error("Option name must be a string");
  }
  if(name.length == 0) {
    return new Error("Option name must not be empty");
  }
  if(options.hasOwnProperty(name) == false) {
    return new Error("Option not defined");
  }
  return options[name];
};
