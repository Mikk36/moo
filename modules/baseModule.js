/**
 * Created by Mikk on 4.07.2015.
 */
"use strict";

class BaseModule {
  /**
   * Explode a string with a limit
   * @param {string} input
   * @param {string} delimiter
   * @param {number} [limit]
   * @returns {string[]}
   */
  static explode(input, delimiter, limit) {
    var s = input.split(delimiter);
    if (limit > 0) {
      if (limit >= s.length) {
        return s;
      }
      return s.slice(0, limit - 1).concat([s.slice(limit - 1).join(delimiter)]);
    }
    return s;
  }

  /**
   * Pad a string with zeroes so it has at least a length of two
   * @param {string} input
   * @returns {string}
   */
  static pad(input) {
    input = input.toString();
    if (input.length < 2) {
      input = "0" + input;
    }
    return input;
  }
}

module.exports = BaseModule;
