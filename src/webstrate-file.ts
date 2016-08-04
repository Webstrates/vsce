import * as vscode from 'vscode';
import { WebstrateFileManager } from './webstrate-file-manager';

var W3WebSocket = require('websocket').w3cwebsocket;
var fs = require("fs");
var chokidar = require("chokidar");
var sharedb = require("sharedb/lib/client");
var jsonmlParse = require("jsonml-parse");
var jsondiff = require("json0-ot-diff");
var jsonml = require('jsonml-tools');

let websocket, remoteDocument, watcher, oldHtml;

class WebstrateFile {

  public webstrateId: String;
  public textDocument: vscode.TextDocument;
  private hostAddress: String;
  private localFilePath: string;

  constructor(id: String, hostAddress: String, localFilePath: string = "") {
    this.webstrateId = id;
    this.hostAddress = hostAddress;
    this.localFilePath = localFilePath;

    this.connect();
  }

  private connect() {
    let that = this;

    oldHtml = "";
    WebstrateFileManager.Log("Connecting to " + this.hostAddress + "...");
    var websocket = new W3WebSocket("wss://" + this.hostAddress + "/ws/",
      // 4 times "undefined" is the perfect amount.
      undefined, undefined, undefined, undefined, {
        maxReceivedFrameSize: 1024 * 1024 * 20 // 20 MB
      });

    var conn = new sharedb.Connection(websocket);

    var sdbOpenHandler = websocket.onopen;
    websocket.onopen = function (event) {
      WebstrateFileManager.Log(`Connected to Webstrate ${that.webstrateId}.`);
      sdbOpenHandler(event);
    };

    // We're sending our own events over the websocket connection that we don't want messing with
    // ShareDB, so we filter them out.
    var sdbMessageHandler = websocket.onmessage;
    websocket.onmessage = function (event) {
      var data = JSON.parse(event.data);
      if (data.error) {
        WebstrateFileManager.Log("Error:" + data.error.message);
        that.close();
      }
      if (!data.wa) {
        sdbMessageHandler(event);
      }
    };

    var sdbCloseHandler = websocket.onclose;
    websocket.onclose = function (event) {
      WebstrateFileManager.Log("Connection closed: " + event.reason);
      WebstrateFileManager.Log("Attempting to reconnect.");
      setTimeout(() => {
        that.connect();
      }, 1000);
      sdbCloseHandler(event);
    };

    var sdbErrorHandler = websocket.onerror;
    websocket.onerror = function (event) {
      WebstrateFileManager.Log("Connection error.");
      sdbErrorHandler(event);
    };

    remoteDocument = conn.get("webstrates", that.webstrateId);

    remoteDocument.on('op', (ops, source) => {
      var newHtml = jsonToHtml(remoteDocument.data)
      if (newHtml === oldHtml) {
        return;
      }
      that.writeDocument(jsonToHtml(remoteDocument.data));
    });

    remoteDocument.subscribe((err) => {
      if (err) {
        throw err;
      }

      if (!remoteDocument.type) {
        vscode.window.showWarningMessage(`Webstrate ${that.webstrateId} doesn't exist on server, creating it.`);
        remoteDocument.create('json0');
        var op = [{ "p": [], "oi": ["html", {}, ["body", {}]] }];
        remoteDocument.submitOp(op);
      }

      const content = jsonToHtml(remoteDocument.data);
      that.writeDocument(content);

      // window.createTextEditorDecorationType({});

      vscode.workspace.openTextDocument(that.localFilePath).then((doc) => {

        // associate text document with webstrate file
        that.textDocument = doc;

        vscode.window.showTextDocument(doc).then(editor => {
          // editor.setDecorations()
          WebstrateFileManager.Log(`language id ${doc.languageId}`);
        });
      });
    });
  }

  save() {
    const newHtml = this.textDocument.getText();
    if (newHtml === oldHtml) {
      return;
    }

    oldHtml = newHtml;
    htmlToJson(newHtml, function (newJson) {
      var normalizedOldJson = normalize(remoteDocument.data);
      var normalizedNewJson = normalize(newJson);
      var ops = jsondiff(remoteDocument.data, normalizedNewJson);
      try {
        remoteDocument.submitOp(ops);
      } catch (e) {
        WebstrateFileManager.Log("Invalid document, rebuilding.");
        var op = [{ "p": [], "oi": ["html", {}, ["body", {}]] }];
        remoteDocument.submitOp(op);
      }
    });
  }

  private writeDocument(html) {
    oldHtml = html;
    fs.writeFileSync(this.localFilePath, html);
  }

  close() {

    // close remote connection
    remoteDocument.destroy();

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
