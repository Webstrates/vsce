import * as vscode from 'vscode';
import { WebstrateFileManager } from './webstrate-file-manager';

var W3CWebSocket = require('websocket').w3cwebsocket;
var fs = require("fs");
var chokidar = require("chokidar");
var sharedb = require("sharedb/lib/client");
var jsonmlParse = require("jsonml-parse");
var jsondiff = require("json0-ot-diff");
var jsonml = require('jsonml-tools');


class WebstrateFile {

  public websocket: any;
  public connection: any;

  private remoteDocument : any;
  private watcher : any;
  private oldHtml : string;

  public webstrateId: String;
  public textDocument: vscode.TextDocument;
  private hostAddress: String;
  private localFilePath: string;
  private aliveInterval: any;

  constructor(id: String, hostAddress: String, localFilePath: string = "") {
    this.webstrateId = id;
    this.hostAddress = hostAddress;
    this.localFilePath = localFilePath;

    this.connect();
  }

  private connect() {
    let that = this;

    if (this.aliveInterval) {
      clearInterval(this.aliveInterval);
    }

    this.oldHtml = "";
    WebstrateFileManager.Log("Connecting to " + this.hostAddress + "...");
    // this.websocket = new W3CWebSocket("wss://" + this.hostAddress + "/ws/",
    this.websocket = new W3CWebSocket(this.hostAddress + "/ws/",
      // 4 times "undefined" is the perfect amount.
      undefined, undefined, undefined, undefined, {
        maxReceivedFrameSize: 1024 * 1024 * 20 // 20 MB
      });

    this.connection = new sharedb.Connection(this.websocket);


    var sdbOpenHandler = this.websocket.onopen;
    this.websocket.onopen = function (event) {
      WebstrateFileManager.Log(`Connected to Webstrate ${that.webstrateId}.`);
      sdbOpenHandler(event);

      that.stopKeepAlive();
      that.startKeepAlive();
    };

    // We're sending our own events over the websocket connection that we don't want messing with
    // ShareDB, so we filter them out.
    var sdbMessageHandler = this.websocket.onmessage;
    this.websocket.onmessage = function (event) {
      var data = JSON.parse(event.data);
      if (data.error) {
        WebstrateFileManager.Log("Error:" + data.error.message);
        that.close();
      }
      if (!data.wa) {
        sdbMessageHandler(event);
      }
    };

    var sdbCloseHandler = this.websocket.onclose;
    this.websocket.onclose = function (event) {
      WebstrateFileManager.Log("Connection closed: " + event.reason);
      that.stopKeepAlive();

      WebstrateFileManager.Log("Attempting to reconnect.");

      setTimeout(() => {
        that.connect();
      }, 1000);
      sdbCloseHandler(event);
    };

    var sdbErrorHandler = this.websocket.onerror;
    this.websocket.onerror = function (event) {
      WebstrateFileManager.Log("Connection error.");
      that.stopKeepAlive();
      sdbErrorHandler(event);
    };

    this.remoteDocument = this.connection.get("webstrates", that.webstrateId);

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
        vscode.window.showWarningMessage(`Webstrate ${that.webstrateId} doesn't exist on server, creating it.`);
        this.remoteDocument.create('json0');
        var op = [{ "p": [], "oi": ["html", {}, ["body", {}]] }];
        this.remoteDocument.submitOp(op);
      }

      const content = jsonToHtml(this.remoteDocument.data);
      that.writeDocument(content);

      // window.createTextEditorDecorationType({});

      vscode.workspace.openTextDocument(that.localFilePath).then(doc => {

        // associate text document with webstrate file
        that.textDocument = doc;

        vscode.window.showTextDocument(doc).then(editor => {
          // editor.setDecorations()
          // WebstrateFileManager.Log(`language id ${doc.languageId}`);
        });
      });
    });
  }

  save() {
    const that = this;

    const newHtml = this.textDocument.getText();
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
        WebstrateFileManager.Log("Invalid document, rebuilding.");
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

export { WebstrateFile };

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
    WebstrateFileManager.Log("Unable to parse JsonML.");
  }
}

function htmlToJson(html, callback) {
  jsonmlParse(html.trim(), function (err, jsonml) {
    if (err) throw err;
    callback(jsonml);
  });
}
