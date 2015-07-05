/*
 Web Server

 @author Mikk Kiilaspää <mikk36@mikk36.eu>
 */
var util = require("util");
var http = require("http");
var url = require("url");
var escape = require("escape-html");
var BaseModule = require("./baseModule");

class WebServer extends BaseModule {
  constructor(moo) {
    super();
    this.moo = moo;
    this.config = this.moo.config.bind(this.moo);

    this.server = http.createServer();
    this.server.listen(this.config("httpPort"));

    this.server.on("request", this.handleRequest.bind(this));
  }

  handleRequest(request, response) {
    var path = url.parse(request.url).pathname;

    var regex1 = new RegExp("^/log/|^/log$");
    var regex2 = new RegExp("^/aju$");
    var regexRobots = new RegExp("^/robots.txt$");
    if (regex1.test(path) === true) {
      var amountRegex = new RegExp("^/log/([0-9]+)");
      var amount = amountRegex.exec(path);
      if (amount !== null) {
        amount = parseInt(amount[1]);
      } else {
        amount = this.config("httpDefaultLogAmount");
      }

      var rowIDRegex = new RegExp("^/log/id/([0-9]+)");
      var rowID = rowIDRegex.exec(path);
      if (rowID !== null) {
        rowID = parseInt(rowID[1]);
      } else {
        rowID = -1;
      }

      this.getLogs(response, amount, rowID);
    } else if (regex2.test(path) === true) {
      this.getKnowledge(response);
    } else if (regexRobots.test(path) === true) {
      response.write("User-agent: *\nDisallow: /");
      response.end();
    } else {
      response.end();
    }
  }

  getLogs(response, amount, rowID) {
    if (amount === undefined) {
      amount = this.config("httpDefaultLogAmount");
    }
    if (amount > this.config("httpLogAmountLimit")) {
      amount = this.config("httpLogAmountLimit");
    }

    var sqlQuery = "";
    if (rowID === -1) {
      sqlQuery = "\
        SELECT * FROM (\
          SELECT id, UNIX_TIMESTAMP(time) as time, nick, userhost, text, act FROM logs\
          WHERE (target =  '" + this.config("ircChannel") + "' OR target IS NULL)  AND\
            act NOT LIKE  '332' AND act NOT LIKE  '333'\
          ORDER BY id DESC\
          LIMIT ?\
        ) as tbl\
        ORDER BY tbl.id ASC";
    } else {
      sqlQuery = "\
        (\
          SELECT id, UNIX_TIMESTAMP(time) as time, nick, userhost, text, act\
          FROM logs\
          WHERE	\
            ( target =  '" + this.config("ircChannel") + "' OR target IS NULL )\
            AND act NOT LIKE  '332' AND act NOT LIKE  '333' AND id <= " + rowID + "\
          ORDER BY id DESC\
          LIMIT 6\
        )\
        UNION\
        (\
	        SELECT id, UNIX_TIMESTAMP(time) as time, nick, userhost, text, act\
	        FROM logs\
	        WHERE\
	          ( target =  '" + this.config("ircChannel") + "' OR target IS NULL)\
	          AND act NOT LIKE  '332' AND act NOT LIKE  '333' AND id > " + rowID + "\n\
	        ORDER BY id ASC\
	        LIMIT 5\
        )\
        ORDER BY id ASC";
    }

    this.moo.db.query(sqlQuery,
      [amount],
      this.logQueryHandler.bind(this, response, sqlQuery)
    );
  }

