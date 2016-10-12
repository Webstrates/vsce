//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

import Timer from '../src/utils/timer';

// Defines a Mocha test suite to group tests of similar kind together
suite("Timer Tests", () => {

  test("Elapsed Event (100ms)", done => {

    const timer = new Timer(100);
    timer.onElapsed(() => {
      done();
    });
    timer.start();
  });

  test("Elapsed Event (0ms)", done => {

    const timer = new Timer(0);
    timer.onElapsed(() => {
      done();
    });
    timer.start();
  });

  test("Tick Event", done => {

    let tickCount = 0;

    const timer = new Timer(100, 10);
    timer.onTick(({ duration }) => {
      if (++tickCount >= 10) {
        assert.equal(tickCount, 10, "tick count should be 10");
        done();
      }
    });
    timer.start();
  });

  test("Pause & Resume", done => {

    let tickCount = 0;

    const timer = new Timer(100, 10);
    timer.onTick(({ duration }) => {

      if (++tickCount >= 10) {
        assert.equal(tickCount, 10, "tick count should be 10");
        done();
      }

      if (tickCount === 5) {
        timer.pause();
        timer.start();
      }
    });
    timer.start();
  });

  test("Stop & Resume", done => {

    let tickCount = 0;

    const timer = new Timer(100, 10);
    timer.onTick(({ duration }) => {

      if (++tickCount >= 15) {
        assert.equal(tickCount, 15, "tick count should be 15");
        done();
      }

      if (tickCount === 5) {
        timer.stop();
        timer.start();
      }
    });
    timer.start();
  });

  test("Pause, Reset, & Resume", done => {

    let tickCount = 0;

    const timer = new Timer(100, 10);
    timer.onTick(({ duration }) => {

      if (++tickCount >= 15) {
        assert.equal(tickCount, 15, "tick count should be 15");
        done();
      }

      if (tickCount === 5) {
        timer.pause();
        timer.reset();
        timer.start();
      }
    });
    timer.start();
  });
});