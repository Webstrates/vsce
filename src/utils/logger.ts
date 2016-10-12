import * as vscode from 'vscode';
import * as moment from 'moment';

export default class Logger {

  private static logOutput: vscode.OutputChannel = vscode.window.createOutputChannel('Webstrates Editor');

  private classFunction: Function;

  constructor(classFunction: Function) {
    this.classFunction = classFunction;
  }

  public static getLogger(classFunction: Function) : Logger {
    return new Logger(classFunction);
  }

  public info(message: string) {
    this.log("INFO", message);
  }

  public debug(message: string) {
    this.log("DEBUG", message);
  }

  public error(message: string, error: any = null) {
    message = `${message}
    ${error}`;

    this.log("ERROR", message);
  }

  public warn(message: string) {
    this.log("WARN", message);
  }

  private log(logType: string, message: string) {
    const timestamp = moment().format("MM/DD/YYYY HH:mm:ss.SSS");
    Logger.logOutput.appendLine(`[${timestamp}] [${logType}] [${this.classFunction.name}]\t${message}`);
  }
}