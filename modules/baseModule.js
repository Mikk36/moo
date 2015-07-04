/**
 * Created by Mikk on 4.07.2015.
 */

class BaseModule {
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

  static pad(input) {
    input = input.toString();
    if (input.length < 2) {
      input = "0" + input;
    }
    return input;
  }
}

module.exports = BaseModule;