  logQueryHandler(response, query, err, results) {
    if (err) {
      util.log(query);
      throw err;
    }
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    response.write("<!DOCTYPE html>\n\
<html>\n\
  <head>\n\
    <meta charset=utf-8 />\n\
    <title>" + escape(this.config("ircChannel")) + " logi</title>\n\
    <style type=\"text/css\">\n\
      body {\n\
        font-family: Verdana, sans-serif;\n\
        font-size: 10pt;\n\
        background-color: #111;\n\
        color: silver;\n\
      }\n\
      a {\n\
        color: white;\n\
      }\n\
      .join {\n\
        color: darkgreen;\n\
      }\n\
      .quit, .part, .kick {\n\
        color: darkred;\n\
      }\n\
      .mode, .topic, .nick {\n\
        color: royalblue;\n\
      }\n\
      .action {\n\
        font-style: italic;\n\
      }\n\
      .dayChange {\n\
        color: orange;\n\
      }\n\
      .time {\n\
        text-decoration: none;\n\
      }\n\
      .time:hover {\n\
        text-decoration: underline;\n\
      }\n\
    </style>\n\
  </head>\n\
  <body onload=\"window.scrollTo(0, document.body.scrollHeight);\">\n\
    <p>\n");
    var currentDate = new Date(results[0].time * 1000).toDateString();
    results.forEach(function (row) {
      var escapedRowText = escape(row.text);
      var rowDate = new Date(row.time * 1000);
      if (rowDate.toDateString() !== currentDate) {
        response.write("      <span class=\"dayChange\">00:00:00 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&mdash;&rsaquo; Day changed to (" + rowDate.toLocaleDateString() + ").</span><br>\n");
      }
      currentDate = rowDate.toDateString();
      response.write("      <a class=\"time\" href=\"/log/id/" + row.id + "\" title=\"" + rowDate.toLocaleDateString() + "\">" + WebServer.pad(rowDate.getHours()) + ":" + WebServer.pad(rowDate.getMinutes()) + ":" + WebServer.pad(rowDate.getSeconds()) + "</a> ");
      switch (row.act) {
        case "JOIN":
          response.write("<span class=\"join\">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&mdash;&rsaquo; join: (" + row.nick + ") (" + row.userhost + ")</span>");
          break;
        case "QUIT":
          response.write("<span class=\"quit\">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&mdash;&rsaquo; quit: (" + row.nick + ") (" + row.userhost + ")");
          if (escapedRowText.length > 0) {
            response.write(" (" + WebServer.linkify(escapedRowText) + ")");
          }
          response.write("</span>");
          break;
        case "MODE":
          response.write("<span class=\"mode\">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&mdash;&rsaquo; mode: (" + row.nick + ") sets mode (" + escapedRowText + ")</span>");
          break;
        case "PART":
          response.write("<span class=\"part\">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&mdash;&rsaquo; part: (" + row.nick + ") (" + row.userhost + ")");
          if (escapedRowText.length > 0) {
            response.write(" (" + WebServer.linkify(escapedRowText) + ")");
          }
          response.write("</span>");
          break;
        case "NICK":
          response.write("<span class=\"nick\">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&mdash;&rsaquo; nick: (" + row.nick + ") is now known as (" + escapedRowText + ")</span>");
          break;
        case "TOPIC":
          response.write("<span class=\"topic\">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&mdash;&rsaquo; topic: (" + row.nick + ") changes topic to (" + WebServer.linkify(escapedRowText) + ")</span>");
          break;
        case "KICK":
          var nick_end = escapedRowText.indexOf(":");
          var nick = escapedRowText.substring(0, nick_end);
          var reason = escapedRowText.substring(nick_end + 1);

          response.write("<span class=\"kick\">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&mdash;&rsaquo; kick: (" + nick + ") was kicked by (" + row.nick + ")");
          if (reason.length > 0) {
            response.write(" (" + WebServer.linkify(reason) + ")");
          }
          response.write("</span>");
          break;
        case "PRIVMSG":
          var actionTest = JSON.stringify(row.text);
          //util.log(actionTest);
          if (actionTest.indexOf("\\u0001ACTION") !== -1) {
            response.write("<span class=\"action\">&bull; " + row.nick + WebServer.linkify(escapedRowText.substr(7, escapedRowText.length - 1)));
          } else {
            response.write("<span class=\"privmsg\">(" + row.nick + ") " + WebServer.linkify(escapedRowText));
          }
          response.write("</span>");
          break;
      }
      response.write("<br>\n");
    });

    response.write("    </p>\n\
  </body>\n\
</html>");
    response.end();
  }

  getKnowledge(response) {
    // "SELECT * FROM `definitions` ORDER BY `question` ASC"
    this.moo.db.query("SELECT `question`, `answer` FROM `definitions` ORDER BY `question` ASC", this.knowledgeQueryHandler.bind(this, response));
  }

  knowledgeQueryHandler(response, err, results) {
    response.writeHead(200, {'Content-Type': 'text/html; chaset=utf-8'});
    response.write("<!DOCTYPE html>\n\
<html>\n\
  <head>\n\
    <meta charset=utf-8 />\n\
    <title>Bot's Knowledge</title>\n\
    <style type=\"text/css\">\n\
      body {\n\
        font-family: Verdana, sans-serif;\n\
        font-size: 10pt;\n\
        background-color: #111;\n\
        color: silver;\n\
      }\n\
      a {\n\
        color: white;\n\
      }\n\
      table {\n\
        border-spacing: 0;\n\
        border-collapse: collapse;\n\
      }\n\
      tr:hover {\n\
        background-color: #222;\n\
      }\n\
      td:first-child {\n\
        padding-left: 0.5em;\n\
        padding-right: 1em;\n\
      }\n\
      td {\n\
        padding-top: 0.25em;\n\
        padding-bottom: 0.25em;\n\
      }\n\
    </style>\n\
  </head>\n\
  <body>\n\
    <table>\n");
    results.forEach(function (row) {
      response.write("      <tr>\n\
        <td>" + escape(row.question) + "</td>\n\
        <td>" + WebServer.linkify(escape(row.answer)) + "</td>\n\
      </tr>\n");
    });
    response.write("    </table>\n\
  </body>\n\
</html>");
    response.end();
  }

  static linkify(input) {
    var url_pattern = /(\()((?:ht|f)tps?:\/\/[a-zõüäö0-9\-._~!$&'()*+,;=:\/?#[\]@%]+)(\))|(\[)((?:ht|f)tps?:\/\/[a-zõüäö0-9\-._~!$&'()*+,;=:\/?#[\]@%]+)(\])|(\{)((?:ht|f)tps?:\/\/[a-zõüäö0-9\-._~!$&'()*+,;=:\/?#[\]@%]+)(\})|(<|&(?:lt|#60|#x3c);)((?:ht|f)tps?:\/\/[a-zõüäö0-9\-._~!$&'()*+,;=:\/?#[\]@%]+)(>|&(?:gt|#62|#x3e);)|((?:^|[^=\s'"\]])\s*['"]?|[^=\s]\s+)(\b(?:ht|f)tps?:\/\/[a-zõüäö0-9\-._~!$'()*+,;=:\/?#[\]@%]+(?:(?!&(?:gt|#0*62|#x0*3e);|&(?:amp|apos|quot|#0*3[49]|#x0*2[27]);[.!&',:?;]?(?:[^a-zõüäö0-9\-._~!$&'()*+,;=:\/?#[\]@%]|$))&[a-zõüäö0-9\-._~!$'()*+,;=:\/?#[\]@%]*)*[a-zõüäö0-9\-_~$()*+=\/#[\]@%])/img;
    var url_replace = '$1$4$7$10$13<a href="$2$5$8$11$14">$2$5$8$11$14</a>$3$6$9$12';
    return input.replace(url_pattern, url_replace);
  }
}

module.exports = WebServer;
