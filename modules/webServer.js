/**
 * Created by Mikk on 12.07.2015.
 */
var util = require("util");
var escape = require("escape-html");
var BaseModule = require("./baseModule");
var express = require("express");
var jade = require("jade");
var path = require("path");

class WebServer extends BaseModule {
  /**
   * @param {Moo} moo
   */
  constructor(moo) {
    super();
    this.moo = moo;
    this.config = this.moo.config;
    this.db = this.moo.mongo;
    this.express = express();
    this.listen();
    this.requestHandlers();
  }

  /**
   * Set up handlers for various URL schemes
   */
  requestHandlers() {
    this.express.get("/robots.txt", WebServer.robotsHandler);
    this.express.get("/log", this.logHandler.bind(this));
    this.express.get("/log/:count", this.logHandler.bind(this));
    this.express.get("/log/id/:id", this.logHandler.bind(this));

    this.express.get("/aju", this.knowledgeHandler.bind(this));

    this.express.use(express.static(path.resolve(__dirname, this.__proto__.constructor.name)));
  }

  /**
   * Handle robots.txt
   * @param {Object} req
   * @param {Object} res
   */
  static robotsHandler(req, res) {
    res.send("User-agent: *\nDisallow: /")
  }

  /**
   * Handle knowledge
   * @param {Object} req
   * @param {Object} res
   */
  knowledgeHandler(req, res) {
    this.db.getKnowledge().then(WebServer.knowledgeResponder.bind(this, res));
  }

  /**
   * Send a response for knowledge
   * @param {Object} res
   * @param {Object[]} data
   */
  static knowledgeResponder(res, data) {
    data.forEach(function (row) {
      row.answer = escape(row.answer);
    });
    var locals = {
      linkify: WebServer.linkify,
      data: data
    };
    //noinspection JSCheckFunctionSignatures
    var jadeFunc = jade.compileFile(path.resolve(__dirname, this.__proto__.constructor.name + "/knowledge.jade"), {pretty: true});
    var html = jadeFunc(locals);
    res.send(html);
  }

  /**
   * Handle log requests
   * @param {Object} req
   * @param {Object} res
   */
  logHandler(req, res) {
    var self = this;
    var count = 100;
    if (req.params.id !== undefined) {
      this.db.getLogsForId(req.params.id).then(WebServer.logResponder.bind(self, res));
      return;
    } // TODO: implement linking to a specific log entry
    if (req.params.count !== undefined) {
      var value = parseInt(req.params.count, 10);
      if (!isNaN(value)) {
        count = value;
      }
    }
    this.db.getLogs(count).then(WebServer.logResponder.bind(self, res));
  }

  /**
   * Respond with a log
   * @param {Object} res
   * @param {Object[]} data
   */
  static logResponder(res, data) {

    data.forEach(function (row) {
      if (row.text !== undefined) {
        row.escapedText = escape(row.text);
      }
    });
    var locals = {
      linkify: WebServer.linkify,
      pad: WebServer.pad,
      escape: escape,
      channel: this.config.ircChannel,
      data: data
    };

    //noinspection JSCheckFunctionSignatures
    var jadeFunc = jade.compileFile(path.resolve(__dirname, this.__proto__.constructor.name + "/log.jade"), {
      pretty: true
    });
    var html = jadeFunc(locals);
    res.send(html);
  }

  /**
   * Start listening
   */
  listen() {
    var server = this.express.listen(this.config.httpPort, function () {
      var host = server.address().address;
      var port = server.address().port;
      util.log("Webserver listening at http://%s:%s", host, port);
    });
    this.server = server;
  }

  /**
   * Find and create links from a text
   * @param {string} input
   * @returns {string}
   */
  static linkify(input) {
    var url_pattern = /(\()((?:ht|f)tps?:\/\/[a-zõüäö0-9\-._~!$&'()*+,;=:\/?#[\]@%]+)(\))|(\[)((?:ht|f)tps?:\/\/[a-zõüäö0-9\-._~!$&'()*+,;=:\/?#[\]@%]+)(\])|(\{)((?:ht|f)tps?:\/\/[a-zõüäö0-9\-._~!$&'()*+,;=:\/?#[\]@%]+)(\})|(<|&(?:lt|#60|#x3c);)((?:ht|f)tps?:\/\/[a-zõüäö0-9\-._~!$&'()*+,;=:\/?#[\]@%]+)(>|&(?:gt|#62|#x3e);)|((?:^|[^=\s'"\]])\s*['"]?|[^=\s]\s+)(\b(?:ht|f)tps?:\/\/[a-zõüäö0-9\-._~!$'()*+,;=:\/?#[\]@%]+(?:(?!&(?:gt|#0*62|#x0*3e);|&(?:amp|apos|quot|#0*3[49]|#x0*2[27]);[.!&',:?;]?(?:[^a-zõüäö0-9\-._~!$&'()*+,;=:\/?#[\]@%]|$))&[a-zõüäö0-9\-._~!$'()*+,;=:\/?#[\]@%]*)*[a-zõüäö0-9\-_~$()*+=\/#[\]@%])/img;
    //noinspection HtmlUnknownTarget
    var url_replace = '$1$4$7$10$13<a href="$2$5$8$11$14">$2$5$8$11$14</a>$3$6$9$12';
    return input.replace(url_pattern, url_replace);
  }
}

module.exports = WebServer;
