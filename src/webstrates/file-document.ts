const fs = require("fs");
const ee = require('event-emitter');
const cheerio = require("cheerio");

import { WebstratesEditor } from './editor';

class FileDocument {

  private eventEmitter: any;
  private document: any;
  private filePath: string;
  private oldHtml: String;
  private $: any;

  // File connected to webstrate document
  public isConnected: Boolean = false;

  constructor(document: any, filePath: string) {
    this.eventEmitter = ee({});
    this.document = document;
    this.filePath = filePath;

    this.prepareDocument(document);
  }

  onDidConnect(listener) {
    return this.onEvent("connected", listener);
  }

  onDidDisconnect(listener) {
    return this.onEvent("disconnected", listener);
  }

  onError(listener) {
    return this.onEvent("error", listener);
  }

  onData(listener) {
    return this.onEvent("data", listener);
  }

  get id() {
    return this.document.id;
  }

  connect() {
    this.document.connect();
  }

  save(newHtml: string) {
    WebstratesEditor.Log(`Saving webstrate '${this.id}'`);

    const that = this;

    if (newHtml === this.oldHtml) {
      return;
    }

    this.oldHtml = newHtml;
    // Replace script or style and receive back valid html document.
    if (this.$) {
      var $webstrateContent = this.$('#webstrate');
      // Create container if it does not exist.
      if (!$webstrateContent.length) {
        $webstrateContent = this.$('<pre />');
        $webstrateContent.attr('id', 'webstrate');
        this.$('body').append($webstrateContent);
      }
      $webstrateContent.text(newHtml);
      newHtml = this.$.html();
    }

    this.document.update(newHtml, !(this.id.endsWith(".js") || this.id.endsWith(".css")));
  }

  close(deleteLocalFile: boolean = true) {
    WebstratesEditor.Log(`Closing webstrate '${this.id}'`);

    // Close connection to Webstrates server
    this.document.close();

    // delete local copy of file
    if (deleteLocalFile && fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }

  delete() {
    throw new Error(`delete webstrate document not yet implemented`);
  }

  private onEvent(eventName: string, listener: any) {
    this.eventEmitter.on(eventName, listener);

    return {
      dispose() {
        this.emitter.off(eventName, listener);
      }
    }
  }

  private prepareDocument(document: any) {
    document.onDidConnect(() => {
      this.isConnected = true;
      this.eventEmitter.emit("connected", {});
    });

    document.onDidDisconnect(() => {
      this.isConnected = false;
      this.eventEmitter.emit("disconnected", {});
    });

    document.onNewDocument(() => {
      this.eventEmitter.emit("error", {
        code: 404,
        reason: 'webstrate.not.found'
      });
    });

    document.onError(event => {
      this.eventEmitter.emit("error", {
        code: 500,
        reason: 'Internal server error. Please check debug output!'
      });
      WebstratesEditor.Log(`${event.message}: ${event.error} [jsonML=${event.jsonML}]`);
    });

    document.onUpdateOp(html => {
      this.writeToFile(html);
    });

    document.onUpdate(html => {
      this.writeToFile(html);
      this.eventEmitter.emit("data", {});
    });
  }

  private writeToFile(html) {
    // Load content of #webstrate element if webstrate id ends with .js or .css
    if (this.id.endsWith(".js") || this.id.endsWith(".css")) {
      this.$ = cheerio.load(html);
      var $webstrateContent = this.$('#webstrate');
      html = $webstrateContent.length ? $webstrateContent.text() : "";
    }
    this.oldHtml = html;
    fs.writeFileSync(this.filePath, html);
  }
}

export { FileDocument };