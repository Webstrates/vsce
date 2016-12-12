const fs = require("fs");
const cheerio = require("cheerio");

import * as vscode from 'vscode';

import Logger from '../utils/logger';
import { Utils } from './utils';

export default class FileDocument {

  // Logger to log info, debug, error, and warn messages.
  private static Log: Logger = Logger.getLogger(FileDocument);

  private metadata: any;
  private document: any;
  private textDocument: vscode.TextDocument;
  private oldHtml: String;
  private $: any;

  // File connected to webstrate document
  public isConnected: Boolean = false;

  /**
   * Creates an instance of FileDocument.
   * 
   * @param {*} metadata Webstrate metadata, webstrate id and content id.
   * @param {*} document
   * @param {vscode.TextDocument} textDocument
   * 
   * @memberOf FileDocument
   */
  constructor(metadata: any, document: any, textDocument: vscode.TextDocument) {
    this.metadata = metadata;
    this.document = document;
    this.textDocument = textDocument;

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

  save() {

    FileDocument.Log.debug(`Saving webstrate '${this.id}'`);

    // Get file content as new webstrate content.
    let newHtml = this.textDocument.getText();

    // Eventually use this.textDocument.isDirty instead of checking for newHtml === this.oldHtml
    if (newHtml === this.oldHtml) {
      return;
    }

    this.oldHtml = newHtml;
    // Replace script or style and receive back valid html document.
    if (this.metadata.contentId) {
      var $webstrateContent = this.$(`#${this.metadata.contentId}`);
      // Create container if it does not exist.
      if (!$webstrateContent.length) {
        $webstrateContent = this.$('<pre />');
        $webstrateContent.attr('id', this.metadata.contentId);
        this.$('body').append($webstrateContent);
      }
      $webstrateContent.text(newHtml);
      newHtml = this.$.html();
    }

    this.document.update(newHtml, !this.metadata.contentId);
  }

  close(deleteLocalFile: boolean = true) {
    FileDocument.Log.debug(`Closing webstrate '${this.id}'`);

    // Close connection to Webstrates server
    try {
      this.document.close();
    }
    catch (error) {
      FileDocument.Log.error(`Could not close webstrate document.`, error);
    }

    // delete local copy of file
    if (deleteLocalFile && fs.existsSync(this.textDocument.fileName)) {
      fs.unlinkSync(this.textDocument.fileName);
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
      }, 2500);
    });

    document.onUpdate(html => {
      this.writeToFile(html);
    });
  }

  private writeToFile(html) {
    // Load content of #contentId element if webstrate id contains a # character
    if (this.metadata.contentId) {
      this.$ = cheerio.load(html);
      const $webstrateContent = this.$(`#${this.metadata.contentId}`);
      html = $webstrateContent.length ? $webstrateContent.text() : "";
    }
    this.oldHtml = html;
    fs.writeFileSync(this.textDocument.fileName, html);
  }
}
