import * as vscode from 'vscode';

const ee = require('event-emitter');
const allOff = require('event-emitter/all-off');

/**
 * Simple timer implementation allowing to register elapsed and tick event listeners.
 * However, it is not accurate in terms of actual clock as setInterval execution highly
 * depends on CPU load and under low or heavy CPU load each tick could be less or greater
 * than the set tick interval. This will also lead to an earlier or later elapsed event
 * trigger.
 * 
 * TODO Calculate tick times based on actual Date diffing between start timer and current
 * time. This difference between the diffed time and the expected elapsed tick time will
 * then determine the next tick timeout (use setTimeout instead of setInterval).
 * 
 * @export
 * @class Timer
 * @implements {vscode.Disposable}
 */
export default class Timer implements vscode.Disposable {

  private static EVENT_NAME_ELAPSED: string = "elapsed";
  private static EVENT_NAME_TICK: string = "tick";

  private emitter: any;
  private duration: number;
  private durationToElapse: number;

  // The setInterval handle to stop or pause timeout.
  private tickIntervalHandle; any;
  private tickInterval: number;

  /**
   * Creates an instance of Timer. The mandatory parameter is the timer duration,
   * which defines when the timer elapsed event is triggered. The optional tick
   * interval defines the interval at which tick events are triggered.
   * 
   * @param {number} duration The timer duration before it elapses.
   * @param {number} [tickInterval=1000] The tick time triggered each timer tick.
   * 
   * @memberOf Timer
   */
  constructor(duration: number, tickInterval: number = 1000) {
    this.emitter = ee({});
    this.duration = duration;
    this.durationToElapse = duration;
    this.tickInterval = tickInterval > duration ? duration : tickInterval;
  }

  /**
   * Register an elapsed event listener, which will be called when the timer elapses.
   * 
   * @param {any} listener The event listener called when the timer elapses.
   * @returns {Disposable} Object to dispose/unregister event handler.
   * 
   * @memberOf Timer
   */
  public onElapsed(listener) {
    this.emitter.on(Timer.EVENT_NAME_ELAPSED, listener);

    return {
      dispose: () => this.emitter.off(Timer.EVENT_NAME_ELAPSED, listener)
    }
  }

  /**
   * Register a tick event listener, which will be called each time a timer tick
   * happes.
   * 
   * @param {any} listener The event listener called each time the timer tick happens.
   * @returns {Disposable} Object to dispose/unregister event handler.
   * 
   * @memberOf Timer
   */
  public onTick(listener) {
    this.emitter.on(Timer.EVENT_NAME_TICK, listener);

    return {
      dispose: () => this.emitter.off(Timer.EVENT_NAME_TICK, listener)
    }
  }

  /**
   * It will start the timer and call tick event listeners every tick and all registered
   * elapsed event listeners when timer duration elapsed before stopped or paused.
   * 
   * @memberOf Timer
   */
  public start() {

    // Start tick interval. It will call tick event listeners every tick and automatically stop
    // when durationToElapse is < 0 and also immediately call elapsed event listeners.
    this.tickIntervalHandle = setInterval(() => {
      this.durationToElapse -= this.tickInterval;

      // Emit tick event.
      this.emitter.emit(Timer.EVENT_NAME_TICK, {
        duration: this.durationToElapse
      });

      // Stop interval when timer duration elapsed.
      if (this.durationToElapse <= 0) {
        this.durationToElapse = 0;
        this.stop();

        // Emit elapsed event.
        this.emitter.emit(Timer.EVENT_NAME_ELAPSED, {});
      }
    }, this.tickInterval);
  }

  /**
   * Stop timer. This does also reset the timer's elapse time. If start is
   * called again, the timer will start from its max duration time.
   * 
   * @memberOf Timer
   */
  public stop() {
    this.pause();
    this.reset();
  }

  /**
   * Pause timer. This does not reset the timer's elapse time. If start is
   * called again, the timer will continue where it left off.
   * 
   * @memberOf Timer
   */
  public pause() {
    if (this.tickIntervalHandle) {
      clearInterval(this.tickIntervalHandle);
    }
  }

  /**
   * Reset timer to set duration.
   * 
   * @memberOf Timer
   */
  public reset() {
    this.durationToElapse = this.duration;
  }

  /**
   * Dispose timer object and turn off all event listers.
   * 
   * @memberOf Timer
   */
  public dispose() {
    this.stop();
    allOff(this.emitter);
    this.emitter = undefined;
  }
}