const fs = require("fs");
const cheerio = require("cheerio");

import Logger from '../utils/logger';

export default class FileDocument {

  // Logger to log info, debug, error, and warn messages.
  private static Log: Logger = Logger.getLogger(FileDocument);

  private document: any;
  private filePath: string;
  private oldHtml: String;
  private $: any;

  // File connected to webstrate document
  public isConnected: Boolean = false;

  constructor(document: any, filePath: string) {
    this.document = document;
    this.filePath = filePath;

    this.prepareDocument(document);
  }

  onDidConnect(listener) {
    return this.document.onDidConnect(listener);
  }

  onDidDisconnect(listener) {
    return this.document.onDidDisconnect(listener);
  }

  onError(listener) {
    return this.document.onError(listener);
  }

  onNew(listener) {
    return this.document.onNewDocument(listener);
  }

  onUpdate(listener) {
    return this.document.onUpdate(listener);
  }

  onUpdateOp(listener) {
    return this.document.onUpdateOp(listener);
  }

  get id() {
    return this.document.id;
  }

  connect() {
    this.document.connect();
  }

  save(newHtml: string) {
    FileDocument.Log.debug(`Saving webstrate '${this.id}'`);

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
    FileDocument.Log.debug(`Closing webstrate '${this.id}'`);

    // Close connection to Webstrates server
    try {
      this.document.close();
    }
    catch (error) {
      FileDocument.Log.debug(`Error ${error}`);
    }

    // delete local copy of file
    if (deleteLocalFile && fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }

  delete() {
    throw new Error(`delete webstrate document not yet implemented`);
  }

  private prepareDocument(document: any) {
    document.onDidConnect(() => {
      this.isConnected = true;
    });

    document.onDidDisconnect(() => {
      this.isConnected = false;
    });

    let timeout;

    document.onUpdateOp(html => {

      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        this.writeToFile(html);
      }, 500);
    });

    document.onUpdate(html => {
      this.writeToFile(html);
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
