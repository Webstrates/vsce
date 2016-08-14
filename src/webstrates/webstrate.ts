var W3CWebSocket = require('websocket').w3cwebsocket;
var fs = require("fs");
var chokidar = require("chokidar");
var sharedb = require("sharedb/lib/client");
var jsonmlParse = require("jsonml-parse");
var jsondiff = require("json0-ot-diff");
var jsonml = require('jsonml-tools');

class Webstrate {

  public id: String;

  public hostAddress: String;
  public localFilePath: string;

  public onConnected: Function;
  public onDisconnected: Function;
  public onError: Function;
  public onData: Function;

  private websocket: any;
  private connection: any;
  private remoteDocument: any;
  private oldHtml: string;

  private aliveInterval: any;

  // Set 'true' when file is connected to corresponding webstrate, otherwise 'false'.
  public isConnected: boolean = false;

  constructor(id: String, hostAddress: String, localFilePath: string = "") {
    this.id = id;
    this.hostAddress = hostAddress;
    this.localFilePath = localFilePath;
  }

  /**
   * 
   */
  public connect() {
    let that = this;

    // Stop any keepAlive messaging.
    this.stopKeepAlive();

    this.oldHtml = "";

    this.websocket = new W3CWebSocket(this.hostAddress + "/ws/",
      // 4 times "undefined" is the perfect amount.
      undefined, undefined, undefined, undefined, {
        maxReceivedFrameSize: 1024 * 1024 * 20 // 20 MB
      });

    // ShareDB connection.
    this.connection = new sharedb.Connection(this.websocket);

    var sdbOpenHandler = this.websocket.onopen;
    this.websocket.onopen = function (event) {
      sdbOpenHandler(event);
      that.startKeepAlive();

      that.isConnected = true;
      if (that.onConnected) {
        that.onConnected();
      }
    };

    // We're sending our own events over the websocket connection that we don't want messing with
    // ShareDB, so we filter them out.
    var sdbMessageHandler = this.websocket.onmessage;
    this.websocket.onmessage = function (event) {
      var data = JSON.parse(event.data);
      if (data.error) {
        that.close();
      }
      if (!data.wa) {
        sdbMessageHandler(event);
      }
    };

    var sdbCloseHandler = this.websocket.onclose;
    this.websocket.onclose = function (event) {
      that.stopKeepAlive();
      sdbCloseHandler(event);

      that.isConnected = false;
      if (that.onDisconnected) {
        that.onDisconnected();
      }
    };

    var sdbErrorHandler = this.websocket.onerror;
    this.websocket.onerror = function (event) {
      that.stopKeepAlive();
      sdbErrorHandler(event);

      that.isConnected = false;
      if (that.onError) {
        that.onError({
            code: 500,
            reason: 'internal.server.error'
          });
      }
    };

    this.initSubscription();
  }

  /**
   * 
   */
  initSubscription() {
    const that = this;

    this.remoteDocument = this.connection.get("webstrates", that.id);

    this.remoteDocument.on('op', (ops, source) => {
      var newHtml = jsonToHtml(that.remoteDocument.data)
      if (newHtml === that.oldHtml) {
        return;
      }
      that.writeDocument(jsonToHtml(that.remoteDocument.data));
    });

    this.remoteDocument.subscribe((err) => {
      if (err) {
        throw err;
      }

      if (!this.remoteDocument.type) {
        if (that.onError) {
          that.onError({
            code: 404,
            reason: 'webstrate.not.found'
          });
        }

        this.remoteDocument.create('json0');
        var op = [{ "p": [], "oi": ["html", {}, ["body", {}]] }];
        this.remoteDocument.submitOp(op);
      }

      const content = jsonToHtml(this.remoteDocument.data);
      that.writeDocument(content);

      // window.createTextEditorDecorationType({});

      if (that.onData) {
        that.onData();
      }
    });
  }

  save(newHtml: string) {
    const that = this;

    if (newHtml === this.oldHtml) {
      return;
    }

    this.oldHtml = newHtml;
    htmlToJson(newHtml, function (newJson) {
      var normalizedOldJson = normalize(that.remoteDocument.data);
      var normalizedNewJson = normalize(newJson);
      var ops = jsondiff(that.remoteDocument.data, normalizedNewJson);
      try {
        that.remoteDocument.submitOp(ops);
      } catch (e) {

        that.onError({
          code: 0,
          reason: 'invalid.document'
        });
        
        var op = [{ "p": [], "oi": ["html", {}, ["body", {}]] }];
        that.remoteDocument.submitOp(op);
      }
    });
  }

  private writeDocument(html) {
    this.oldHtml = html;
    fs.writeFileSync(this.localFilePath, html);
  }

  startKeepAlive() {
    this.stopKeepAlive();

    const that = this;
    this.aliveInterval = setInterval(() => {
      // console.log('alive message');
      try {
        const message = {
          type: 'alive'
        }
        that.websocket.send(JSON.stringify(message));
      }
      catch (err) {
        console.error('error: ' + err.reason);
      }
    }, 10000);
  }

  stopKeepAlive() {
    if (this.aliveInterval) {
      clearInterval(this.aliveInterval);
      this.aliveInterval = null;
    }
  }

  close() {

    // vscode.window.showInformationMessage('close file');

    // close remote connection
    this.remoteDocument.destroy();

    // delete local copy of file
    fs.unlinkSync(this.localFilePath);
  }
}

export { Webstrate };

// All elements must have an attribute list, unless the element is a string
function normalize(json): any {
  if (typeof json === "undefined" || json.length === 0) {
    return [];
  }

  if (typeof json === "string") {
    return json;
  }

  var [tagName, attributes, ...elementList] = json;

  // Second element should always be an attributes object.
  if (Array.isArray(attributes) || typeof attributes === "string") {
    elementList.unshift(attributes);
    attributes = {};
  }

  if (!attributes) {
    attributes = {};
  }

  elementList = elementList.map(function (element) {
    return normalize(element);
  });

  return [tagName.toLowerCase(), attributes, ...elementList];
}

function jsonToHtml(json) {
  try {
    return jsonml.toXML(json, ["area", "base", "br", "col", "embed", "hr", "img", "input",
      "keygen", "link", "menuitem", "meta", "param", "source", "track", "wbr"]);
  } catch (e) {
    console.error("Unable to parse JsonML.");
  }
}

function htmlToJson(html, callback) {
  jsonmlParse(html.trim(), function (err, jsonml) {
    if (err) throw err;
    callback(jsonml);
  });
}
