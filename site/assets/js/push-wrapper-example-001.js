(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var Push = require('push-wrapper'),
    foreach = require('lodash.foreach'),
    partial = require('lodash.partial'),
    Player = require('./src/player.js'),
    context = window.AudioContext ? new window.AudioContext() : new window.webkitAudioContext(),
    Repetae = require('./src/repetae.js'),
    BPM = require('./src/bpm.js'),
    bpm = new BPM(120),
    Interval = require('./src/interval.js'),
    intervals = {
    '1/4': Interval['4n'](bpm, '1/4'),
    '1/4t': Interval['4nt'](bpm, '1/4t'),
    '1/8': Interval['8n'](bpm, '1/8'),
    '1/8t': Interval['8nt'](bpm, '1/8t'),
    '1/16': Interval['16n'](bpm, '1/16'),
    '1/16t': Interval['16nt'](bpm, '1/16t'),
    '1/32': Interval['32n'](bpm, '1/32'),
    '1/32t': Interval['32nt'](bpm, '1/32t')
},
    samples = ['assets/audio/Bonus_Kick27.mp3', 'assets/audio/snare_turnboot.mp3', 'assets/audio/HandClap.mp3', 'assets/audio/Beat07_Hat.mp3', 'assets/audio/HH_KIT09_100_TMB.mp3', 'assets/audio/clingfilm.mp3', 'assets/audio/tang-1.mp3', 'assets/audio/Cassette808_Tom01.mp3'],
    filter_frequencies = [0, 100, 200, 400, 800, 2000, 6000, 10000, 20000];

window.addEventListener('load', function () {
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({ sysex: true }).then(Push.create_bound_to_web_midi_api).then(off_we_go);
    } else {
        Promise.resolve(new Push({ send: function send(bytes) {} })).then(off_we_go).then(show_no_midi_warning);
    }
});

function show_no_midi_warning() {
    document.getElementById("no-midi-warning").style.display = '';
}

function off_we_go(bound_push) {
    var buttons = document.getElementsByClassName('push-wrapper-button'),
        players = create_players(),
        push = bound_push;

    push.lcd.clear();

    foreach(players, function (player, i) {
        var column_number = i + 1,
            full_path_sample_name = samples[i].split('.')[0],
            sample_name = full_path_sample_name.split('/').pop(),
            repetae = new Repetae(intervals['1/4'], context);

        push.grid.x[column_number].select.on('pressed', repetae.press);
        push.grid.x[column_number].select.on('released', repetae.release);

        push.grid.x[column_number].select.led_on();
        repetae.on('on', partial(push.grid.x[column_number].select.led_rgb, 0, 0, 255));
        repetae.on('off', push.grid.x[column_number].select.led_on);
        repetae.on('interval', push.lcd.x[column_number].y[1].update);

        repetae.report_interval();

        foreach(intervals, function (interval, button_name) {
            push.button[button_name].on('pressed', partial(repetae.interval, interval));
        });

        turn_off_column(push, column_number);
        push.lcd.x[column_number].y[2].update(sample_name.length > 8 ? sample_name.substr(sample_name.length - 8) : sample_name);
        player.on('started', partial(turn_button_display_on, buttons[i]));
        player.on('stopped', partial(turn_button_display_off, buttons[i]));
        player.on('started', partial(turn_on_column, push, column_number));
        player.on('stopped', partial(turn_off_column, push, column_number));

        player.on('pitch', push.lcd.x[column_number].y[4].update);
        push.channel[column_number].knob.on('turned', player.changePitchByInterval);
        player.reportPitch();

        buttons[i].addEventListener('mousedown', function () {
            player.cutOff(filter_frequencies[8]).play(midiGain(110));
        });
        bind_column_to_player(push, player, column_number, repetae);
    });

    foreach(intervals, function (interval, button_name) {
        push.button[button_name].led_dim();
    });

    bind_pitchbend(push, players);

    bindQwertyuiToPlayback(players);
    bind_tempo_knob_to_bpm(push, bpm);
    bpm.report();
}

function create_players() {
    var players = [];
    for (var i = 0; i < samples.length; i++) {
        players[i] = new Player(samples[i], context).toMaster();
    }
    return players;
}

function bind_column_to_player(push, player, x, repetae) {
    var mutable_velocity = 127,
        mutable_frequency = filter_frequencies[8],
        pressed_pads_in_col = 0;

    var playback = function playback() {
        player.cutOff(mutable_frequency).play(midiGain(mutable_velocity));
    };

    foreach([1, 2, 3, 4, 5, 6, 7, 8], function (y) {
        var grid_button = push.grid.x[x].y[y];

        grid_button.on('pressed', function (velocity) {
            mutable_velocity = velocity;
            mutable_frequency = filter_frequencies[y];
            if (++pressed_pads_in_col == 1) repetae.start(playback);
        });
        grid_button.on('aftertouch', function (pressure) {
            if (pressure > 0) mutable_velocity = pressure;
        });
        grid_button.on('released', function () {
            if (--pressed_pads_in_col == 0) repetae.stop();
        });
    });
}

function bindQwertyuiToPlayback(players) {
    var lookup = { 113: 0, 119: 1, 101: 2, 114: 3, 116: 4, 121: 5, 117: 6, 105: 7 };
    window.addEventListener("keypress", function (event) {
        if (event.charCode in lookup) {
            players[lookup[event.charCode]].cutOff(filter_frequencies[8]).play(midiGain(110));
        }
    });
}

function midiGain(_velocity) {
    return {
        velocity: function velocity() {
            return _velocity;
        },
        toAbsolute: function toAbsolute() {
            return _velocity / 127;
        }
    };
}

function turn_on_column(push, x, gain) {
    foreach([1, 2, 3, 4, 5, 6, 7, 8], function (y) {
        if ((gain.velocity() + 15) / 16 >= y) {
            push.grid.x[x].y[y].led_on(gain.velocity());
        } else {
            push.grid.x[x].y[y].led_off();
        }
    });
}

function turn_off_column(push, x) {
    foreach([2, 3, 4, 5, 6, 7, 8], function (y) {
        push.grid.x[x].y[y].led_off();
    });
    push.grid.x[x].y[1].led_on();
}

function bind_pitchbend(push, players) {
    push.touchstrip.on('pitchbend', function (pb) {
        var rate = scale(pb, 0, 16384, -12, 12);
        foreach(players, function (player) {
            return player.modulatePitch(rate);
        });
    });
}

function bind_tempo_knob_to_bpm(push, bpm) {
    push.knob['tempo'].on('turned', bpm.change_by);
    bpm.on('changed', function (bpm) {
        return push.lcd.x[1].y[3].update('bpm= ' + bpm.current);
    });
}

function turn_button_display_on(ui_btn) {
    ui_btn.classList.add('active');
}

function turn_button_display_off(ui_btn) {
    ui_btn.classList.remove('active');
}

function scale(input, minIn, maxIn, minOut, maxOut) {
    return (maxOut - minOut) * ((input - minIn) / (maxIn - minIn)) + minOut;
}

},{"./src/bpm.js":25,"./src/interval.js":26,"./src/player.js":27,"./src/repetae.js":28,"lodash.foreach":9,"lodash.partial":13,"push-wrapper":16}],2:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * A specialized version of `_.forEach` for arrays without support for callback
 * shorthands or `this` binding.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

module.exports = arrayEach;

},{}],3:[function(require,module,exports){
/**
 * lodash 3.0.4 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var keys = require('lodash.keys');

/**
 * Used as the [maximum length](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * The base implementation of `_.forEach` without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array|Object|string} Returns `collection`.
 */
var baseEach = createBaseEach(baseForOwn);

/**
 * The base implementation of `baseForIn` and `baseForOwn` which iterates
 * over `object` properties returned by `keysFunc` invoking `iteratee` for
 * each property. Iteratee functions may exit iteration early by explicitly
 * returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

/**
 * The base implementation of `_.forOwn` without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return baseFor(object, iteratee, keys);
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Creates a `baseEach` or `baseEachRight` function.
 *
 * @private
 * @param {Function} eachFunc The function to iterate over a collection.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseEach(eachFunc, fromRight) {
  return function(collection, iteratee) {
    var length = collection ? getLength(collection) : 0;
    if (!isLength(length)) {
      return eachFunc(collection, iteratee);
    }
    var index = fromRight ? length : -1,
        iterable = toObject(collection);

    while ((fromRight ? index-- : ++index < length)) {
      if (iteratee(iterable[index], index, iterable) === false) {
        break;
      }
    }
    return collection;
  };
}

/**
 * Creates a base function for `_.forIn` or `_.forInRight`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var iterable = toObject(object),
        props = keysFunc(object),
        length = props.length,
        index = fromRight ? length : -1;

    while ((fromRight ? index-- : ++index < length)) {
      var key = props[index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Converts `value` to an object if it's not one.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {Object} Returns the object.
 */
function toObject(value) {
  return isObject(value) ? value : Object(value);
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = baseEach;

},{"lodash.keys":12}],4:[function(require,module,exports){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * A specialized version of `baseCallback` which only supports `this` binding
 * and specifying the number of arguments to provide to `func`.
 *
 * @private
 * @param {Function} func The function to bind.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {number} [argCount] The number of arguments to provide to `func`.
 * @returns {Function} Returns the callback.
 */
function bindCallback(func, thisArg, argCount) {
  if (typeof func != 'function') {
    return identity;
  }
  if (thisArg === undefined) {
    return func;
  }
  switch (argCount) {
    case 1: return function(value) {
      return func.call(thisArg, value);
    };
    case 3: return function(value, index, collection) {
      return func.call(thisArg, value, index, collection);
    };
    case 4: return function(accumulator, value, index, collection) {
      return func.call(thisArg, accumulator, value, index, collection);
    };
    case 5: return function(value, other, key, object, source) {
      return func.call(thisArg, value, other, key, object, source);
    };
  }
  return function() {
    return func.apply(thisArg, arguments);
  };
}

/**
 * This method returns the first argument provided to it.
 *
 * @static
 * @memberOf _
 * @category Utility
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.identity(object) === object;
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = bindCallback;

},{}],5:[function(require,module,exports){
/**
 * lodash 3.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var root = require('lodash._root');

/** Used to compose bitmasks for wrapper metadata. */
var BIND_FLAG = 1,
    BIND_KEY_FLAG = 2,
    CURRY_BOUND_FLAG = 4,
    CURRY_FLAG = 8,
    CURRY_RIGHT_FLAG = 16,
    PARTIAL_FLAG = 32,
    PARTIAL_RIGHT_FLAG = 64,
    ARY_FLAG = 128,
    FLIP_FLAG = 512;

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** Used as the internal argument placeholder. */
var PLACEHOLDER = '__lodash_placeholder__';

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {...*} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  var length = args.length;
  switch (length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Replaces all `placeholder` elements in `array` with an internal placeholder
 * and returns an array of their indexes.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {*} placeholder The placeholder to replace.
 * @returns {Array} Returns the new array of placeholder indexes.
 */
function replaceHolders(array, placeholder) {
  var index = -1,
      length = array.length,
      resIndex = -1,
      result = [];

  while (++index < length) {
    if (array[index] === placeholder) {
      array[index] = PLACEHOLDER;
      result[++resIndex] = index;
    }
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max,
    nativeMin = Math.min;

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} prototype The object to inherit from.
 * @returns {Object} Returns the new object.
 */
var baseCreate = (function() {
  function object() {}
  return function(prototype) {
    if (isObject(prototype)) {
      object.prototype = prototype;
      var result = new object;
      object.prototype = undefined;
    }
    return result || {};
  };
}());

/**
 * Creates an array that is the composition of partially applied arguments,
 * placeholders, and provided arguments into a single array of arguments.
 *
 * @private
 * @param {Array|Object} args The provided arguments.
 * @param {Array} partials The arguments to prepend to those provided.
 * @param {Array} holders The `partials` placeholder indexes.
 * @returns {Array} Returns the new array of composed arguments.
 */
function composeArgs(args, partials, holders) {
  var holdersLength = holders.length,
      argsIndex = -1,
      argsLength = nativeMax(args.length - holdersLength, 0),
      leftIndex = -1,
      leftLength = partials.length,
      result = Array(leftLength + argsLength);

  while (++leftIndex < leftLength) {
    result[leftIndex] = partials[leftIndex];
  }
  while (++argsIndex < holdersLength) {
    result[holders[argsIndex]] = args[argsIndex];
  }
  while (argsLength--) {
    result[leftIndex++] = args[argsIndex++];
  }
  return result;
}

/**
 * This function is like `composeArgs` except that the arguments composition
 * is tailored for `_.partialRight`.
 *
 * @private
 * @param {Array|Object} args The provided arguments.
 * @param {Array} partials The arguments to append to those provided.
 * @param {Array} holders The `partials` placeholder indexes.
 * @returns {Array} Returns the new array of composed arguments.
 */
function composeArgsRight(args, partials, holders) {
  var holdersIndex = -1,
      holdersLength = holders.length,
      argsIndex = -1,
      argsLength = nativeMax(args.length - holdersLength, 0),
      rightIndex = -1,
      rightLength = partials.length,
      result = Array(argsLength + rightLength);

  while (++argsIndex < argsLength) {
    result[argsIndex] = args[argsIndex];
  }
  var offset = argsIndex;
  while (++rightIndex < rightLength) {
    result[offset + rightIndex] = partials[rightIndex];
  }
  while (++holdersIndex < holdersLength) {
    result[offset + holders[holdersIndex]] = args[argsIndex++];
  }
  return result;
}

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

/**
 * Creates a function that wraps `func` to invoke it with the optional `this`
 * binding of `thisArg`.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createBaseWrapper(func, bitmask, thisArg) {
  var isBind = bitmask & BIND_FLAG,
      Ctor = createCtorWrapper(func);

  function wrapper() {
    var fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;
    return fn.apply(isBind ? thisArg : this, arguments);
  }
  return wrapper;
}

/**
 * Creates a function that produces an instance of `Ctor` regardless of
 * whether it was invoked as part of a `new` expression or by `call` or `apply`.
 *
 * @private
 * @param {Function} Ctor The constructor to wrap.
 * @returns {Function} Returns the new wrapped function.
 */
function createCtorWrapper(Ctor) {
  return function() {
    // Use a `switch` statement to work with class constructors.
    // See http://ecma-international.org/ecma-262/6.0/#sec-ecmascript-function-objects-call-thisargument-argumentslist
    // for more details.
    var args = arguments;
    switch (args.length) {
      case 0: return new Ctor;
      case 1: return new Ctor(args[0]);
      case 2: return new Ctor(args[0], args[1]);
      case 3: return new Ctor(args[0], args[1], args[2]);
      case 4: return new Ctor(args[0], args[1], args[2], args[3]);
      case 5: return new Ctor(args[0], args[1], args[2], args[3], args[4]);
      case 6: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
      case 7: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
    }
    var thisBinding = baseCreate(Ctor.prototype),
        result = Ctor.apply(thisBinding, args);

    // Mimic the constructor's `return` behavior.
    // See https://es5.github.io/#x13.2.2 for more details.
    return isObject(result) ? result : thisBinding;
  };
}

/**
 * Creates a function that wraps `func` to enable currying.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {number} arity The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createCurryWrapper(func, bitmask, arity) {
  var Ctor = createCtorWrapper(func);

  function wrapper() {
    var length = arguments.length,
        index = length,
        args = Array(length),
        fn = (this && this !== root && this instanceof wrapper) ? Ctor : func,
        placeholder = wrapper.placeholder;

    while (index--) {
      args[index] = arguments[index];
    }
    var holders = (length < 3 && args[0] !== placeholder && args[length - 1] !== placeholder)
      ? []
      : replaceHolders(args, placeholder);

    length -= holders.length;
    return length < arity
      ? createRecurryWrapper(func, bitmask, createHybridWrapper, placeholder, undefined, args, holders, undefined, undefined, arity - length)
      : apply(fn, this, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to invoke it with optional `this`
 * binding of `thisArg`, partial application, and currying.
 *
 * @private
 * @param {Function|string} func The function or method name to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to prepend to those provided to the new function.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [partialsRight] The arguments to append to those provided to the new function.
 * @param {Array} [holdersRight] The `partialsRight` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createHybridWrapper(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity) {
  var isAry = bitmask & ARY_FLAG,
      isBind = bitmask & BIND_FLAG,
      isBindKey = bitmask & BIND_KEY_FLAG,
      isCurry = bitmask & CURRY_FLAG,
      isCurryRight = bitmask & CURRY_RIGHT_FLAG,
      isFlip = bitmask & FLIP_FLAG,
      Ctor = isBindKey ? undefined : createCtorWrapper(func);

  function wrapper() {
    var length = arguments.length,
        index = length,
        args = Array(length);

    while (index--) {
      args[index] = arguments[index];
    }
    if (partials) {
      args = composeArgs(args, partials, holders);
    }
    if (partialsRight) {
      args = composeArgsRight(args, partialsRight, holdersRight);
    }
    if (isCurry || isCurryRight) {
      var placeholder = wrapper.placeholder,
          argsHolders = replaceHolders(args, placeholder);

      length -= argsHolders.length;
      if (length < arity) {
        return createRecurryWrapper(func, bitmask, createHybridWrapper, placeholder, thisArg, args, argsHolders, argPos, ary, arity - length);
      }
    }
    var thisBinding = isBind ? thisArg : this,
        fn = isBindKey ? thisBinding[func] : func;

    if (argPos) {
      args = reorder(args, argPos);
    } else if (isFlip && args.length > 1) {
      args.reverse();
    }
    if (isAry && ary < args.length) {
      args.length = ary;
    }
    if (this && this !== root && this instanceof wrapper) {
      fn = Ctor || createCtorWrapper(fn);
    }
    return fn.apply(thisBinding, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to invoke it with the optional `this`
 * binding of `thisArg` and the `partials` prepended to those provided to
 * the wrapper.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} partials The arguments to prepend to those provided to the new function.
 * @returns {Function} Returns the new wrapped function.
 */
function createPartialWrapper(func, bitmask, thisArg, partials) {
  var isBind = bitmask & BIND_FLAG,
      Ctor = createCtorWrapper(func);

  function wrapper() {
    var argsIndex = -1,
        argsLength = arguments.length,
        leftIndex = -1,
        leftLength = partials.length,
        args = Array(leftLength + argsLength),
        fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;

    while (++leftIndex < leftLength) {
      args[leftIndex] = partials[leftIndex];
    }
    while (argsLength--) {
      args[leftIndex++] = arguments[++argsIndex];
    }
    return apply(fn, isBind ? thisArg : this, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to continue currying.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {Function} wrapFunc The function to create the `func` wrapper.
 * @param {*} placeholder The placeholder to replace.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to prepend to those provided to the new function.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createRecurryWrapper(func, bitmask, wrapFunc, placeholder, thisArg, partials, holders, argPos, ary, arity) {
  var isCurry = bitmask & CURRY_FLAG,
      newArgPos = argPos ? copyArray(argPos) : undefined,
      newsHolders = isCurry ? holders : undefined,
      newHoldersRight = isCurry ? undefined : holders,
      newPartials = isCurry ? partials : undefined,
      newPartialsRight = isCurry ? undefined : partials;

  bitmask |= (isCurry ? PARTIAL_FLAG : PARTIAL_RIGHT_FLAG);
  bitmask &= ~(isCurry ? PARTIAL_RIGHT_FLAG : PARTIAL_FLAG);

  if (!(bitmask & CURRY_BOUND_FLAG)) {
    bitmask &= ~(BIND_FLAG | BIND_KEY_FLAG);
  }
  var result = wrapFunc(func, bitmask, thisArg, newPartials, newsHolders, newPartialsRight, newHoldersRight, newArgPos, ary, arity);

  result.placeholder = placeholder;
  return result;
}

/**
 * Creates a function that either curries or invokes `func` with optional
 * `this` binding and partially applied arguments.
 *
 * @private
 * @param {Function|string} func The function or method name to wrap.
 * @param {number} bitmask The bitmask of wrapper flags.
 *  The bitmask may be composed of the following flags:
 *     1 - `_.bind`
 *     2 - `_.bindKey`
 *     4 - `_.curry` or `_.curryRight` of a bound function
 *     8 - `_.curry`
 *    16 - `_.curryRight`
 *    32 - `_.partial`
 *    64 - `_.partialRight`
 *   128 - `_.rearg`
 *   256 - `_.ary`
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to be partially applied.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createWrapper(func, bitmask, thisArg, partials, holders, argPos, ary, arity) {
  var isBindKey = bitmask & BIND_KEY_FLAG;
  if (!isBindKey && typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var length = partials ? partials.length : 0;
  if (!length) {
    bitmask &= ~(PARTIAL_FLAG | PARTIAL_RIGHT_FLAG);
    partials = holders = undefined;
  }
  ary = ary === undefined ? ary : nativeMax(toInteger(ary), 0);
  arity = arity === undefined ? arity : toInteger(arity);
  length -= holders ? holders.length : 0;

  if (bitmask & PARTIAL_RIGHT_FLAG) {
    var partialsRight = partials,
        holdersRight = holders;

    partials = holders = undefined;
  }
  var newData = [func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity];

  func = newData[0];
  bitmask = newData[1];
  thisArg = newData[2];
  partials = newData[3];
  holders = newData[4];
  arity = newData[9] = newData[9] == null
    ? (isBindKey ? 0 : func.length)
    : nativeMax(newData[9] - length, 0);

  if (!arity && bitmask & (CURRY_FLAG | CURRY_RIGHT_FLAG)) {
    bitmask &= ~(CURRY_FLAG | CURRY_RIGHT_FLAG);
  }
  if (!bitmask || bitmask == BIND_FLAG) {
    var result = createBaseWrapper(func, bitmask, thisArg);
  } else if (bitmask == CURRY_FLAG || bitmask == CURRY_RIGHT_FLAG) {
    result = createCurryWrapper(func, bitmask, arity);
  } else if ((bitmask == PARTIAL_FLAG || bitmask == (BIND_FLAG | PARTIAL_FLAG)) && !holders.length) {
    result = createPartialWrapper(func, bitmask, thisArg, partials);
  } else {
    result = createHybridWrapper.apply(undefined, newData);
  }
  return result;
}

/**
 * Reorder `array` according to the specified indexes where the element at
 * the first index is assigned as the first element, the element at
 * the second index is assigned as the second element, and so on.
 *
 * @private
 * @param {Array} array The array to reorder.
 * @param {Array} indexes The arranged array indexes.
 * @returns {Array} Returns `array`.
 */
function reorder(array, indexes) {
  var arrLength = array.length,
      length = nativeMin(indexes.length, arrLength),
      oldArray = copyArray(array);

  while (length--) {
    var index = indexes[length];
    array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined;
  }
  return array;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3');
 * // => 3
 */
function toInteger(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  var remainder = value % 1;
  return value === value ? (remainder ? value - remainder : value) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = createWrapper;

},{"lodash._root":8}],6:[function(require,module,exports){
/**
 * lodash 3.9.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var funcTag = '[object Function]';

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = getNative;

},{}],7:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the internal argument placeholder. */
var PLACEHOLDER = '__lodash_placeholder__';

/**
 * Replaces all `placeholder` elements in `array` with an internal placeholder
 * and returns an array of their indexes.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {*} placeholder The placeholder to replace.
 * @returns {Array} Returns the new array of placeholder indexes.
 */
function replaceHolders(array, placeholder) {
  var index = -1,
      length = array.length,
      resIndex = -1,
      result = [];

  while (++index < length) {
    if (array[index] === placeholder) {
      array[index] = PLACEHOLDER;
      result[++resIndex] = index;
    }
  }
  return result;
}

module.exports = replaceHolders;

},{}],8:[function(require,module,exports){
(function (global){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

module.exports = root;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],9:[function(require,module,exports){
/**
 * lodash 3.0.3 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var arrayEach = require('lodash._arrayeach'),
    baseEach = require('lodash._baseeach'),
    bindCallback = require('lodash._bindcallback'),
    isArray = require('lodash.isarray');

/**
 * Creates a function for `_.forEach` or `_.forEachRight`.
 *
 * @private
 * @param {Function} arrayFunc The function to iterate over an array.
 * @param {Function} eachFunc The function to iterate over a collection.
 * @returns {Function} Returns the new each function.
 */
function createForEach(arrayFunc, eachFunc) {
  return function(collection, iteratee, thisArg) {
    return (typeof iteratee == 'function' && thisArg === undefined && isArray(collection))
      ? arrayFunc(collection, iteratee)
      : eachFunc(collection, bindCallback(iteratee, thisArg, 3));
  };
}

/**
 * Iterates over elements of `collection` invoking `iteratee` for each element.
 * The `iteratee` is bound to `thisArg` and invoked with three arguments:
 * (value, index|key, collection). Iteratee functions may exit iteration early
 * by explicitly returning `false`.
 *
 * **Note:** As with other "Collections" methods, objects with a "length" property
 * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
 * may be used for object iteration.
 *
 * @static
 * @memberOf _
 * @alias each
 * @category Collection
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @param {*} [thisArg] The `this` binding of `iteratee`.
 * @returns {Array|Object|string} Returns `collection`.
 * @example
 *
 * _([1, 2]).forEach(function(n) {
 *   console.log(n);
 * }).value();
 * // => logs each value from left to right and returns the array
 *
 * _.forEach({ 'a': 1, 'b': 2 }, function(n, key) {
 *   console.log(n, key);
 * });
 * // => logs each value-key pair and returns the object (iteration order is not guaranteed)
 */
var forEach = createForEach(arrayEach, baseEach);

module.exports = forEach;

},{"lodash._arrayeach":2,"lodash._baseeach":3,"lodash._bindcallback":4,"lodash.isarray":11}],10:[function(require,module,exports){
/**
 * lodash 3.0.8 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value)) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array and weak map constructors,
  // and PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isArguments;

},{}],11:[function(require,module,exports){
/**
 * lodash 3.0.4 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var arrayTag = '[object Array]',
    funcTag = '[object Function]';

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/* Native method references for those with the same name as other `lodash` methods. */
var nativeIsArray = getNative(Array, 'isArray');

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(function() { return arguments; }());
 * // => false
 */
var isArray = nativeIsArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
};

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = isArray;

},{}],12:[function(require,module,exports){
/**
 * lodash 3.1.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var getNative = require('lodash._getnative'),
    isArguments = require('lodash.isarguments'),
    isArray = require('lodash.isarray');

/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/* Native method references for those with the same name as other `lodash` methods. */
var nativeKeys = getNative(Object, 'keys');

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * A fallback implementation of `Object.keys` which creates an array of the
 * own enumerable property names of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function shimKeys(object) {
  var props = keysIn(object),
      propsLength = props.length,
      length = propsLength && object.length;

  var allowIndexes = !!length && isLength(length) &&
    (isArray(object) || isArguments(object));

  var index = -1,
      result = [];

  while (++index < propsLength) {
    var key = props[index];
    if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
var keys = !nativeKeys ? shimKeys : function(object) {
  var Ctor = object == null ? undefined : object.constructor;
  if ((typeof Ctor == 'function' && Ctor.prototype === object) ||
      (typeof object != 'function' && isArrayLike(object))) {
    return shimKeys(object);
  }
  return isObject(object) ? nativeKeys(object) : [];
};

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  if (object == null) {
    return [];
  }
  if (!isObject(object)) {
    object = Object(object);
  }
  var length = object.length;
  length = (length && isLength(length) &&
    (isArray(object) || isArguments(object)) && length) || 0;

  var Ctor = object.constructor,
      index = -1,
      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
      result = Array(length),
      skipIndexes = length > 0;

  while (++index < length) {
    result[index] = (index + '');
  }
  for (var key in object) {
    if (!(skipIndexes && isIndex(key, length)) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keys;

},{"lodash._getnative":6,"lodash.isarguments":10,"lodash.isarray":11}],13:[function(require,module,exports){
/**
 * lodash 3.1.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var createWrapper = require('lodash._createwrapper'),
    replaceHolders = require('lodash._replaceholders'),
    restParam = require('lodash.restparam');

/** Used to compose bitmasks for wrapper metadata. */
var PARTIAL_FLAG = 32;

/**
 * Creates a `_.partial` or `_.partialRight` function.
 *
 * @private
 * @param {boolean} flag The partial bit flag.
 * @returns {Function} Returns the new partial function.
 */
function createPartial(flag) {
  var partialFunc = restParam(function(func, partials) {
    var holders = replaceHolders(partials, partialFunc.placeholder);
    return createWrapper(func, flag, undefined, partials, holders);
  });
  return partialFunc;
}

/**
 * Creates a function that invokes `func` with `partial` arguments prepended
 * to those provided to the new function. This method is like `_.bind` except
 * it does **not** alter the `this` binding.
 *
 * The `_.partial.placeholder` value, which defaults to `_` in monolithic
 * builds, may be used as a placeholder for partially applied arguments.
 *
 * **Note:** This method does not set the "length" property of partially
 * applied functions.
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to partially apply arguments to.
 * @param {...*} [partials] The arguments to be partially applied.
 * @returns {Function} Returns the new partially applied function.
 * @example
 *
 * var greet = function(greeting, name) {
 *   return greeting + ' ' + name;
 * };
 *
 * var sayHelloTo = _.partial(greet, 'hello');
 * sayHelloTo('fred');
 * // => 'hello fred'
 *
 * // using placeholders
 * var greetFred = _.partial(greet, _, 'fred');
 * greetFred('hi');
 * // => 'hi fred'
 */
var partial = createPartial(PARTIAL_FLAG);

// Assign default placeholders.
partial.placeholder = {};

module.exports = partial;

},{"lodash._createwrapper":5,"lodash._replaceholders":7,"lodash.restparam":15}],14:[function(require,module,exports){
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991,
    NAN = 0 / 0;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    symbolTag = '[object Symbol]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeCeil = Math.ceil,
    nativeMax = Math.max;

/**
 * The base implementation of `_.range` and `_.rangeRight` which doesn't
 * coerce arguments.
 *
 * @private
 * @param {number} start The start of the range.
 * @param {number} end The end of the range.
 * @param {number} step The value to increment or decrement by.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Array} Returns the range of numbers.
 */
function baseRange(start, end, step, fromRight) {
  var index = -1,
      length = nativeMax(nativeCeil((end - start) / (step || 1)), 0),
      result = Array(length);

  while (length--) {
    result[fromRight ? length : ++index] = start;
    start += step;
  }
  return result;
}

/**
 * Creates a `_.range` or `_.rangeRight` function.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new range function.
 */
function createRange(fromRight) {
  return function(start, end, step) {
    if (step && typeof step != 'number' && isIterateeCall(start, end, step)) {
      end = step = undefined;
    }
    // Ensure the sign of `-0` is preserved.
    start = toNumber(start);
    start = start === start ? start : 0;
    if (end === undefined) {
      end = start;
      start = 0;
    } else {
      end = toNumber(end) || 0;
    }
    step = step === undefined ? (start < end ? 1 : -1) : (toNumber(step) || 0);
    return baseRange(start, end, step, fromRight);
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a
 * [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792) that affects
 * Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
 *  else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
        ? (isArrayLike(object) && isIndex(index, object.length))
        : (type == 'string' && index in object)
      ) {
    return eq(object[index], value);
  }
  return false;
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value)) && !isFunction(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array and weak map constructors,
  // and PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length,
 *  else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/6.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */
function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

/**
 * Creates an array of numbers (positive and/or negative) progressing from
 * `start` up to, but not including, `end`. A step of `-1` is used if a negative
 * `start` is specified without an `end` or `step`. If `end` is not specified,
 * it's set to `start` with `start` then set to `0`.
 *
 * **Note:** JavaScript follows the IEEE-754 standard for resolving
 * floating-point values which can produce unexpected results.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {number} [start=0] The start of the range.
 * @param {number} end The end of the range.
 * @param {number} [step=1] The value to increment or decrement by.
 * @returns {Array} Returns the range of numbers.
 * @see _.inRange, _.rangeRight
 * @example
 *
 * _.range(4);
 * // => [0, 1, 2, 3]
 *
 * _.range(-4);
 * // => [0, -1, -2, -3]
 *
 * _.range(1, 5);
 * // => [1, 2, 3, 4]
 *
 * _.range(0, 20, 5);
 * // => [0, 5, 10, 15]
 *
 * _.range(0, -4, -1);
 * // => [0, -1, -2, -3]
 *
 * _.range(1, 4, 0);
 * // => [1, 1, 1]
 *
 * _.range(0);
 * // => []
 */
var range = createRange();

module.exports = range;

},{}],15:[function(require,module,exports){
/**
 * lodash 3.6.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that invokes `func` with the `this` binding of the
 * created function and arguments from `start` and beyond provided as an array.
 *
 * **Note:** This method is based on the [rest parameter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters).
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var say = _.restParam(function(what, names) {
 *   return what + ' ' + _.initial(names).join(', ') +
 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
 * });
 *
 * say('hello', 'fred', 'barney', 'pebbles');
 * // => 'hello fred, barney, & pebbles'
 */
function restParam(func, start) {
  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  start = nativeMax(start === undefined ? (func.length - 1) : (+start || 0), 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        rest = Array(length);

    while (++index < length) {
      rest[index] = args[start + index];
    }
    switch (start) {
      case 0: return func.call(this, rest);
      case 1: return func.call(this, args[0], rest);
      case 2: return func.call(this, args[0], args[1], rest);
    }
    var otherArgs = Array(start + 1);
    index = -1;
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = rest;
    return func.apply(this, otherArgs);
  };
}

module.exports = restParam;

},{}],16:[function(require,module,exports){
'use strict';

// Public API/node-module for the Push

var EventEmitter = require('events'),
    util = require('util'),
    Buttons = require('./src/buttons.js'),
    Knobs = require('./src/knobs'),
    Grid = require('./src/grid.js'),
    Touchstrip = require('./src/touchstrip.js'),
    ControlButtons = require('./src/control-buttons.js'),
    LCDs = require('./src/lcds.js'),
    foreach = require('lodash.foreach'),
    partial = require('lodash.partial'),
    one_to_eight = [1, 2, 3, 4, 5, 6, 7, 8];

function Push(midi_out_port) {
    var _this = this;

    EventEmitter.call(this);

    var midi_out = {
        send_cc: function send_cc(cc, value) {
            midi_out_port.send([176, cc, value]);
        },
        send_note: function send_note(note, velocity) {
            midi_out_port.send([144, note, velocity]);
        },
        send_sysex: function send_sysex(data) {
            midi_out_port.send([240, 71, 127, 21].concat(data).concat([247]));
        }
    };

    var buttons = new Buttons(midi_out.send_cc);
    this.knobs = new Knobs();
    this.grid = new Grid(midi_out.send_note, midi_out.send_cc, midi_out.send_sysex);
    this.touchstrip = new Touchstrip();
    this.control = new ControlButtons(midi_out.send_cc);
    this.ccMap = [];
    this.noteMap = [];

    foreach([this.knobs, this.touchstrip, this.grid], function (module) {
        return foreach(module.handled_notes, function (value, key) {
            return _this.noteMap[value] = module;
        });
    });

    foreach([this.knobs, this.control, buttons, this.grid], function (module) {
        return foreach(module.handled_ccs, function (value, key) {
            return _this.ccMap[value] = module;
        });
    });

    // Defines public API returned
    var api = {
        knob: {
            tempo: this.knobs.tempo,
            swing: this.knobs.swing,
            master: this.knobs.master
        },
        grid: { x: {} },
        touchstrip: this.touchstrip,
        lcd: new LCDs(midi_out.send_sysex),
        button: {
            '1/32t': this.control['1/32t'],
            '1/32': this.control['1/32'],
            '1/16t': this.control['1/16t'],
            '1/16': this.control['1/16'],
            '1/8t': this.control['1/8t'],
            '1/8': this.control['1/8'],
            '1/4t': this.control['1/4t'],
            '1/4': this.control['1/4']
        },
        channel: {},
        receive_midi: partial(receive_midi, this)
    };
    foreach(one_to_eight, function (number) {
        return api.channel[number] = { knob: _this.knobs[number], select: _this.control[number] };
    });
    foreach(one_to_eight, function (X) {
        api.grid.x[X] = { y: {}, select: _this.grid.select[X] };
        foreach(one_to_eight, function (Y) {
            api.grid.x[X].y[Y] = _this.grid.x[X].y[Y];
        });
    });
    foreach(buttons.names, function (button_name) {
        return api.button[button_name] = buttons[button_name];
    });
    return api;
}
util.inherits(Push, EventEmitter);

function handle_midi_cc(push, index, value) {
    if (index in push.ccMap) {
        push.ccMap[index].receive_midi_cc(index, value);
    } else {
        console.log('No known mapping for CC: ' + index);
    }
}

function handle_midi_note(push, note, velocity) {
    if (note in push.noteMap) {
        push.noteMap[note].receive_midi_note(note, velocity);
    } else {
        console.log('No known mapping for note: ' + note);
    }
}

function handle_midi_pitch_bend(push, lsb_byte, msb_byte) {
    push.touchstrip.receive_midi_pitch_bend((msb_byte << 7) + lsb_byte);
}

function handle_midi_poly_pressure(push, note, pressure) {
    push.grid.receive_midi_poly_pressure(note, pressure);
}

var midi_messages = {
    'note-off': 128, // note number, velocity
    'note-on': 144, // note number, velocity
    'poly-pressure': 160, // note number, velocity
    'cc': 176, // cc number, value
    'program-change': 192, // pgm number
    'channel-pressure': 208, // velocity
    'pitch-bend': 224, // lsb (7-bits), msb (7-bits)
    'sysex': 240 };

// Handles MIDI (CC) data from Push - causes events to be emitted
function receive_midi(push, bytes) {
    var message_type = bytes[0] & 0xf0;
    var midi_channel = bytes[0] & 0x0f;

    switch (message_type) {
        case midi_messages['cc']:
            handle_midi_cc(push, bytes[1], bytes[2]);
            break;
        case midi_messages['note-on']:
        case midi_messages['note-off']:
            handle_midi_note(push, bytes[1], bytes[2]);
            break;
        case midi_messages['pitch-bend']:
            handle_midi_pitch_bend(push, bytes[1], bytes[2]);
            break;
        case midi_messages['poly-pressure']:
            handle_midi_poly_pressure(push, bytes[1], bytes[2]);
            break;
    }
}

// Adaptor function used to bind to web MIDI API
Push.create_bound_to_web_midi_api = function (midiAccess) {
    var inputs = midiAccess.inputs.values(),
        outputs = midiAccess.outputs.values(),
        push;

    for (var output = outputs.next(); output && !output.done; output = outputs.next()) {
        console.log('Found output: ' + output.value.name);
        if ('Ableton Push User Port' == output.value.name) {
            console.log('Binding MIDI output to ' + output.value.name);
            push = new Push(output.value);
            break;
        }
    }

    if (push === undefined) push = new Push({ send: function send(bytes) {} });

    for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
        console.log('Found input: ' + input.value.name);
        if ('Ableton Push User Port' == input.value.name) {
            console.log('Binding MIDI input to ' + input.value.name);
            input.value.onmidimessage = function (event) {
                push.receive_midi(event.data);
            };
            break;
        }
    }

    return push;
};

module.exports = Push;

},{"./src/buttons.js":17,"./src/control-buttons.js":18,"./src/grid.js":19,"./src/knobs":20,"./src/lcds.js":21,"./src/touchstrip.js":22,"events":29,"lodash.foreach":9,"lodash.partial":13,"util":33}],17:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach');

var ccToButtonMap = {
    3: 'tap_tempo',
    9: 'metronome',
    119: 'undo',
    118: 'delete',
    117: 'double',
    116: 'quantize',
    90: 'fixed_length',
    89: 'automation',
    88: 'duplicate',
    87: 'new',
    86: 'rec',
    85: 'play',
    28: 'master',
    29: 'stop',
    44: 'left',
    45: 'right',
    46: 'up',
    47: 'down',
    114: 'volume',
    115: 'pan_&_send',
    112: 'track',
    113: 'clip',
    110: 'device',
    111: 'browse',
    62: 'step_in',
    63: 'step_out',
    60: 'mute',
    61: 'solo',
    58: 'scales',
    59: 'user',
    56: 'repeat',
    57: 'accent',
    54: 'octave_down',
    55: 'octave_up',
    52: 'add_effect',
    53: 'add_track',
    50: 'note',
    51: 'session',
    48: 'select',
    49: 'shift'
};
var handled_ccs = Object.keys(ccToButtonMap);

function Button(send_cc, cc) {
    EventEmitter.call(this);
    return {
        led_on: function led_on() {
            send_cc(cc, 4);
        },
        led_dim: function led_dim() {
            send_cc(cc, 1);
        },
        led_off: function led_off() {
            send_cc(cc, 0);
        },
        red: function red() {},
        orange: function orange() {},
        yellow: function yellow() {},
        green: function green() {},
        on: this.on,
        emit: this.emit
    };
}
util.inherits(Button, EventEmitter);

function Buttons(send_cc) {
    var _this = this;

    var buttons = this;
    foreach(ccToButtonMap, function (value, key) {
        return _this[value] = new Button(send_cc, parseInt(key));
    });
    this.names = Object.keys(ccToButtonMap).map(function (key) {
        return ccToButtonMap[key];
    });
    this.receive_midi_cc = function (index, value) {
        buttons[ccToButtonMap[index]].emit(pressed_or_released(value));
    };
    this.handled_ccs = handled_ccs;
}

function pressed_or_released(velocity) {
    return parseInt(velocity) > 0 ? 'pressed' : 'released';
}

module.exports = Buttons;

},{"events":29,"lodash.foreach":9,"util":33}],18:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach');

var ccToPadMap = {
    20: 1, // top row above grid
    21: 2,
    22: 3,
    23: 4,
    24: 5,
    25: 6,
    26: 7,
    27: 8,
    43: '1/32t',
    42: '1/32',
    41: '1/16t',
    40: '1/16',
    39: '1/8t',
    38: '1/8',
    37: '1/4t',
    36: '1/4'
};
var handled_ccs = Object.keys(ccToPadMap);

function Pad(send_cc, cc) {
    EventEmitter.call(this);
    this.output = function (value) {
        send_cc(cc, value);
    };
    var colours = [7, 10]; // dim, bright
    this.colours = [7, 10]; // dim, bright
    return {
        led_on: function led_on() {
            send_cc(cc, colours[1]);
        },
        led_dim: function led_dim() {
            send_cc(cc, colours[0]);
        },
        led_off: function led_off() {
            send_cc(cc, 0);
        },
        red: function red() {
            colours = [1, 4];
        },
        orange: function orange() {
            colours = [7, 10];
        },
        yellow: function yellow() {
            colours = [13, 16];
        },
        green: function green() {
            colours = [19, 22];
        },
        on: this.on,
        emit: this.emit
    };
}
util.inherits(Pad, EventEmitter);

function ControlButtons(send_cc) {
    var _this = this;

    var control_buttons = this;
    foreach(ccToPadMap, function (value, key) {
        return _this[value] = new Pad(send_cc, parseInt(key));
    });
    this.handled_ccs = handled_ccs;
    this.receive_midi_cc = function (cc, value) {
        var pad_name = ccToPadMap[cc];
        control_buttons[pad_name].emit(value > 0 ? 'pressed' : 'released');
    };
}

module.exports = ControlButtons;

},{"events":29,"lodash.foreach":9,"util":33}],19:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach'),
    partial = require('lodash.partial');

var control_buttons = {
    102: 1,
    103: 2,
    104: 3,
    105: 4,
    106: 5,
    107: 6,
    108: 7,
    109: 8
};
var handled_ccs = Object.keys(control_buttons);

var handled_notes = [];
for (var i = 36; i <= 99; i++) {
    handled_notes.push(i);
}function GridButton(send_midi_message, send_sysex, note) {
    EventEmitter.call(this);
    this.note_out = function (velocity) {
        send_midi_message(note, velocity);
    };
    this.sysex_out = function (data) {
        send_sysex(data);
    };
    this.index = note < 102 ? note - 36 : note - 38;

    return {
        led_on: partial(led_on, this),
        led_off: partial(led_off, this),
        led_rgb: partial(led_rgb, this),
        on: this.on,
        emit: this.emit
    };
}
util.inherits(GridButton, EventEmitter);

function led_on(gridButton, value) {
    gridButton.note_out(value ? value : 100);
}
function led_off(gridButton) {
    gridButton.note_out(0);
}
function led_rgb(gridButton, r, g, b) {
    var msb = [r, g, b].map(function (x) {
        return (x & 240) >> 4;
    }),
        lsb = [r, g, b].map(function (x) {
        return x & 15;
    });
    gridButton.sysex_out([4, 0, 8, gridButton.index, 0, msb[0], lsb[0], msb[1], lsb[1], msb[2], lsb[2]]);
}

function Grid(send_note, send_cc, send_sysex) {
    var _this = this;

    this.x = {};
    this.select = {};
    for (var x = 1; x <= 8; x++) {
        this.x[x] = { y: {} };
        for (var y = 1; y <= 8; y++) {
            this.x[x].y[y] = new GridButton(send_note, send_sysex, x - 1 + (y - 1) * 8 + 36);
        }
    }

    foreach(control_buttons, function (value, key) {
        return _this.select[value] = new GridButton(send_cc, send_sysex, parseInt(key));
    });
    this.handled_ccs = handled_ccs;
    this.handled_notes = handled_notes;
    this.receive_midi_note = partial(receive_midi_note, this);
    this.receive_midi_cc = partial(receive_midi_cc, this);
    this.receive_midi_poly_pressure = partial(receive_midi_poly_pressure, this);
}

function receive_midi_note(grid, note, velocity) {
    var button = button_from_note(grid, note),
        vel = parseInt(velocity);
    vel > 0 ? button.emit('pressed', vel) : button.emit('released');
}

function receive_midi_cc(grid, index, value) {
    grid.select[control_buttons[index]].emit(value > 0 ? 'pressed' : 'released');
}

function receive_midi_poly_pressure(grid, note, pressure) {
    button_from_note(grid, note).emit('aftertouch', parseInt(pressure));
}

function button_from_note(grid, note) {
    var indexed_from_zero = note - 36,
        x = indexed_from_zero % 8 + 1,
        y = parseInt(indexed_from_zero / 8) + 1;
    return grid.x[x].y[y];
}

module.exports = Grid;

},{"events":29,"lodash.foreach":9,"lodash.partial":13,"util":33}],20:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach'),
    partial = require('lodash.partial');

var knobMap = {
    'tempo': { 'cc': 14, 'note': 10 },
    'swing': { 'cc': 15, 'note': 9 },
    1: { 'cc': 71, 'note': 0 },
    2: { 'cc': 72, 'note': 1 },
    3: { 'cc': 73, 'note': 2 },
    4: { 'cc': 74, 'note': 3 },
    5: { 'cc': 75, 'note': 4 },
    6: { 'cc': 76, 'note': 5 },
    7: { 'cc': 77, 'note': 6 },
    8: { 'cc': 78, 'note': 7 },
    'master': { 'cc': 79, 'note': 8 }
};

var ccToKnobMap = {};
var noteToKnobMap = {};
foreach(knobMap, function (value, key) {
    ccToKnobMap[value.cc] = key;
    noteToKnobMap[value.note] = key;
});
var handled_ccs = Object.keys(ccToKnobMap),
    handled_notes = Object.keys(noteToKnobMap);

function Knob() {
    EventEmitter.call(this);
}
util.inherits(Knob, EventEmitter);

function Knobs() {
    var _this = this;

    foreach(knobMap, function (value, key) {
        return _this[key] = new Knob();
    });
    this.handled_ccs = handled_ccs;
    this.receive_midi_cc = partial(receive_midi_cc, this);
    this.receive_midi_note = partial(receive_midi_note, this);
    this.handled_notes = handled_notes;
}

function receive_midi_cc(knobs, index, value) {
    var knob_name = ccToKnobMap[index];
    var delta = value < 64 ? value : value - 128;
    knobs[knob_name].emit('turned', delta);
}

function receive_midi_note(knobs, note, velocity) {
    var knob_name = noteToKnobMap[note];
    var event_name = velocity > 0 ? 'pressed' : 'released';
    knobs[knob_name].emit(event_name);
}

module.exports = Knobs;

},{"events":29,"lodash.foreach":9,"lodash.partial":13,"util":33}],21:[function(require,module,exports){
'use strict';

var foreach = require('lodash.foreach'),
    range = require('lodash.range'),
    one_to_eight = [1, 2, 3, 4, 5, 6, 7, 8],
    one_to_four = [1, 2, 3, 4],
    zero_to_seven = [0, 1, 2, 3, 4, 5, 6, 7],
    blank = 32,
    blank_line = range(blank, 100, 0),
    // 68 character array filled with 'blank character'
offsets = [0, 9, 17, 26, 34, 43, 51, 60];

function LCDSegment(update) {
    this.update = function (text) {
        update(lcd_data(text));
    };

    this.clear = function () {
        update(lcd_data(''));
    };
}

function lcd_data(text) {
    var text_string = String(text);
    return zero_to_seven.map(function (index) {
        return text_string.length > index ? text_string.charCodeAt(index) : blank;
    });
}

function LCDs(send_sysex) {
    var lcds = this;

    this.clear = function () {
        foreach(one_to_eight, function (x) {
            lcds.x[x] = { y: {} };
            foreach(one_to_four, function (y) {
                lcds.x[x].y[y] = new LCDSegment(function (display_data) {
                    send_sysex([28 - y].concat([0, 9, offsets[x - 1]]).concat(display_data));
                });
            });
        });

        foreach(one_to_four, function (row) {
            return send_sysex([28 - row].concat([0, 69, 0]).concat(blank_line));
        });
    };

    this.x = {};

    this.clear();

    this.x[8].y[4].update(' powered');
    this.x[8].y[3].update('      by');
    this.x[8].y[2].update('   push-');
    this.x[8].y[1].update(' wrapper');
}

module.exports = LCDs;

},{"lodash.foreach":9,"lodash.range":14}],22:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    partial = require('lodash.partial'),
    handled_notes = [12];

function TouchStrip() {
    EventEmitter.call(this);
    this.receive_midi_pitch_bend = partial(receive_midi_pitch_bend, this);
    this.receive_midi_note = partial(receive_midi_note, this);
    this.handled_notes = handled_notes;
}
util.inherits(TouchStrip, EventEmitter);

function receive_midi_pitch_bend(touchstrip, fourteen_bit_value) {
    if (fourteen_bit_value == 8192) return;
    touchstrip.emit('pitchbend', fourteen_bit_value);
}

function receive_midi_note(touchstrip, note, velocity) {
    if (velocity > 0) {
        touchstrip.emit('pressed');
    } else {
        touchstrip.emit('released');
        touchstrip.emit('pitchbend', 8192);
    }
}

module.exports = TouchStrip;

},{"events":29,"lodash.partial":13,"util":33}],23:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    unityGain = { toAbsolute: function toAbsolute() {
        return 1;
    } };

function SamplePlayer(assetUrl, audioContext, onLoad) {
    EventEmitter.call(this);
    var player = this,
        _loaded = false,
        _buffer = void 0,
        _voices = [],
        _playbackRate = 1,
        _gainNode = audioContext.createGain();

    var stoppedAction = function stoppedAction() {
        _voices.shift();
        if (!player.isPlaying()) player.emit('stopped');
    };

    this._assetUrl = assetUrl;

    this.connect = _gainNode.connect.bind(_gainNode);

    this.disconnect = _gainNode.disconnect.bind(_gainNode);

    this.toMaster = function () {
        player.disconnect();
        player.connect(audioContext.destination);
        return player;
    };

    this.isPlaying = function () {
        return _voices.length > 0;
    };

    this.play = function (gain) {
        if (!_loaded) {
            console.log(assetUrl + ' not loaded yet...');return;
        }

        var now = timeNow(audioContext),
            startTime = now,
            _gain = gain && typeof gain.toAbsolute === 'function' ? gain : unityGain;

        if (player.isPlaying()) {
            _gainNode.gain.cancelScheduledValues(now);
            anchor(_gainNode.gain, now);
            startTime = now + 0.01;
            _gainNode.gain.linearRampToValueAtTime(0, startTime);
            player.emit('stopped');
        } else {
            _gainNode.gain.setValueAtTime(0, startTime);
        }

        var source = audioContext.createBufferSource();
        source.connect(_gainNode);

        _gainNode.gain.linearRampToValueAtTime(_gain.toAbsolute(), startTime);

        source.playbackRate.setValueAtTime(_playbackRate, startTime);
        source.buffer = _buffer;

        source.addEventListener('ended', stoppedAction);

        _voices.push(source);
        source.start(startTime);
        player.emit('started', _gain);
    };

    this.updatePlaybackRate = function (rate) {
        _playbackRate = rate;
        var now = timeNow(audioContext);
        _voices.forEach(function (source) {
            source.playbackRate.setValueAtTime(_playbackRate, now);
        });
    };

    loadSample(assetUrl, audioContext, function (buffer) {
        _buffer = buffer;
        _loaded = true;
        if (typeof onLoad === 'function') {
            onLoad(player);
        }
    });
}
util.inherits(SamplePlayer, EventEmitter);

function loadSample(assetUrl, audioContext, done) {
    var request = new XMLHttpRequest();
    request.open('GET', assetUrl, true);
    request.responseType = 'arraybuffer';
    request.onload = function () {
        audioContext.decodeAudioData(request.response, done);
    };
    request.send();
}

function anchor(audioParam, now) {
    audioParam.setValueAtTime(audioParam.value, now);
}

function timeNow(audioContext) {
    return audioContext.currentTime;
}

module.exports = SamplePlayer;

},{"events":29,"util":33}],24:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util');

function Repeater(inTheFuture, initialInterval) {
    EventEmitter.call(this);

    var createInterval = function createInterval(candidate) {
        return candidate && typeof candidate.toMs === 'function' ? candidate : { toMs: function toMs() {
                return candidate;
            } };
    };

    var recursiveInTheFuture = function recursiveInTheFuture(callback) {
        return inTheFuture(function () {
            if (_isScheduling) {
                callback();
                _cancel = recursiveInTheFuture(callback);
            }
        }, _interval);
    };

    var _isScheduling = false,
        _interval = createInterval(initialInterval),
        _cancel = noAction,
        repeater = this;

    this.updateInterval = function (newInterval) {
        _interval = createInterval(newInterval);
        repeater.reportInterval();
        return repeater;
    };

    this.start = function (callback) {
        if (_isScheduling) return;
        _isScheduling = true;
        callback();
        _cancel = recursiveInTheFuture(callback);
    };

    this.stop = function () {
        _isScheduling = false;
        _cancel();
        _cancel = noAction;
    };

    this.reportInterval = function () {
        repeater.emit('interval', _interval);
    };
}
util.inherits(Repeater, EventEmitter);

function Scheduling(context) {
    var scheduling = this;

    var inTheFutureTight = function inTheFutureTight(callback, when) {
        var localCallback = callback,
            source = context.createBufferSource(),
            now = context.currentTime,
            thousandth = context.sampleRate / 1000,
            scheduled_at = now + when.toMs() / 1000 - 0.001;
        // a buffer length of 1 sample doesn't work on IOS, so use 1/1000th of a second
        var buffer = context.createBuffer(1, thousandth, context.sampleRate);
        source.addEventListener('ended', function () {
            localCallback();
        });
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(scheduled_at);

        return function cancel() {
            localCallback = noAction;
        };
    };

    this.inTheFuture = context ? inTheFutureTight : inTheFutureLoose;

    this.Repeater = function (initialInterval) {
        return new Repeater(scheduling.inTheFuture, initialInterval);
    };
}

function inTheFutureLoose(callback, when) {
    var localCallback = callback;
    setTimeout(function () {
        localCallback();
    }, when.toMs());
    return function cancel() {
        localCallback = noAction;
    };
}

function noAction() {}

module.exports = function (context) {
    return new Scheduling(context);
};

},{"events":29,"util":33}],25:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach');

function BPM(initial) {
    EventEmitter.call(this);
    var bpm = this;

    this.current = clip(initial) ? clip(initial) : 120;

    this.report = function () {
        bpm.emit('changed', bpm);
    };
    this.change_by = function (amount) {
        bpm.current = clip(bpm.current + amount);
        bpm.report();
    };
}
util.inherits(BPM, EventEmitter);

function clip(bpm) {
    return bpm < 20 ? 20 : bpm > 300 ? 300 : bpm;
}

module.exports = BPM;

},{"events":29,"lodash.foreach":9,"util":33}],26:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach');

function Interval(bpm, multiplier, value) {
    EventEmitter.call(this);
    var interval = this;

    this.value = value;
    this.report = function () {
        interval.emit('changed', 60 / bpm.current * multiplier * 1000);
    };

    bpm.on('changed', interval.report);
}
util.inherits(Interval, EventEmitter);

module.exports = {
    '4n': function n(bpm, name) {
        return new Interval(bpm, 1, name ? name : '4n');
    },
    '4nt': function nt(bpm, name) {
        return new Interval(bpm, 2 / 3, name ? name : '4nt');
    },
    '8n': function n(bpm, name) {
        return new Interval(bpm, 0.5, name ? name : '8n');
    },
    '8nt': function nt(bpm, name) {
        return new Interval(bpm, 1 / 3, name ? name : '8nt');
    },
    '16n': function n(bpm, name) {
        return new Interval(bpm, 0.25, name ? name : '16n');
    },
    '16nt': function nt(bpm, name) {
        return new Interval(bpm, 1 / 6, name ? name : '16nt');
    },
    '32n': function n(bpm, name) {
        return new Interval(bpm, 0.125, name ? name : '32n');
    },
    '32nt': function nt(bpm, name) {
        return new Interval(bpm, 1 / 12, name ? name : '32nt');
    }
};

},{"events":29,"lodash.foreach":9,"util":33}],27:[function(require,module,exports){
'use strict';

var SamplePlayer = require('wac.sample-player');
/**
 * A wac.sample-player wrapper that adds an LP filter and variable pitch
 */
function Player(assetUrl, audioContext, onLoad) {
    var samplePlayer = new SamplePlayer(assetUrl, audioContext, onLoad),
        filterNode = audioContext.createBiquadFilter(),
        pitch = 0,
        pitchMod = 0,
        player = this;

    filterNode.frequency.value = 20000;
    samplePlayer.connect(filterNode);

    var updatePitch = function updatePitch() {
        samplePlayer.updatePlaybackRate(intervalToPlaybackRate(pitch + pitchMod));
    };

    this._assetUrl = assetUrl;
    this.play = samplePlayer.play.bind(samplePlayer);

    this.connect = filterNode.connect.bind(filterNode);

    this.disconnect = filterNode.disconnect.bind(filterNode);

    this.toMaster = function () {
        filterNode.disconnect();
        filterNode.connect(audioContext.destination);
        return player;
    };

    this.isPlaying = samplePlayer.isPlaying.bind(samplePlayer);

    this.changePitchByInterval = function (interval) {
        pitch = clip(pitch + interval, -24, 24);
        player.reportPitch();
        updatePitch();
    };

    this.modulatePitch = function (interval) {
        pitchMod = clip(interval, -24, 24);
        updatePitch();
    };

    this.cutOff = function (f) {
        filterNode.frequency.setValueAtTime(clip(f, 30, 20000), audioContext.currentTime);
        return player;
    };

    this.reportPitch = function () {
        samplePlayer.emit('pitch', (pitch >= 0 ? '+' : '') + pitch + ' st');
    };

    this.on = samplePlayer.on.bind(samplePlayer);
}

function clip(value, min, max) {
    if (value < min) return min;
    return value > max ? max : value;
}

function intervalToPlaybackRate(midiNoteNumber) {
    return Math.exp(.057762265 * midiNoteNumber);
}

module.exports = Player;

},{"wac.sample-player":23}],28:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    Scheduling = require('wac.scheduling');

function Repetae(repeater, initial_interval) {
    EventEmitter.call(this);
    var repetae = this;
    this._active = false;
    this._time_changed = false;
    this._being_pressed = false;
    this._current_interval = initial_interval;

    repeater.on('interval', function (interval) {
        repetae.emit('intervalMs', interval);
    });
    repetae._current_interval.on('changed', repeater.updateInterval);
    repetae._current_interval.report();

    this.press = function () {
        repetae._being_pressed = true;
    };

    this.release = function () {
        var started_active = repetae._active,
            time_changed = repetae._time_changed;

        repetae._time_changed = false;
        repetae._being_pressed = false;

        switch (true) {
            case !started_active:
                repetae._active = true;
                repetae.emit('on');
                break;
            case started_active && !time_changed:
                repetae._active = false;
                repetae.emit('off');
                break;
        }
    };

    this.interval = function (new_interval) {
        if (repetae._being_pressed) {
            repetae._time_changed = true;
            repetae._current_interval.removeListener('changed', repeater.updateInterval);
            repetae._current_interval = new_interval;
            repetae._current_interval.on('changed', repeater.updateInterval);
            repetae.report_interval();
            repetae._current_interval.report();
        }
    };

    this.start = function (callback) {
        if (!repetae._active) {
            callback();
            return;
        }
        repeater.start(callback);
    };

    this.stop = repeater.stop;
    this.report_interval = function () {
        repetae.emit('interval', repetae._current_interval.value);
    };
}
util.inherits(Repetae, EventEmitter);

module.exports = function createRepetae(interval, context) {
    var repeater = Scheduling(context).Repeater(1000); // initial interval here will be changed when Repetae initialises
    return new Repetae(repeater, interval);
};

},{"events":29,"util":33,"wac.scheduling":24}],29:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],30:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],31:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

(function () {
  try {
    cachedSetTimeout = setTimeout;
  } catch (e) {
    cachedSetTimeout = function () {
      throw new Error('setTimeout is not defined');
    }
  }
  try {
    cachedClearTimeout = clearTimeout;
  } catch (e) {
    cachedClearTimeout = function () {
      throw new Error('clearTimeout is not defined');
    }
  }
} ())
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = cachedSetTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    cachedClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        cachedSetTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],32:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],33:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./support/isBuffer":32,"_process":31,"inherits":30}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL25wbS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImFwcC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX2FycmF5ZWFjaC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX2Jhc2VlYWNoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5fYmluZGNhbGxiYWNrL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5fY3JlYXRld3JhcHBlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX2dldG5hdGl2ZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX3JlcGxhY2Vob2xkZXJzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5fcm9vdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guZm9yZWFjaC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guaXNhcmd1bWVudHMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmlzYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmtleXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLnBhcnRpYWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLnJhbmdlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5yZXN0cGFyYW0vaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHVzaC13cmFwcGVyL3B1c2guanMiLCJub2RlX21vZHVsZXMvcHVzaC13cmFwcGVyL3NyYy9idXR0b25zLmpzIiwibm9kZV9tb2R1bGVzL3B1c2gtd3JhcHBlci9zcmMvY29udHJvbC1idXR0b25zLmpzIiwibm9kZV9tb2R1bGVzL3B1c2gtd3JhcHBlci9zcmMvZ3JpZC5qcyIsIm5vZGVfbW9kdWxlcy9wdXNoLXdyYXBwZXIvc3JjL2tub2JzLmpzIiwibm9kZV9tb2R1bGVzL3B1c2gtd3JhcHBlci9zcmMvbGNkcy5qcyIsIm5vZGVfbW9kdWxlcy9wdXNoLXdyYXBwZXIvc3JjL3RvdWNoc3RyaXAuanMiLCJub2RlX21vZHVsZXMvd2FjLnNhbXBsZS1wbGF5ZXIvU2FtcGxlUGxheWVyLmpzIiwibm9kZV9tb2R1bGVzL3dhYy5zY2hlZHVsaW5nL1NjaGVkdWxpbmcuanMiLCJzcmMvYnBtLmpzIiwic3JjL2ludGVydmFsLmpzIiwic3JjL3BsYXllci5qcyIsInNyYy9yZXBldGFlLmpzIiwiLi4vLi4vbnBtL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi4uLy4uL25wbS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2luaGVyaXRzL2luaGVyaXRzX2Jyb3dzZXIuanMiLCIuLi8uLi9ucG0vbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIuLi8uLi9ucG0vbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3N1cHBvcnQvaXNCdWZmZXJCcm93c2VyLmpzIiwiLi4vLi4vbnBtL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvdXRpbC91dGlsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7O0FBQ0EsSUFBTSxPQUFPLFFBQVEsY0FBUixDQUFiO0FBQUEsSUFDSSxVQUFVLFFBQVEsZ0JBQVIsQ0FEZDtBQUFBLElBRUksVUFBVSxRQUFRLGdCQUFSLENBRmQ7QUFBQSxJQUdJLFNBQVMsUUFBUSxpQkFBUixDQUhiO0FBQUEsSUFJSSxVQUFVLE9BQU8sWUFBUCxHQUFzQixJQUFJLE9BQU8sWUFBWCxFQUF0QixHQUFrRCxJQUFJLE9BQU8sa0JBQVgsRUFKaEU7QUFBQSxJQUtJLFVBQVUsUUFBUSxrQkFBUixDQUxkO0FBQUEsSUFNSSxNQUFNLFFB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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNucUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25QQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdGNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuRUE7O0FBRUEsSUFBTSxlQUFlLFFBQVEsUUFBUixDQUFyQjtBQUFBLElBQ0ksT0FBTyxRQUFRLE1BQVIsQ0FEWDtBQUFBLElBRUksVUFBVSxRQUFRLGtCQUFSLENBRmQ7QUFBQSxJQUdJLFFBQVEsUUFBUSxhQUFSLENBSFo7QUFBQSxJQUlJLE9BQU8sUUFBUSxlQUFSLENBSlg7QUFBQSxJQUtJLGFBQWEsUUFBUSxxQkFBUixDQUxqQjtBQUFBLElBTUksaUJBQWlCLFFBQVEsMEJBQVIsQ0FOckI7QUFBQSxJQU9JLE9BQU8sUUFBUSxlQUFSLENBUFg7QUFBQSxJQVFJLFVBQVUsUUFBUSxnQkFBUixDQVJkO0FBQUEsSUFTSSxVQUFVLFFBQVEsZ0JBQVIsQ0FUZDtBQUFBLElBVUksZUFBZSxDQUFDLENBQUQsRUFBSSxDQUFKLEVBQU8sQ0FBUCxFQUFVLENBQVYsRUFBYSxDQUFiLEVBQWdCLENBQWhCLEVBQW1CLENBQW5CLEVBQXNCLENBQXRCLENBVm5COztBQVlBLFNBQVMsSUFBVCxDQUFjLGFBQWQsRUFBNkI7QUFBQTs7QUFDekIsaUJBQWEsSUFBYixDQUFrQixJQUFsQjs7QUFFQSxRQUFJLFdBQVc7QUFDWCxpQkFBUyxpQkFBUyxFQUFULEVBQWEsS0FBYixFQUFvQjtBQUFFLDBCQUFjLElBQWQsQ0FBbUIsQ0FBQyxHQUFELEVBQU0sRUFBTixFQUFVLEtBQVYsQ0FBbkI7QUFBc0MsU0FEMUQ7QUFFWCxtQkFBVyxtQkFBUyxJQUFULEVBQWUsUUFBZixFQUF5QjtBQUFFLDBCQUFjLElBQWQsQ0FBbUIsQ0FBQyxHQUFELEVBQU0sSUFBTixFQUFZLFFBQVosQ0FBbkI7QUFBMkMsU0FGdEU7QUFHWCxvQkFBWSxvQkFBUyxJQUFULEVBQWU7QUFBRSwwQkFBYyxJQUFkLENBQW1CLENBQUMsR0FBRCxFQUFNLEVBQU4sRUFBVSxHQUFWLEVBQWUsRUFBZixFQUFtQixNQUFuQixDQUEwQixJQUExQixFQUFnQyxNQUFoQyxDQUF1QyxDQUFDLEdBQUQsQ0FBdkMsQ0FBbkI7QUFBbUU7QUFIckYsS0FBZjs7QUFNQSxRQUFNLFVBQVUsSUFBSSxPQUFKLENBQVksU0FBUyxPQUFyQixDQUFoQjtBQUNBLFNBQUssS0FBTCxHQUFhLElBQUksS0FBSixFQUFiO0FBQ0EsU0FBSyxJQUFMLEdBQVksSUFBSSxJQUFKLENBQVMsU0FBUyxTQUFsQixFQUE2QixTQUFTLE9BQXRDLEVBQStDLFNBQVMsVUFBeEQsQ0FBWjtBQUNBLFNBQUssVUFBTCxHQUFrQixJQUFJLFVBQUosRUFBbEI7QUFDQSxTQUFLLE9BQUwsR0FBZSxJQUFJLGNBQUosQ0FBbUIsU0FBUyxPQUE1QixDQUFmO0FBQ0EsU0FBSyxLQUFMLEdBQWEsRUFBYjtBQUNBLFNBQUssT0FBTCxHQUFlLEVBQWY7O0FBRUEsWUFDSSxDQUFDLEtBQUssS0FBTixFQUFhLEtBQUssVUFBbEIsRUFBOEIsS0FBSyxJQUFuQyxDQURKLEVBRUksVUFBQyxNQUFEO0FBQUEsZUFBWSxRQUFRLE9BQU8sYUFBZixFQUE4QixVQUFDLEtBQUQsRUFBUSxHQUFSO0FBQUEsbUJBQWdCLE1BQUssT0FBTCxDQUFhLEtBQWIsSUFBc0IsTUFBdEM7QUFBQSxTQUE5QixDQUFaO0FBQUEsS0FGSjs7QUFLQSxZQUNJLENBQUMsS0FBSyxLQUFOLEVBQWEsS0FBSyxPQUFsQixFQUEyQixPQUEzQixFQUFvQyxLQUFLLElBQXpDLENBREosRUFFSSxVQUFDLE1BQUQ7QUFBQSxlQUFZLFFBQVEsT0FBTyxXQUFmLEVBQTRCLFVBQUMsS0FBRCxFQUFRLEdBQVI7QUFBQSxtQkFBZ0IsTUFBSyxLQUFMLENBQVcsS0FBWCxJQUFvQixNQUFwQztBQUFBLFNBQTVCLENBQVo7QUFBQSxLQUZKOztBQUtBO0FBQ0EsUUFBTSxNQUFNO0FBQ1IsY0FBTTtBQUNGLG1CQUFPLEtBQUssS0FBTCxDQUFXLEtBRGhCO0FBRUYsbUJBQU8sS0FBSyxLQUFMLENBQVcsS0FGaEI7QUFHRixvQkFBUSxLQUFLLEtBQUwsQ0FBVztBQUhqQixTQURFO0FBTVIsY0FBTSxFQUFFLEdBQUcsRUFBTCxFQU5FO0FBT1Isb0JBQVksS0FBSyxVQVBUO0FBUVIsYUFBSyxJQUFJLElBQUosQ0FBUyxTQUFTLFVBQWxCLENBUkc7QUFTUixnQkFBUTtBQUNKLHFCQUFTLEtBQUssT0FBTCxDQUFhLE9BQWIsQ0FETDtBQUVKLG9CQUFRLEtBQUssT0FBTCxDQUFhLE1BQWIsQ0FGSjtBQUdKLHFCQUFTLEtBQUssT0FBTCxDQUFhLE9BQWIsQ0FITDtBQUlKLG9CQUFRLEtBQUssT0FBTCxDQUFhLE1BQWIsQ0FKSjtBQUtKLG9CQUFRLEtBQUssT0FBTCxDQUFhLE1BQWIsQ0FMSjtBQU1KLG1CQUFPLEtBQUssT0FBTCxDQUFhLEtBQWIsQ0FOSDtBQU9KLG9CQUFRLEtBQUssT0FBTCxDQUFhLE1BQWIsQ0FQSjtBQVFKLG1CQUFPLEtBQUssT0FBTCxDQUFhLEtBQWI7QUFSSCxTQVRBO0FBbUJSLGlCQUFTLEVBbkJEO0FBb0JSLHNCQUFjLFFBQVEsWUFBUixFQUFzQixJQUF0QjtBQXBCTixLQUFaO0FBc0JBLFlBQ0ksWUFESixFQUVJLFVBQUMsTUFBRDtBQUFBLGVBQVksSUFBSSxPQUFKLENBQVksTUFBWixJQUFzQixFQUFFLE1BQU0sTUFBSyxLQUFMLENBQVcsTUFBWCxDQUFSLEVBQTRCLFFBQVEsTUFBSyxPQUFMLENBQWEsTUFBYixDQUFwQyxFQUFsQztBQUFBLEtBRko7QUFJQSxZQUNJLFlBREosRUFFSSxVQUFDLENBQUQsRUFBTztBQUNILFlBQUksSUFBSixDQUFTLENBQVQsQ0FBVyxDQUFYLElBQWdCLEVBQUUsR0FBRyxFQUFMLEVBQVMsUUFBUSxNQUFLLElBQUwsQ0FBVSxNQUFWLENBQWlCLENBQWpCLENBQWpCLEVBQWhCO0FBQ0EsZ0JBQVEsWUFBUixFQUFzQixVQUFDLENBQUQsRUFBTztBQUN6QixnQkFBSSxJQUFKLENBQVMsQ0FBVCxDQUFXLENBQVgsRUFBYyxDQUFkLENBQWdCLENBQWhCLElBQXFCLE1BQUssSUFBTCxDQUFVLENBQVYsQ0FBWSxDQUFaLEVBQWUsQ0FBZixDQUFpQixDQUFqQixDQUFyQjtBQUNILFNBRkQ7QUFHSCxLQVBMO0FBU0EsWUFDSSxRQUFRLEtBRFosRUFFSSxVQUFDLFdBQUQ7QUFBQSxlQUFpQixJQUFJLE1BQUosQ0FBVyxXQUFYLElBQTBCLFFBQVEsV0FBUixDQUEzQztBQUFBLEtBRko7QUFJQSxXQUFPLEdBQVA7QUFDSDtBQUNELEtBQUssUUFBTCxDQUFjLElBQWQsRUFBb0IsWUFBcEI7O0FBRUEsU0FBUyxjQUFULENBQXdCLElBQXhCLEVBQThCLEtBQTlCLEVBQXFDLEtBQXJDLEVBQTRDO0FBQ3hDLFFBQUksU0FBUyxLQUFLLEtBQWxCLEVBQXlCO0FBQ3JCLGFBQUssS0FBTCxDQUFXLEtBQVgsRUFBa0IsZUFBbEIsQ0FBa0MsS0FBbEMsRUFBeUMsS0FBekM7QUFDSCxLQUZELE1BRU87QUFDSCxnQkFBUSxHQUFSLENBQVksOEJBQThCLEtBQTFDO0FBQ0g7QUFDSjs7QUFFRCxTQUFTLGdCQUFULENBQTBCLElBQTFCLEVBQWdDLElBQWhDLEVBQXNDLFFBQXRDLEVBQWdEO0FBQzVDLFFBQUksUUFBUSxLQUFLLE9BQWpCLEVBQTBCO0FBQ3RCLGFBQUssT0FBTCxDQUFhLElBQWIsRUFBbUIsaUJBQW5CLENBQXFDLElBQXJDLEVBQTJDLFFBQTNDO0FBQ0gsS0FGRCxNQUVPO0FBQ0gsZ0JBQVEsR0FBUixDQUFZLGdDQUFnQyxJQUE1QztBQUNIO0FBQ0o7O0FBRUQsU0FBUyxzQkFBVCxDQUFnQyxJQUFoQyxFQUFzQyxRQUF0QyxFQUFnRCxRQUFoRCxFQUEwRDtBQUN0RCxTQUFLLFVBQUwsQ0FBZ0IsdUJBQWhCLENBQXdDLENBQUMsWUFBWSxDQUFiLElBQWtCLFFBQTFEO0FBQ0g7O0FBRUQsU0FBUyx5QkFBVCxDQUFtQyxJQUFuQyxFQUF5QyxJQUF6QyxFQUErQyxRQUEvQyxFQUF5RDtBQUNyRCxTQUFLLElBQUwsQ0FBVSwwQkFBVixDQUFxQyxJQUFyQyxFQUEyQyxRQUEzQztBQUNIOztBQUVELElBQUksZ0JBQWdCO0FBQ2hCLGdCQUFZLEdBREksRUFDQztBQUNqQixlQUFXLEdBRkssRUFFQTtBQUNoQixxQkFBaUIsR0FIRCxFQUdNO0FBQ3RCLFVBQU0sR0FKVSxFQUlMO0FBQ1gsc0JBQWtCLEdBTEYsRUFLTztBQUN2Qix3QkFBb0IsR0FOSixFQU1TO0FBQ3pCLGtCQUFjLEdBUEUsRUFPRztBQUNuQixhQUFTLEdBUk8sRUFBcEI7O0FBV0E7QUFDQSxTQUFTLFlBQVQsQ0FBc0IsSUFBdEIsRUFBNEIsS0FBNUIsRUFBbUM7QUFDL0IsUUFBSSxlQUFlLE1BQU0sQ0FBTixJQUFXLElBQTlCO0FBQ0EsUUFBSSxlQUFlLE1BQU0sQ0FBTixJQUFXLElBQTlCOztBQUVBLFlBQVEsWUFBUjtBQUNJLGFBQU0sY0FBYyxJQUFkLENBQU47QUFDSSwyQkFBZSxJQUFmLEVBQXFCLE1BQU0sQ0FBTixDQUFyQixFQUErQixNQUFNLENBQU4sQ0FBL0I7QUFDQTtBQUNKLGFBQU0sY0FBYyxTQUFkLENBQU47QUFDQSxhQUFNLGNBQWMsVUFBZCxDQUFOO0FBQ0ksNkJBQWlCLElBQWpCLEVBQXVCLE1BQU0sQ0FBTixDQUF2QixFQUFpQyxNQUFNLENBQU4sQ0FBakM7QUFDQTtBQUNKLGFBQU0sY0FBYyxZQUFkLENBQU47QUFDSSxtQ0FBdUIsSUFBdkIsRUFBNkIsTUFBTSxDQUFOLENBQTdCLEVBQXVDLE1BQU0sQ0FBTixDQUF2QztBQUNBO0FBQ0osYUFBSyxjQUFjLGVBQWQsQ0FBTDtBQUNJLHNDQUEwQixJQUExQixFQUFnQyxNQUFNLENBQU4sQ0FBaEMsRUFBMEMsTUFBTSxDQUFOLENBQTFDO0FBQ0E7QUFiUjtBQWVIOztBQUVEO0FBQ0EsS0FBSyw0QkFBTCxHQUFvQyxVQUFTLFVBQVQsRUFBcUI7QUFDckQsUUFBSSxTQUFTLFdBQVcsTUFBWCxDQUFrQixNQUFsQixFQUFiO0FBQUEsUUFDSSxVQUFVLFdBQVcsT0FBWCxDQUFtQixNQUFuQixFQURkO0FBQUEsUUFFSSxJQUZKOztBQUlBLFNBQUssSUFBSSxTQUFTLFFBQVEsSUFBUixFQUFsQixFQUFrQyxVQUFVLENBQUMsT0FBTyxJQUFwRCxFQUEwRCxTQUFTLFFBQVEsSUFBUixFQUFuRSxFQUFtRjtBQUMvRSxnQkFBUSxHQUFSLENBQVksbUJBQW1CLE9BQU8sS0FBUCxDQUFhLElBQTVDO0FBQ0EsWUFBSSw0QkFBNEIsT0FBTyxLQUFQLENBQWEsSUFBN0MsRUFBbUQ7QUFDL0Msb0JBQVEsR0FBUixDQUFZLDRCQUE0QixPQUFPLEtBQVAsQ0FBYSxJQUFyRDtBQUNBLG1CQUFPLElBQUksSUFBSixDQUFTLE9BQU8sS0FBaEIsQ0FBUDtBQUNBO0FBQ0g7QUFDSjs7QUFFRCxRQUFJLFNBQVMsU0FBYixFQUF3QixPQUFPLElBQUksSUFBSixDQUFTLEVBQUUsTUFBTSxjQUFDLEtBQUQsRUFBVyxDQUFrQyxDQUFyRCxFQUFULENBQVA7O0FBRXhCLFNBQUssSUFBSSxRQUFRLE9BQU8sSUFBUCxFQUFqQixFQUFnQyxTQUFTLENBQUMsTUFBTSxJQUFoRCxFQUFzRCxRQUFRLE9BQU8sSUFBUCxFQUE5RCxFQUE2RTtBQUN6RSxnQkFBUSxHQUFSLENBQVksa0JBQWtCLE1BQU0sS0FBTixDQUFZLElBQTFDO0FBQ0EsWUFBSSw0QkFBNEIsTUFBTSxLQUFOLENBQVksSUFBNUMsRUFBa0Q7QUFDOUMsb0JBQVEsR0FBUixDQUFZLDJCQUEyQixNQUFNLEtBQU4sQ0FBWSxJQUFuRDtBQUNBLGtCQUFNLEtBQU4sQ0FBWSxhQUFaLEdBQTRCLFVBQUMsS0FBRCxFQUFXO0FBQUUscUJBQUssWUFBTCxDQUFrQixNQUFNLElBQXhCO0FBQStCLGFBQXhFO0FBQ0E7QUFDSDtBQUNKOztBQUVELFdBQU8sSUFBUDtBQUNILENBMUJEOztBQTRCQSxPQUFPLE9BQVAsR0FBaUIsSUFBakI7Ozs7O0FDM0tBLElBQU0sZUFBZSxRQUFRLFFBQVIsQ0FBckI7QUFBQSxJQUNJLE9BQU8sUUFBUSxNQUFSLENBRFg7QUFBQSxJQUVJLFVBQVUsUUFBUSxnQkFBUixDQUZkOztBQUlBLElBQUksZ0JBQWdCO0FBQ2hCLE9BQUcsV0FEYTtBQUVoQixPQUFHLFdBRmE7QUFHaEIsU0FBSyxNQUhXO0FBSWhCLFNBQUssUUFKVztBQUtoQixTQUFLLFFBTFc7QUFNaEIsU0FBSyxVQU5XO0FBT2hCLFFBQUksY0FQWTtBQVFoQixRQUFJLFlBUlk7QUFTaEIsUUFBSSxXQVRZO0FBVWhCLFFBQUksS0FWWTtBQVdoQixRQUFJLEtBWFk7QUFZaEIsUUFBSSxNQVpZO0FBYWhCLFFBQUksUUFiWTtBQWNoQixRQUFJLE1BZFk7QUFlaEIsUUFBSSxNQWZZO0FBZ0JoQixRQUFJLE9BaEJZO0FBaUJoQixRQUFJLElBakJZO0FBa0JoQixRQUFJLE1BbEJZO0FBbUJoQixTQUFLLFFBbkJXO0FBb0JoQixTQUFLLFlBcEJXO0FBcUJoQixTQUFLLE9BckJXO0FBc0JoQixTQUFLLE1BdEJXO0FBdUJoQixTQUFLLFFBdkJXO0FBd0JoQixTQUFLLFFBeEJXO0FBeUJoQixRQUFJLFNBekJZO0FBMEJoQixRQUFJLFVBMUJZO0FBMkJoQixRQUFJLE1BM0JZO0FBNEJoQixRQUFJLE1BNUJZO0FBNkJoQixRQUFJLFFBN0JZO0FBOEJoQixRQUFJLE1BOUJZO0FBK0JoQixRQUFJLFFBL0JZO0FBZ0NoQixRQUFJLFFBaENZO0FBaUNoQixRQUFJLGFBakNZO0FBa0NoQixRQUFJLFdBbENZO0FBbUNoQixRQUFJLFlBbkNZO0FBb0NoQixRQUFJLFdBcENZO0FBcUNoQixRQUFJLE1BckNZO0FBc0NoQixRQUFJLFNBdENZO0FBdUNoQixRQUFJLFFBdkNZO0FBd0NoQixRQUFJO0FBeENZLENBQXBCO0FBMENBLElBQU0sY0FBYyxPQUFPLElBQVAsQ0FBWSxhQUFaLENBQXBCOztBQUVBLFNBQVMsTUFBVCxDQUFnQixPQUFoQixFQUF5QixFQUF6QixFQUE2QjtBQUN6QixpQkFBYSxJQUFiLENBQWtCLElBQWxCO0FBQ0EsV0FBTztBQUNILGdCQUFRLGtCQUFXO0FBQUUsb0JBQVEsRUFBUixFQUFZLENBQVo7QUFBZ0IsU0FEbEM7QUFFSCxpQkFBUyxtQkFBVztBQUFFLG9CQUFRLEVBQVIsRUFBWSxDQUFaO0FBQWdCLFNBRm5DO0FBR0gsaUJBQVMsbUJBQVc7QUFBRSxvQkFBUSxFQUFSLEVBQVksQ0FBWjtBQUFnQixTQUhuQztBQUlILGFBQUssZUFBTSxDQUFFLENBSlY7QUFLSCxnQkFBUSxrQkFBTSxDQUFFLENBTGI7QUFNSCxnQkFBUSxrQkFBTSxDQUFFLENBTmI7QUFPSCxlQUFPLGlCQUFNLENBQUUsQ0FQWjtBQVFILFlBQUksS0FBSyxFQVJOO0FBU0gsY0FBTSxLQUFLO0FBVFIsS0FBUDtBQVdIO0FBQ0QsS0FBSyxRQUFMLENBQWMsTUFBZCxFQUFzQixZQUF0Qjs7QUFFQSxTQUFTLE9BQVQsQ0FBaUIsT0FBakIsRUFBMEI7QUFBQTs7QUFDdEIsUUFBTSxVQUFVLElBQWhCO0FBQ0EsWUFBUSxhQUFSLEVBQXVCLFVBQUMsS0FBRCxFQUFRLEdBQVI7QUFBQSxlQUFnQixNQUFLLEtBQUwsSUFBYyxJQUFJLE1BQUosQ0FBVyxPQUFYLEVBQW9CLFNBQVMsR0FBVCxDQUFwQixDQUE5QjtBQUFBLEtBQXZCO0FBQ0EsU0FBSyxLQUFMLEdBQWEsT0FBTyxJQUFQLENBQVksYUFBWixFQUEyQixHQUEzQixDQUErQixVQUFDLEdBQUQsRUFBUztBQUFFLGVBQU8sY0FBYyxHQUFkLENBQVA7QUFBMkIsS0FBckUsQ0FBYjtBQUNBLFNBQUssZUFBTCxHQUF1QixVQUFTLEtBQVQsRUFBZ0IsS0FBaEIsRUFBdUI7QUFDMUMsZ0JBQVEsY0FBYyxLQUFkLENBQVIsRUFBOEIsSUFBOUIsQ0FBbUMsb0JBQW9CLEtBQXBCLENBQW5DO0FBQ0gsS0FGRDtBQUdBLFNBQUssV0FBTCxHQUFtQixXQUFuQjtBQUNIOztBQUVELFNBQVMsbUJBQVQsQ0FBNkIsUUFBN0IsRUFBdUM7QUFDbkMsV0FBTyxTQUFTLFFBQVQsSUFBcUIsQ0FBckIsR0FBeUIsU0FBekIsR0FBcUMsVUFBNUM7QUFDSDs7QUFFRCxPQUFPLE9BQVAsR0FBaUIsT0FBakI7Ozs7O0FDOUVBLElBQU0sZUFBZSxRQUFRLFFBQVIsQ0FBckI7QUFBQSxJQUNJLE9BQU8sUUFBUSxNQUFSLENBRFg7QUFBQSxJQUVJLFVBQVUsUUFBUSxnQkFBUixDQUZkOztBQUlBLElBQUksYUFBYTtBQUNiLFFBQUksQ0FEUyxFQUNOO0FBQ1AsUUFBSSxDQUZTO0FBR2IsUUFBSSxDQUhTO0FBSWIsUUFBSSxDQUpTO0FBS2IsUUFBSSxDQUxTO0FBTWIsUUFBSSxDQU5TO0FBT2IsUUFBSSxDQVBTO0FBUWIsUUFBSSxDQVJTO0FBU2IsUUFBSSxPQVRTO0FBVWIsUUFBSSxNQVZTO0FBV2IsUUFBSSxPQVhTO0FBWWIsUUFBSSxNQVpTO0FBYWIsUUFBSSxNQWJTO0FBY2IsUUFBSSxLQWRTO0FBZWIsUUFBSSxNQWZTO0FBZ0JiLFFBQUk7QUFoQlMsQ0FBakI7QUFrQkEsSUFBTSxjQUFjLE9BQU8sSUFBUCxDQUFZLFVBQVosQ0FBcEI7O0FBRUEsU0FBUyxHQUFULENBQWEsT0FBYixFQUFzQixFQUF0QixFQUEwQjtBQUN0QixpQkFBYSxJQUFiLENBQWtCLElBQWxCO0FBQ0EsU0FBSyxNQUFMLEdBQWMsVUFBUyxLQUFULEVBQWdCO0FBQUUsZ0JBQVEsRUFBUixFQUFZLEtBQVo7QUFBb0IsS0FBcEQ7QUFDQSxRQUFJLFVBQVUsQ0FBQyxDQUFELEVBQUksRUFBSixDQUFkLENBSHNCLENBR0M7QUFDdkIsU0FBSyxPQUFMLEdBQWUsQ0FBQyxDQUFELEVBQUksRUFBSixDQUFmLENBSnNCLENBSUU7QUFDeEIsV0FBTztBQUNILGdCQUFRLGtCQUFXO0FBQUUsb0JBQVEsRUFBUixFQUFZLFFBQVEsQ0FBUixDQUFaO0FBQXlCLFNBRDNDO0FBRUgsaUJBQVMsbUJBQVc7QUFBRSxvQkFBUSxFQUFSLEVBQVksUUFBUSxDQUFSLENBQVo7QUFBeUIsU0FGNUM7QUFHSCxpQkFBUyxtQkFBVztBQUFFLG9CQUFRLEVBQVIsRUFBWSxDQUFaO0FBQWdCLFNBSG5DO0FBSUgsYUFBSyxlQUFXO0FBQUUsc0JBQVUsQ0FBQyxDQUFELEVBQUksQ0FBSixDQUFWO0FBQWtCLFNBSmpDO0FBS0gsZ0JBQVEsa0JBQVc7QUFBRSxzQkFBVSxDQUFDLENBQUQsRUFBSSxFQUFKLENBQVY7QUFBbUIsU0FMckM7QUFNSCxnQkFBUSxrQkFBVztBQUFFLHNCQUFVLENBQUMsRUFBRCxFQUFLLEVBQUwsQ0FBVjtBQUFvQixTQU50QztBQU9ILGVBQU8saUJBQVc7QUFBRSxzQkFBVSxDQUFDLEVBQUQsRUFBSyxFQUFMLENBQVY7QUFBb0IsU0FQckM7QUFRSCxZQUFJLEtBQUssRUFSTjtBQVNILGNBQU0sS0FBSztBQVRSLEtBQVA7QUFXSDtBQUNELEtBQUssUUFBTCxDQUFjLEdBQWQsRUFBbUIsWUFBbkI7O0FBRUEsU0FBUyxjQUFULENBQXdCLE9BQXhCLEVBQWlDO0FBQUE7O0FBQzdCLFFBQU0sa0JBQWtCLElBQXhCO0FBQ0EsWUFBUSxVQUFSLEVBQW9CLFVBQUMsS0FBRCxFQUFRLEdBQVI7QUFBQSxlQUFnQixNQUFLLEtBQUwsSUFBYyxJQUFJLEdBQUosQ0FBUSxPQUFSLEVBQWlCLFNBQVMsR0FBVCxDQUFqQixDQUE5QjtBQUFBLEtBQXBCO0FBQ0EsU0FBSyxXQUFMLEdBQW1CLFdBQW5CO0FBQ0EsU0FBSyxlQUFMLEdBQXVCLFVBQVMsRUFBVCxFQUFhLEtBQWIsRUFBb0I7QUFDdkMsWUFBSSxXQUFXLFdBQVcsRUFBWCxDQUFmO0FBQ0Esd0JBQWdCLFFBQWhCLEVBQTBCLElBQTFCLENBQStCLFFBQVEsQ0FBUixHQUFZLFNBQVosR0FBd0IsVUFBdkQ7QUFDSCxLQUhEO0FBSUg7O0FBRUQsT0FBTyxPQUFQLEdBQWlCLGNBQWpCOzs7OztBQ3JEQSxJQUFNLGVBQWUsUUFBUSxRQUFSLENBQXJCO0FBQUEsSUFDSSxPQUFPLFFBQVEsTUFBUixDQURYO0FBQUEsSUFFSSxVQUFVLFFBQVEsZ0JBQVIsQ0FGZDtBQUFBLElBR0ksVUFBVSxRQUFRLGdCQUFSLENBSGQ7O0FBS0EsSUFBTSxrQkFBa0I7QUFDcEIsU0FBSyxDQURlO0FBRXBCLFNBQUssQ0FGZTtBQUdwQixTQUFLLENBSGU7QUFJcEIsU0FBSyxDQUplO0FBS3BCLFNBQUssQ0FMZTtBQU1wQixTQUFLLENBTmU7QUFPcEIsU0FBSyxDQVBlO0FBUXBCLFNBQUs7QUFSZSxDQUF4QjtBQVVBLElBQU0sY0FBYyxPQUFPLElBQVAsQ0FBWSxlQUFaLENBQXBCOztBQUVBLElBQUksZ0JBQWdCLEVBQXBCO0FBQ0EsS0FBSyxJQUFJLElBQUksRUFBYixFQUFpQixLQUFLLEVBQXRCLEVBQTBCLEdBQTFCO0FBQStCLGtCQUFjLElBQWQsQ0FBbUIsQ0FBbkI7QUFBL0IsQ0FFQSxTQUFTLFVBQVQsQ0FBb0IsaUJBQXBCLEVBQXVDLFVBQXZDLEVBQW1ELElBQW5ELEVBQXlEO0FBQ3JELGlCQUFhLElBQWIsQ0FBa0IsSUFBbEI7QUFDQSxTQUFLLFFBQUwsR0FBZ0IsVUFBUyxRQUFULEVBQW1CO0FBQUUsMEJBQWtCLElBQWxCLEVBQXdCLFFBQXhCO0FBQW1DLEtBQXhFO0FBQ0EsU0FBSyxTQUFMLEdBQWlCLFVBQVMsSUFBVCxFQUFlO0FBQUUsbUJBQVcsSUFBWDtBQUFrQixLQUFwRDtBQUNBLFNBQUssS0FBTCxHQUFhLE9BQU8sR0FBUCxHQUFhLE9BQU8sRUFBcEIsR0FBeUIsT0FBTyxFQUE3Qzs7QUFFQSxXQUFPO0FBQ0gsZ0JBQVEsUUFBUSxNQUFSLEVBQWdCLElBQWhCLENBREw7QUFFSCxpQkFBUyxRQUFRLE9BQVIsRUFBaUIsSUFBakIsQ0FGTjtBQUdILGlCQUFTLFFBQVEsT0FBUixFQUFpQixJQUFqQixDQUhOO0FBSUgsWUFBSSxLQUFLLEVBSk47QUFLSCxjQUFNLEtBQUs7QUFMUixLQUFQO0FBT0g7QUFDRCxLQUFLLFFBQUwsQ0FBYyxVQUFkLEVBQTBCLFlBQTFCOztBQUVBLFNBQVMsTUFBVCxDQUFnQixVQUFoQixFQUE0QixLQUE1QixFQUFtQztBQUFFLGVBQVcsUUFBWCxDQUFvQixRQUFRLEtBQVIsR0FBZ0IsR0FBcEM7QUFBMEM7QUFDL0UsU0FBUyxPQUFULENBQWlCLFVBQWpCLEVBQTZCO0FBQUUsZUFBVyxRQUFYLENBQW9CLENBQXBCO0FBQXdCO0FBQ3ZELFNBQVMsT0FBVCxDQUFpQixVQUFqQixFQUE2QixDQUE3QixFQUFnQyxDQUFoQyxFQUFtQyxDQUFuQyxFQUFzQztBQUNsQyxRQUFJLE1BQU0sQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxHQUFWLENBQWMsVUFBQyxDQUFEO0FBQUEsZUFBTyxDQUFDLElBQUksR0FBTCxLQUFhLENBQXBCO0FBQUEsS0FBZCxDQUFWO0FBQUEsUUFDSSxNQUFNLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLEVBQVUsR0FBVixDQUFjLFVBQUMsQ0FBRDtBQUFBLGVBQU8sSUFBSSxFQUFYO0FBQUEsS0FBZCxDQURWO0FBRUEsZUFBVyxTQUFYLENBQXFCLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLEVBQVUsV0FBVyxLQUFyQixFQUE0QixDQUE1QixFQUErQixJQUFJLENBQUosQ0FBL0IsRUFBdUMsSUFBSSxDQUFKLENBQXZDLEVBQStDLElBQUksQ0FBSixDQUEvQyxFQUF1RCxJQUFJLENBQUosQ0FBdkQsRUFBK0QsSUFBSSxDQUFKLENBQS9ELEVBQXVFLElBQUksQ0FBSixDQUF2RSxDQUFyQjtBQUNIOztBQUVELFNBQVMsSUFBVCxDQUFjLFNBQWQsRUFBeUIsT0FBekIsRUFBa0MsVUFBbEMsRUFBOEM7QUFBQTs7QUFDMUMsU0FBSyxDQUFMLEdBQVMsRUFBVDtBQUNBLFNBQUssTUFBTCxHQUFjLEVBQWQ7QUFDQSxTQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLEtBQUssQ0FBckIsRUFBd0IsR0FBeEIsRUFBNkI7QUFDekIsYUFBSyxDQUFMLENBQU8sQ0FBUCxJQUFZLEVBQUUsR0FBRyxFQUFMLEVBQVo7QUFDQSxhQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLEtBQUssQ0FBckIsRUFBd0IsR0FBeEIsRUFBNkI7QUFDekIsaUJBQUssQ0FBTCxDQUFPLENBQVAsRUFBVSxDQUFWLENBQVksQ0FBWixJQUFpQixJQUFJLFVBQUosQ0FBZSxTQUFmLEVBQTBCLFVBQTFCLEVBQXVDLElBQUksQ0FBTCxHQUFXLENBQUMsSUFBSSxDQUFMLElBQVUsQ0FBckIsR0FBMEIsRUFBaEUsQ0FBakI7QUFDSDtBQUNKOztBQUVELFlBQVEsZUFBUixFQUF5QixVQUFDLEtBQUQsRUFBUSxHQUFSO0FBQUEsZUFBZ0IsTUFBSyxNQUFMLENBQVksS0FBWixJQUFxQixJQUFJLFVBQUosQ0FBZSxPQUFmLEVBQXdCLFVBQXhCLEVBQW9DLFNBQVMsR0FBVCxDQUFwQyxDQUFyQztBQUFBLEtBQXpCO0FBQ0EsU0FBSyxXQUFMLEdBQW1CLFdBQW5CO0FBQ0EsU0FBSyxhQUFMLEdBQXFCLGFBQXJCO0FBQ0EsU0FBSyxpQkFBTCxHQUF5QixRQUFRLGlCQUFSLEVBQTJCLElBQTNCLENBQXpCO0FBQ0EsU0FBSyxlQUFMLEdBQXVCLFFBQVEsZUFBUixFQUF5QixJQUF6QixDQUF2QjtBQUNBLFNBQUssMEJBQUwsR0FBa0MsUUFBUSwwQkFBUixFQUFvQyxJQUFwQyxDQUFsQztBQUNIOztBQUVELFNBQVMsaUJBQVQsQ0FBMkIsSUFBM0IsRUFBaUMsSUFBakMsRUFBdUMsUUFBdkMsRUFBaUQ7QUFDN0MsUUFBSSxTQUFTLGlCQUFpQixJQUFqQixFQUF1QixJQUF2QixDQUFiO0FBQUEsUUFDSSxNQUFNLFNBQVMsUUFBVCxDQURWO0FBRUEsVUFBTSxDQUFOLEdBQVUsT0FBTyxJQUFQLENBQVksU0FBWixFQUF1QixHQUF2QixDQUFWLEdBQXdDLE9BQU8sSUFBUCxDQUFZLFVBQVosQ0FBeEM7QUFDSDs7QUFFRCxTQUFTLGVBQVQsQ0FBeUIsSUFBekIsRUFBK0IsS0FBL0IsRUFBc0MsS0FBdEMsRUFBNkM7QUFDekMsU0FBSyxNQUFMLENBQVksZ0JBQWdCLEtBQWhCLENBQVosRUFBb0MsSUFBcEMsQ0FBeUMsUUFBUSxDQUFSLEdBQVksU0FBWixHQUF3QixVQUFqRTtBQUNIOztBQUVELFNBQVMsMEJBQVQsQ0FBb0MsSUFBcEMsRUFBMEMsSUFBMUMsRUFBZ0QsUUFBaEQsRUFBMEQ7QUFDdEQscUJBQWlCLElBQWpCLEVBQXVCLElBQXZCLEVBQTZCLElBQTdCLENBQWtDLFlBQWxDLEVBQWdELFNBQVMsUUFBVCxDQUFoRDtBQUNIOztBQUVELFNBQVMsZ0JBQVQsQ0FBMEIsSUFBMUIsRUFBZ0MsSUFBaEMsRUFBc0M7QUFDbEMsUUFBSSxvQkFBb0IsT0FBTyxFQUEvQjtBQUFBLFFBQ0ksSUFBSyxvQkFBb0IsQ0FBckIsR0FBMEIsQ0FEbEM7QUFBQSxRQUVJLElBQUksU0FBUyxvQkFBb0IsQ0FBN0IsSUFBa0MsQ0FGMUM7QUFHQSxXQUFPLEtBQUssQ0FBTCxDQUFPLENBQVAsRUFBVSxDQUFWLENBQVksQ0FBWixDQUFQO0FBQ0g7O0FBRUQsT0FBTyxPQUFQLEdBQWlCLElBQWpCOzs7OztBQ25GQSxJQUFNLGVBQWUsUUFBUSxRQUFSLENBQXJCO0FBQUEsSUFDSSxPQUFPLFFBQVEsTUFBUixDQURYO0FBQUEsSUFFSSxVQUFVLFFBQVEsZ0JBQVIsQ0FGZDtBQUFBLElBR0ksVUFBVSxRQUFRLGdCQUFSLENBSGQ7O0FBS0EsSUFBSSxVQUFVO0FBQ1YsYUFBUyxFQUFFLE1BQU0sRUFBUixFQUFZLFFBQVEsRUFBcEIsRUFEQztBQUVWLGFBQVMsRUFBRSxNQUFNLEVBQVIsRUFBWSxRQUFRLENBQXBCLEVBRkM7QUFHVixPQUFHLEVBQUUsTUFBTSxFQUFSLEVBQVksUUFBUSxDQUFwQixFQUhPO0FBSVYsT0FBRyxFQUFFLE1BQU0sRUFBUixFQUFZLFFBQVEsQ0FBcEIsRUFKTztBQUtWLE9BQUcsRUFBRSxNQUFNLEVBQVIsRUFBWSxRQUFRLENBQXBCLEVBTE87QUFNVixPQUFHLEVBQUUsTUFBTSxFQUFSLEVBQVksUUFBUSxDQUFwQixFQU5PO0FBT1YsT0FBRyxFQUFFLE1BQU0sRUFBUixFQUFZLFFBQVEsQ0FBcEIsRUFQTztBQVFWLE9BQUcsRUFBRSxNQUFNLEVBQVIsRUFBWSxRQUFRLENBQXBCLEVBUk87QUFTVixPQUFHLEVBQUUsTUFBTSxFQUFSLEVBQVksUUFBUSxDQUFwQixFQVRPO0FBVVYsT0FBRyxFQUFFLE1BQU0sRUFBUixFQUFZLFFBQVEsQ0FBcEIsRUFWTztBQVdWLGNBQVUsRUFBRSxNQUFNLEVBQVIsRUFBWSxRQUFRLENBQXBCO0FBWEEsQ0FBZDs7QUFjQSxJQUFJLGNBQWMsRUFBbEI7QUFDQSxJQUFJLGdCQUFnQixFQUFwQjtBQUNBLFFBQVEsT0FBUixFQUFpQixVQUFDLEtBQUQsRUFBUSxHQUFSLEVBQWdCO0FBQzdCLGdCQUFZLE1BQU0sRUFBbEIsSUFBd0IsR0FBeEI7QUFDQSxrQkFBYyxNQUFNLElBQXBCLElBQTRCLEdBQTVCO0FBQ0gsQ0FIRDtBQUlBLElBQU0sY0FBYyxPQUFPLElBQVAsQ0FBWSxXQUFaLENBQXBCO0FBQUEsSUFDSSxnQkFBZ0IsT0FBTyxJQUFQLENBQVksYUFBWixDQURwQjs7QUFHQSxTQUFTLElBQVQsR0FBZ0I7QUFDWixpQkFBYSxJQUFiLENBQWtCLElBQWxCO0FBQ0g7QUFDRCxLQUFLLFFBQUwsQ0FBYyxJQUFkLEVBQW9CLFlBQXBCOztBQUVBLFNBQVMsS0FBVCxHQUFpQjtBQUFBOztBQUNiLFlBQVEsT0FBUixFQUFpQixVQUFDLEtBQUQsRUFBUSxHQUFSO0FBQUEsZUFBZ0IsTUFBSyxHQUFMLElBQVksSUFBSSxJQUFKLEVBQTVCO0FBQUEsS0FBakI7QUFDQSxTQUFLLFdBQUwsR0FBbUIsV0FBbkI7QUFDQSxTQUFLLGVBQUwsR0FBdUIsUUFBUSxlQUFSLEVBQXlCLElBQXpCLENBQXZCO0FBQ0EsU0FBSyxpQkFBTCxHQUF5QixRQUFRLGlCQUFSLEVBQTJCLElBQTNCLENBQXpCO0FBQ0EsU0FBSyxhQUFMLEdBQXFCLGFBQXJCO0FBQ0g7O0FBRUQsU0FBUyxlQUFULENBQXlCLEtBQXpCLEVBQWdDLEtBQWhDLEVBQXVDLEtBQXZDLEVBQThDO0FBQzFDLFFBQUksWUFBWSxZQUFZLEtBQVosQ0FBaEI7QUFDQSxRQUFJLFFBQVEsUUFBUSxFQUFSLEdBQWEsS0FBYixHQUFxQixRQUFRLEdBQXpDO0FBQ0EsVUFBTSxTQUFOLEVBQWlCLElBQWpCLENBQXNCLFFBQXRCLEVBQWdDLEtBQWhDO0FBQ0g7O0FBRUQsU0FBUyxpQkFBVCxDQUEyQixLQUEzQixFQUFrQyxJQUFsQyxFQUF3QyxRQUF4QyxFQUFrRDtBQUM5QyxRQUFJLFlBQVksY0FBYyxJQUFkLENBQWhCO0FBQ0EsUUFBSSxhQUFhLFdBQVcsQ0FBWCxHQUFlLFNBQWYsR0FBMkIsVUFBNUM7QUFDQSxVQUFNLFNBQU4sRUFBaUIsSUFBakIsQ0FBc0IsVUFBdEI7QUFDSDs7QUFFRCxPQUFPLE9BQVAsR0FBaUIsS0FBakI7Ozs7O0FDckRBLElBQU0sVUFBVSxRQUFRLGdCQUFSLENBQWhCO0FBQUEsSUFDSSxRQUFRLFFBQVEsY0FBUixDQURaO0FBQUEsSUFFSSxlQUFlLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLEVBQVUsQ0FBVixFQUFhLENBQWIsRUFBZ0IsQ0FBaEIsRUFBbUIsQ0FBbkIsRUFBc0IsQ0FBdEIsQ0FGbkI7QUFBQSxJQUdJLGNBQWMsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxDQUFWLENBSGxCO0FBQUEsSUFJSSxnQkFBZ0IsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxDQUFWLEVBQWEsQ0FBYixFQUFnQixDQUFoQixFQUFtQixDQUFuQixFQUFzQixDQUF0QixDQUpwQjtBQUFBLElBS0ksUUFBUSxFQUxaO0FBQUEsSUFNSSxhQUFhLE1BQU0sS0FBTixFQUFhLEdBQWIsRUFBa0IsQ0FBbEIsQ0FOakI7QUFBQSxJQU11QztBQUNuQyxVQUFVLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxFQUFQLEVBQVcsRUFBWCxFQUFlLEVBQWYsRUFBbUIsRUFBbkIsRUFBdUIsRUFBdkIsRUFBMkIsRUFBM0IsQ0FQZDs7QUFTQSxTQUFTLFVBQVQsQ0FBb0IsTUFBcEIsRUFBNEI7QUFDeEIsU0FBSyxNQUFMLEdBQWMsVUFBUyxJQUFULEVBQWU7QUFDekIsZUFBTyxTQUFTLElBQVQsQ0FBUDtBQUNILEtBRkQ7O0FBSUEsU0FBSyxLQUFMLEdBQWEsWUFBVztBQUNwQixlQUFPLFNBQVMsRUFBVCxDQUFQO0FBQ0gsS0FGRDtBQUdIOztBQUVELFNBQVMsUUFBVCxDQUFrQixJQUFsQixFQUF3QjtBQUNwQixRQUFNLGNBQWMsT0FBTyxJQUFQLENBQXBCO0FBQ0EsV0FBTyxjQUFjLEdBQWQsQ0FBa0IsVUFBQyxLQUFELEVBQVc7QUFDaEMsZUFBTyxZQUFZLE1BQVosR0FBcUIsS0FBckIsR0FBNkIsWUFBWSxVQUFaLENBQXVCLEtBQXZCLENBQTdCLEdBQTZELEtBQXBFO0FBQ0gsS0FGTSxDQUFQO0FBR0g7O0FBRUQsU0FBUyxJQUFULENBQWMsVUFBZCxFQUEwQjtBQUN0QixRQUFNLE9BQU8sSUFBYjs7QUFFQSxTQUFLLEtBQUwsR0FBYSxZQUFXO0FBQ3BCLGdCQUNJLFlBREosRUFFSSxVQUFDLENBQUQsRUFBTztBQUNILGlCQUFLLENBQUwsQ0FBTyxDQUFQLElBQVksRUFBRSxHQUFHLEVBQUwsRUFBWjtBQUNBLG9CQUNJLFdBREosRUFFSSxVQUFDLENBQUQsRUFBTztBQUNILHFCQUFLLENBQUwsQ0FBTyxDQUFQLEVBQVUsQ0FBVixDQUFZLENBQVosSUFBaUIsSUFBSSxVQUFKLENBQWUsVUFBQyxZQUFELEVBQWtCO0FBQzlDLCtCQUFXLENBQUMsS0FBSyxDQUFOLEVBQVMsTUFBVCxDQUFnQixDQUFDLENBQUQsRUFBSSxDQUFKLEVBQU8sUUFBUSxJQUFJLENBQVosQ0FBUCxDQUFoQixFQUF3QyxNQUF4QyxDQUErQyxZQUEvQyxDQUFYO0FBQ0gsaUJBRmdCLENBQWpCO0FBR0gsYUFOTDtBQVFILFNBWkw7O0FBZUEsZ0JBQVEsV0FBUixFQUFxQixVQUFDLEdBQUQ7QUFBQSxtQkFBUyxXQUFXLENBQUMsS0FBSyxHQUFOLEVBQVcsTUFBWCxDQUFrQixDQUFDLENBQUQsRUFBSSxFQUFKLEVBQVEsQ0FBUixDQUFsQixFQUE4QixNQUE5QixDQUFxQyxVQUFyQyxDQUFYLENBQVQ7QUFBQSxTQUFyQjtBQUNILEtBakJEOztBQW1CQSxTQUFLLENBQUwsR0FBUyxFQUFUOztBQUVBLFNBQUssS0FBTDs7QUFFQSxTQUFLLENBQUwsQ0FBTyxDQUFQLEVBQVUsQ0FBVixDQUFZLENBQVosRUFBZSxNQUFmLENBQXNCLFVBQXRCO0FBQ0EsU0FBSyxDQUFMLENBQU8sQ0FBUCxFQUFVLENBQVYsQ0FBWSxDQUFaLEVBQWUsTUFBZixDQUFzQixVQUF0QjtBQUNBLFNBQUssQ0FBTCxDQUFPLENBQVAsRUFBVSxDQUFWLENBQVksQ0FBWixFQUFlLE1BQWYsQ0FBc0IsVUFBdEI7QUFDQSxTQUFLLENBQUwsQ0FBTyxDQUFQLEVBQVUsQ0FBVixDQUFZLENBQVosRUFBZSxNQUFmLENBQXNCLFVBQXRCO0FBQ0g7O0FBRUQsT0FBTyxPQUFQLEdBQWlCLElBQWpCOzs7OztBQzFEQSxJQUFNLGVBQWUsUUFBUSxRQUFSLENBQXJCO0FBQUEsSUFDSSxPQUFPLFFBQVEsTUFBUixDQURYO0FBQUEsSUFFSSxVQUFVLFFBQVEsZ0JBQVIsQ0FGZDtBQUFBLElBR0ksZ0JBQWdCLENBQUMsRUFBRCxDQUhwQjs7QUFLQSxTQUFTLFVBQVQsR0FBc0I7QUFDbEIsaUJBQWEsSUFBYixDQUFrQixJQUFsQjtBQUNBLFNBQUssdUJBQUwsR0FBK0IsUUFBUSx1QkFBUixFQUFpQyxJQUFqQyxDQUEvQjtBQUNBLFNBQUssaUJBQUwsR0FBeUIsUUFBUSxpQkFBUixFQUEyQixJQUEzQixDQUF6QjtBQUNBLFNBQUssYUFBTCxHQUFxQixhQUFyQjtBQUNIO0FBQ0QsS0FBSyxRQUFMLENBQWMsVUFBZCxFQUEwQixZQUExQjs7QUFFQSxTQUFTLHVCQUFULENBQWlDLFVBQWpDLEVBQTZDLGtCQUE3QyxFQUFpRTtBQUM3RCxRQUFJLHNCQUFzQixJQUExQixFQUFnQztBQUNoQyxlQUFXLElBQVgsQ0FBZ0IsV0FBaEIsRUFBNkIsa0JBQTdCO0FBQ0g7O0FBRUQsU0FBUyxpQkFBVCxDQUEyQixVQUEzQixFQUF1QyxJQUF2QyxFQUE2QyxRQUE3QyxFQUF1RDtBQUNuRCxRQUFJLFdBQVcsQ0FBZixFQUFrQjtBQUNkLG1CQUFXLElBQVgsQ0FBZ0IsU0FBaEI7QUFDSCxLQUZELE1BRU87QUFDSCxtQkFBVyxJQUFYLENBQWdCLFVBQWhCO0FBQ0EsbUJBQVcsSUFBWCxDQUFnQixXQUFoQixFQUE2QixJQUE3QjtBQUNIO0FBQ0o7O0FBRUQsT0FBTyxPQUFQLEdBQWlCLFVBQWpCOzs7QUMzQkE7O0FBRUEsSUFBTSxlQUFlLFFBQVEsUUFBUixDQUFyQjtBQUFBLElBQ0ksT0FBTyxRQUFRLE1BQVIsQ0FEWDtBQUFBLElBRUksWUFBWSxFQUFFLFlBQVksc0JBQVc7QUFBRSxlQUFPLENBQVA7QUFBVSxLQUFyQyxFQUZoQjs7QUFJQSxTQUFTLFlBQVQsQ0FBc0IsUUFBdEIsRUFBZ0MsWUFBaEMsRUFBOEMsTUFBOUMsRUFBc0Q7QUFDbEQsaUJBQWEsSUFBYixDQUFrQixJQUFsQjtBQUNBLFFBQUksU0FBUyxJQUFiO0FBQUEsUUFDSSxVQUFVLEtBRGQ7QUFBQSxRQUVJLGdCQUZKO0FBQUEsUUFHSSxVQUFVLEVBSGQ7QUFBQSxRQUlJLGdCQUFnQixDQUpwQjtBQUFBLFFBS0ksWUFBWSxhQUFhLFVBQWIsRUFMaEI7O0FBT0EsUUFBSSxnQkFBZ0IsU0FBaEIsYUFBZ0IsR0FBVztBQUMzQixnQkFBUSxLQUFSO0FBQ0EsWUFBSSxDQUFDLE9BQU8sU0FBUCxFQUFMLEVBQXlCLE9BQU8sSUFBUCxDQUFZLFNBQVo7QUFDNUIsS0FIRDs7QUFLQSxTQUFLLFNBQUwsR0FBaUIsUUFBakI7O0FBRUEsU0FBSyxPQUFMLEdBQWUsVUFBVSxPQUFWLENBQWtCLElBQWxCLENBQXVCLFNBQXZCLENBQWY7O0FBRUEsU0FBSyxVQUFMLEdBQWtCLFVBQVUsVUFBVixDQUFxQixJQUFyQixDQUEwQixTQUExQixDQUFsQjs7QUFFQSxTQUFLLFFBQUwsR0FBZ0IsWUFBVztBQUN2QixlQUFPLFVBQVA7QUFDQSxlQUFPLE9BQVAsQ0FBZSxhQUFhLFdBQTVCO0FBQ0EsZUFBTyxNQUFQO0FBQ0gsS0FKRDs7QUFNQSxTQUFLLFNBQUwsR0FBaUIsWUFBVztBQUFFLGVBQU8sUUFBUSxNQUFSLEdBQWlCLENBQXhCO0FBQTRCLEtBQTFEOztBQUVBLFNBQUssSUFBTCxHQUFZLFVBQVMsSUFBVCxFQUFlO0FBQ3ZCLFlBQUksQ0FBQyxPQUFMLEVBQWM7QUFBRSxvQkFBUSxHQUFSLENBQVksV0FBVyxvQkFBdkIsRUFBOEM7QUFBUzs7QUFFdkUsWUFBSSxNQUFNLFFBQVEsWUFBUixDQUFWO0FBQUEsWUFDSSxZQUFZLEdBRGhCO0FBQUEsWUFFSSxRQUFTLFFBQVMsT0FBTyxLQUFLLFVBQVosS0FBMkIsVUFBckMsR0FBb0QsSUFBcEQsR0FBMkQsU0FGdkU7O0FBSUEsWUFBSSxPQUFPLFNBQVAsRUFBSixFQUF3QjtBQUNwQixzQkFBVSxJQUFWLENBQWUscUJBQWYsQ0FBcUMsR0FBckM7QUFDQSxtQkFBTyxVQUFVLElBQWpCLEVBQXVCLEdBQXZCO0FBQ0Esd0JBQVksTUFBTSxJQUFsQjtBQUNBLHNCQUFVLElBQVYsQ0FBZSx1QkFBZixDQUF1QyxDQUF2QyxFQUEwQyxTQUExQztBQUNBLG1CQUFPLElBQVAsQ0FBWSxTQUFaO0FBQ0gsU0FORCxNQU1PO0FBQ0gsc0JBQVUsSUFBVixDQUFlLGNBQWYsQ0FBOEIsQ0FBOUIsRUFBaUMsU0FBakM7QUFDSDs7QUFFRCxZQUFJLFNBQVMsYUFBYSxrQkFBYixFQUFiO0FBQ0EsZUFBTyxPQUFQLENBQWUsU0FBZjs7QUFFQSxrQkFBVSxJQUFWLENBQWUsdUJBQWYsQ0FBdUMsTUFBTSxVQUFOLEVBQXZDLEVBQTJELFNBQTNEOztBQUVBLGVBQU8sWUFBUCxDQUFvQixjQUFwQixDQUFtQyxhQUFuQyxFQUFrRCxTQUFsRDtBQUNBLGVBQU8sTUFBUCxHQUFnQixPQUFoQjs7QUFFQSxlQUFPLGdCQUFQLENBQXdCLE9BQXhCLEVBQWlDLGFBQWpDOztBQUVBLGdCQUFRLElBQVIsQ0FBYSxNQUFiO0FBQ0EsZUFBTyxLQUFQLENBQWEsU0FBYjtBQUNBLGVBQU8sSUFBUCxDQUFZLFNBQVosRUFBdUIsS0FBdkI7QUFDSCxLQTlCRDs7QUFnQ0EsU0FBSyxrQkFBTCxHQUEwQixVQUFTLElBQVQsRUFBZTtBQUNyQyx3QkFBZ0IsSUFBaEI7QUFDQSxZQUFJLE1BQU0sUUFBUSxZQUFSLENBQVY7QUFDQSxnQkFBUSxPQUFSLENBQWdCLFVBQUMsTUFBRCxFQUFZO0FBQ3hCLG1CQUFPLFlBQVAsQ0FBb0IsY0FBcEIsQ0FBbUMsYUFBbkMsRUFBa0QsR0FBbEQ7QUFDSCxTQUZEO0FBR0gsS0FORDs7QUFRQSxlQUFXLFFBQVgsRUFBcUIsWUFBckIsRUFBbUMsVUFBQyxNQUFELEVBQVk7QUFDM0Msa0JBQVUsTUFBVjtBQUNBLGtCQUFVLElBQVY7QUFDQSxZQUFJLE9BQU8sTUFBUCxLQUFrQixVQUF0QixFQUFrQztBQUM5QixtQkFBTyxNQUFQO0FBQ0g7QUFDSixLQU5EO0FBT0g7QUFDRCxLQUFLLFFBQUwsQ0FBYyxZQUFkLEVBQTRCLFlBQTVCOztBQUVBLFNBQVMsVUFBVCxDQUFvQixRQUFwQixFQUE4QixZQUE5QixFQUE0QyxJQUE1QyxFQUFrRDtBQUM5QyxRQUFJLFVBQVUsSUFBSSxjQUFKLEVBQWQ7QUFDQSxZQUFRLElBQVIsQ0FBYSxLQUFiLEVBQW9CLFFBQXBCLEVBQThCLElBQTlCO0FBQ0EsWUFBUSxZQUFSLEdBQXVCLGFBQXZCO0FBQ0EsWUFBUSxNQUFSLEdBQWlCLFlBQVk7QUFDekIscUJBQWEsZUFBYixDQUE2QixRQUFRLFFBQXJDLEVBQStDLElBQS9DO0FBQ0gsS0FGRDtBQUdBLFlBQVEsSUFBUjtBQUNIOztBQUVELFNBQVMsTUFBVCxDQUFnQixVQUFoQixFQUE0QixHQUE1QixFQUFpQztBQUM3QixlQUFXLGNBQVgsQ0FBMEIsV0FBVyxLQUFyQyxFQUE0QyxHQUE1QztBQUNIOztBQUVELFNBQVMsT0FBVCxDQUFpQixZQUFqQixFQUErQjtBQUMzQixXQUFPLGFBQWEsV0FBcEI7QUFDSDs7QUFFRCxPQUFPLE9BQVAsR0FBaUIsWUFBakI7OztBQ3RHQTs7QUFFQSxJQUFNLGVBQWUsUUFBUSxRQUFSLENBQXJCO0FBQUEsSUFDSSxPQUFPLFFBQVEsTUFBUixDQURYOztBQUdBLFNBQVMsUUFBVCxDQUFrQixXQUFsQixFQUErQixlQUEvQixFQUFnRDtBQUM1QyxpQkFBYSxJQUFiLENBQWtCLElBQWxCOztBQUVBLFFBQUksaUJBQWlCLFNBQWpCLGNBQWlCLENBQVMsU0FBVCxFQUFvQjtBQUNyQyxlQUFRLGFBQWMsT0FBTyxVQUFVLElBQWpCLEtBQTBCLFVBQXpDLEdBQXdELFNBQXhELEdBQW9FLEVBQUUsTUFBTSxnQkFBVztBQUFFLHVCQUFPLFNBQVA7QUFBbUIsYUFBeEMsRUFBM0U7QUFDSCxLQUZEOztBQUlBLFFBQUksdUJBQXVCLFNBQXZCLG9CQUF1QixDQUFTLFFBQVQsRUFBbUI7QUFDMUMsZUFBTyxZQUFZLFlBQU07QUFDckIsZ0JBQUksYUFBSixFQUFtQjtBQUNmO0FBQ0EsMEJBQVUscUJBQXFCLFFBQXJCLENBQVY7QUFDSDtBQUNKLFNBTE0sRUFLSixTQUxJLENBQVA7QUFNSCxLQVBEOztBQVNBLFFBQUksZ0JBQWdCLEtBQXBCO0FBQUEsUUFDSSxZQUFZLGVBQWUsZUFBZixDQURoQjtBQUFBLFFBRUksVUFBVSxRQUZkO0FBQUEsUUFHSSxXQUFXLElBSGY7O0FBS0EsU0FBSyxjQUFMLEdBQXNCLFVBQVUsV0FBVixFQUF1QjtBQUN6QyxvQkFBWSxlQUFlLFdBQWYsQ0FBWjtBQUNBLGlCQUFTLGNBQVQ7QUFDQSxlQUFPLFFBQVA7QUFDSCxLQUpEOztBQU1BLFNBQUssS0FBTCxHQUFhLFVBQVMsUUFBVCxFQUFtQjtBQUM1QixZQUFJLGFBQUosRUFBbUI7QUFDbkIsd0JBQWdCLElBQWhCO0FBQ0E7QUFDQSxrQkFBVSxxQkFBcUIsUUFBckIsQ0FBVjtBQUNILEtBTEQ7O0FBT0EsU0FBSyxJQUFMLEdBQVksWUFBVztBQUNuQix3QkFBZ0IsS0FBaEI7QUFDQTtBQUNBLGtCQUFVLFFBQVY7QUFDSCxLQUpEOztBQU1BLFNBQUssY0FBTCxHQUFzQixZQUFXO0FBQzdCLGlCQUFTLElBQVQsQ0FBYyxVQUFkLEVBQTBCLFNBQTFCO0FBQ0gsS0FGRDtBQUdIO0FBQ0QsS0FBSyxRQUFMLENBQWMsUUFBZCxFQUF3QixZQUF4Qjs7QUFFQSxTQUFTLFVBQVQsQ0FBb0IsT0FBcEIsRUFBNkI7QUFDekIsUUFBSSxhQUFhLElBQWpCOztBQUVBLFFBQUksbUJBQW1CLFNBQW5CLGdCQUFtQixDQUFTLFFBQVQsRUFBbUIsSUFBbkIsRUFBeUI7QUFDNUMsWUFBSSxnQkFBZ0IsUUFBcEI7QUFBQSxZQUNJLFNBQVMsUUFBUSxrQkFBUixFQURiO0FBQUEsWUFFSSxNQUFNLFFBQVEsV0FGbEI7QUFBQSxZQUdJLGFBQWEsUUFBUSxVQUFSLEdBQXFCLElBSHRDO0FBQUEsWUFJSSxlQUFlLE1BQU8sS0FBSyxJQUFMLEtBQWMsSUFBckIsR0FBNkIsS0FKaEQ7QUFLQTtBQUNBLFlBQUksU0FBUyxRQUFRLFlBQVIsQ0FBcUIsQ0FBckIsRUFBd0IsVUFBeEIsRUFBb0MsUUFBUSxVQUE1QyxDQUFiO0FBQ0EsZUFBTyxnQkFBUCxDQUF3QixPQUF4QixFQUFpQyxZQUFNO0FBQUU7QUFBa0IsU0FBM0Q7QUFDQSxlQUFPLE1BQVAsR0FBZ0IsTUFBaEI7QUFDQSxlQUFPLE9BQVAsQ0FBZSxRQUFRLFdBQXZCO0FBQ0EsZUFBTyxLQUFQLENBQWEsWUFBYjs7QUFFQSxlQUFPLFNBQVMsTUFBVCxHQUFrQjtBQUFFLDRCQUFnQixRQUFoQjtBQUEyQixTQUF0RDtBQUNILEtBZEQ7O0FBZ0JBLFNBQUssV0FBTCxHQUFtQixVQUFVLGdCQUFWLEdBQTZCLGdCQUFoRDs7QUFFQSxTQUFLLFFBQUwsR0FBZ0IsVUFBUyxlQUFULEVBQTBCO0FBQ3RDLGVBQU8sSUFBSSxRQUFKLENBQWEsV0FBVyxXQUF4QixFQUFxQyxlQUFyQyxDQUFQO0FBQ0gsS0FGRDtBQUdIOztBQUVELFNBQVMsZ0JBQVQsQ0FBMEIsUUFBMUIsRUFBb0MsSUFBcEMsRUFBMEM7QUFDdEMsUUFBSSxnQkFBZ0IsUUFBcEI7QUFDQSxlQUFXLFlBQU07QUFBRTtBQUFrQixLQUFyQyxFQUF1QyxLQUFLLElBQUwsRUFBdkM7QUFDQSxXQUFPLFNBQVMsTUFBVCxHQUFrQjtBQUFFLHdCQUFnQixRQUFoQjtBQUEyQixLQUF0RDtBQUNIOztBQUVELFNBQVMsUUFBVCxHQUFvQixDQUFFOztBQUV0QixPQUFPLE9BQVAsR0FBaUIsVUFBUyxPQUFULEVBQWtCO0FBQUUsV0FBTyxJQUFJLFVBQUosQ0FBZSxPQUFmLENBQVA7QUFBaUMsQ0FBdEU7OztBQ3JGQTs7QUFFQSxJQUFNLGVBQWUsUUFBUSxRQUFSLENBQXJCO0FBQUEsSUFDSSxPQUFPLFFBQVEsTUFBUixDQURYO0FBQUEsSUFFSSxVQUFVLFFBQVEsZ0JBQVIsQ0FGZDs7QUFJQSxTQUFTLEdBQVQsQ0FBYSxPQUFiLEVBQXNCO0FBQ2xCLGlCQUFhLElBQWIsQ0FBa0IsSUFBbEI7QUFDQSxRQUFJLE1BQU0sSUFBVjs7QUFFQSxTQUFLLE9BQUwsR0FBZSxLQUFLLE9BQUwsSUFBZ0IsS0FBSyxPQUFMLENBQWhCLEdBQWdDLEdBQS9DOztBQUVBLFNBQUssTUFBTCxHQUFjLFlBQVc7QUFBRSxZQUFJLElBQUosQ0FBUyxTQUFULEVBQW9CLEdBQXBCO0FBQTBCLEtBQXJEO0FBQ0EsU0FBSyxTQUFMLEdBQWlCLFVBQVMsTUFBVCxFQUFpQjtBQUM5QixZQUFJLE9BQUosR0FBYyxLQUFLLElBQUksT0FBSixHQUFjLE1BQW5CLENBQWQ7QUFDQSxZQUFJLE1BQUo7QUFDSCxLQUhEO0FBSUg7QUFDRCxLQUFLLFFBQUwsQ0FBYyxHQUFkLEVBQW1CLFlBQW5COztBQUVBLFNBQVMsSUFBVCxDQUFjLEdBQWQsRUFBbUI7QUFDZixXQUFPLE1BQU0sRUFBTixHQUFXLEVBQVgsR0FBaUIsTUFBTSxHQUFOLEdBQVksR0FBWixHQUFrQixHQUExQztBQUNIOztBQUVELE9BQU8sT0FBUCxHQUFpQixHQUFqQjs7O0FDeEJBOztBQUVBLElBQU0sZUFBZSxRQUFRLFFBQVIsQ0FBckI7QUFBQSxJQUNJLE9BQU8sUUFBUSxNQUFSLENBRFg7QUFBQSxJQUVJLFVBQVUsUUFBUSxnQkFBUixDQUZkOztBQUlBLFNBQVMsUUFBVCxDQUFrQixHQUFsQixFQUF1QixVQUF2QixFQUFtQyxLQUFuQyxFQUEwQztBQUN0QyxpQkFBYSxJQUFiLENBQWtCLElBQWxCO0FBQ0EsUUFBSSxXQUFXLElBQWY7O0FBRUEsU0FBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLFNBQUssTUFBTCxHQUFjLFlBQVc7QUFBRSxpQkFBUyxJQUFULENBQWMsU0FBZCxFQUEwQixLQUFLLElBQUksT0FBVixHQUFxQixVQUFyQixHQUFrQyxJQUEzRDtBQUFtRSxLQUE5Rjs7QUFFQSxRQUFJLEVBQUosQ0FBTyxTQUFQLEVBQWtCLFNBQVMsTUFBM0I7QUFDSDtBQUNELEtBQUssUUFBTCxDQUFjLFFBQWQsRUFBd0IsWUFBeEI7O0FBRUEsT0FBTyxPQUFQLEdBQWlCO0FBQ2IsVUFBTSxXQUFTLEdBQVQsRUFBYyxJQUFkLEVBQW9CO0FBQUUsZUFBTyxJQUFJLFFBQUosQ0FBYSxHQUFiLEVBQWtCLENBQWxCLEVBQXFCLE9BQU8sSUFBUCxHQUFjLElBQW5DLENBQVA7QUFBaUQsS0FEaEU7QUFFYixXQUFPLFlBQVMsR0FBVCxFQUFjLElBQWQsRUFBb0I7QUFBRSxlQUFPLElBQUksUUFBSixDQUFhLEdBQWIsRUFBa0IsSUFBSSxDQUF0QixFQUF5QixPQUFPLElBQVAsR0FBYyxLQUF2QyxDQUFQO0FBQXNELEtBRnRFO0FBR2IsVUFBTSxXQUFTLEdBQVQsRUFBYyxJQUFkLEVBQW9CO0FBQUUsZUFBTyxJQUFJLFFBQUosQ0FBYSxHQUFiLEVBQWtCLEdBQWxCLEVBQXVCLE9BQU8sSUFBUCxHQUFjLElBQXJDLENBQVA7QUFBbUQsS0FIbEU7QUFJYixXQUFPLFlBQVMsR0FBVCxFQUFjLElBQWQsRUFBb0I7QUFBRSxlQUFPLElBQUksUUFBSixDQUFhLEdBQWIsRUFBa0IsSUFBSSxDQUF0QixFQUF5QixPQUFPLElBQVAsR0FBYyxLQUF2QyxDQUFQO0FBQXNELEtBSnRFO0FBS2IsV0FBTyxXQUFTLEdBQVQsRUFBYyxJQUFkLEVBQW9CO0FBQUUsZUFBTyxJQUFJLFFBQUosQ0FBYSxHQUFiLEVBQWtCLElBQWxCLEVBQXdCLE9BQU8sSUFBUCxHQUFjLEtBQXRDLENBQVA7QUFBcUQsS0FMckU7QUFNYixZQUFRLFlBQVMsR0FBVCxFQUFjLElBQWQsRUFBb0I7QUFBRSxlQUFPLElBQUksUUFBSixDQUFhLEdBQWIsRUFBa0IsSUFBSSxDQUF0QixFQUF5QixPQUFPLElBQVAsR0FBYyxNQUF2QyxDQUFQO0FBQXVELEtBTnhFO0FBT2IsV0FBTyxXQUFTLEdBQVQsRUFBYyxJQUFkLEVBQW9CO0FBQUUsZUFBTyxJQUFJLFFBQUosQ0FBYSxHQUFiLEVBQWtCLEtBQWxCLEVBQXlCLE9BQU8sSUFBUCxHQUFjLEtBQXZDLENBQVA7QUFBc0QsS0FQdEU7QUFRYixZQUFRLFlBQVMsR0FBVCxFQUFjLElBQWQsRUFBb0I7QUFBRSxlQUFPLElBQUksUUFBSixDQUFhLEdBQWIsRUFBa0IsSUFBSSxFQUF0QixFQUEwQixPQUFPLElBQVAsR0FBYyxNQUF4QyxDQUFQO0FBQXdEO0FBUnpFLENBQWpCOzs7QUNqQkE7O0FBQ0EsSUFBTSxlQUFlLFFBQVEsbUJBQVIsQ0FBckI7QUFDQTs7O0FBR0EsU0FBUyxNQUFULENBQWdCLFFBQWhCLEVBQTBCLFlBQTFCLEVBQXdDLE1BQXhDLEVBQWdEO0FBQzVDLFFBQUksZUFBZSxJQUFJLFlBQUosQ0FBaUIsUUFBakIsRUFBMkIsWUFBM0IsRUFBeUMsTUFBekMsQ0FBbkI7QUFBQSxRQUNJLGFBQWEsYUFBYSxrQkFBYixFQURqQjtBQUFBLFFBRUksUUFBUSxDQUZaO0FBQUEsUUFHSSxXQUFXLENBSGY7QUFBQSxRQUlJLFNBQVMsSUFKYjs7QUFNQSxlQUFXLFNBQVgsQ0FBcUIsS0FBckIsR0FBNkIsS0FBN0I7QUFDQSxpQkFBYSxPQUFiLENBQXFCLFVBQXJCOztBQUVBLFFBQUksY0FBYyxTQUFkLFdBQWMsR0FBVztBQUFFLHFCQUFhLGtCQUFiLENBQWdDLHVCQUF1QixRQUFRLFFBQS9CLENBQWhDO0FBQTRFLEtBQTNHOztBQUVBLFNBQUssU0FBTCxHQUFpQixRQUFqQjtBQUNBLFNBQUssSUFBTCxHQUFZLGFBQWEsSUFBYixDQUFrQixJQUFsQixDQUF1QixZQUF2QixDQUFaOztBQUVBLFNBQUssT0FBTCxHQUFlLFdBQVcsT0FBWCxDQUFtQixJQUFuQixDQUF3QixVQUF4QixDQUFmOztBQUVBLFNBQUssVUFBTCxHQUFrQixXQUFXLFVBQVgsQ0FBc0IsSUFBdEIsQ0FBMkIsVUFBM0IsQ0FBbEI7O0FBRUEsU0FBSyxRQUFMLEdBQWdCLFlBQVc7QUFDdkIsbUJBQVcsVUFBWDtBQUNBLG1CQUFXLE9BQVgsQ0FBbUIsYUFBYSxXQUFoQztBQUNBLGVBQU8sTUFBUDtBQUNILEtBSkQ7O0FBTUEsU0FBSyxTQUFMLEdBQWlCLGFBQWEsU0FBYixDQUF1QixJQUF2QixDQUE0QixZQUE1QixDQUFqQjs7QUFFQSxTQUFLLHFCQUFMLEdBQTZCLFVBQVMsUUFBVCxFQUFtQjtBQUM1QyxnQkFBUSxLQUFLLFFBQVEsUUFBYixFQUF1QixDQUFDLEVBQXhCLEVBQTRCLEVBQTVCLENBQVI7QUFDQSxlQUFPLFdBQVA7QUFDQTtBQUNILEtBSkQ7O0FBTUEsU0FBSyxhQUFMLEdBQXFCLFVBQVMsUUFBVCxFQUFtQjtBQUNwQyxtQkFBVyxLQUFLLFFBQUwsRUFBZSxDQUFDLEVBQWhCLEVBQW9CLEVBQXBCLENBQVg7QUFDQTtBQUNILEtBSEQ7O0FBS0EsU0FBSyxNQUFMLEdBQWMsVUFBUyxDQUFULEVBQVk7QUFDdEIsbUJBQVcsU0FBWCxDQUFxQixjQUFyQixDQUFvQyxLQUFLLENBQUwsRUFBUSxFQUFSLEVBQVksS0FBWixDQUFwQyxFQUF3RCxhQUFhLFdBQXJFO0FBQ0EsZUFBTyxNQUFQO0FBQ0gsS0FIRDs7QUFLQSxTQUFLLFdBQUwsR0FBbUIsWUFBVztBQUMxQixxQkFBYSxJQUFiLENBQWtCLE9BQWxCLEVBQTJCLENBQUUsU0FBUyxDQUFWLEdBQWUsR0FBZixHQUFxQixFQUF0QixJQUE2QixLQUE3QixHQUFzQyxLQUFqRTtBQUNILEtBRkQ7O0FBSUEsU0FBSyxFQUFMLEdBQVUsYUFBYSxFQUFiLENBQWdCLElBQWhCLENBQXFCLFlBQXJCLENBQVY7QUFDSDs7QUFFRCxTQUFTLElBQVQsQ0FBYyxLQUFkLEVBQXFCLEdBQXJCLEVBQTBCLEdBQTFCLEVBQStCO0FBQzNCLFFBQUksUUFBUSxHQUFaLEVBQWlCLE9BQU8sR0FBUDtBQUNqQixXQUFPLFFBQVEsR0FBUixHQUFjLEdBQWQsR0FBb0IsS0FBM0I7QUFDSDs7QUFFRCxTQUFTLHNCQUFULENBQWdDLGNBQWhDLEVBQWdEO0FBQzVDLFdBQU8sS0FBSyxHQUFMLENBQVMsYUFBYyxjQUF2QixDQUFQO0FBQ0g7O0FBRUQsT0FBTyxPQUFQLEdBQWlCLE1BQWpCOzs7QUNoRUE7O0FBRUEsSUFBTSxlQUFlLFFBQVEsUUFBUixDQUFyQjtBQUFBLElBQ0ksT0FBTyxRQUFRLE1BQVIsQ0FEWDtBQUFBLElBRUksYUFBYSxRQUFRLGdCQUFSLENBRmpCOztBQUlBLFNBQVMsT0FBVCxDQUFpQixRQUFqQixFQUEyQixnQkFBM0IsRUFBNkM7QUFDekMsaUJBQWEsSUFBYixDQUFrQixJQUFsQjtBQUNBLFFBQUksVUFBVSxJQUFkO0FBQ0EsU0FBSyxPQUFMLEdBQWUsS0FBZjtBQUNBLFNBQUssYUFBTCxHQUFxQixLQUFyQjtBQUNBLFNBQUssY0FBTCxHQUFzQixLQUF0QjtBQUNBLFNBQUssaUJBQUwsR0FBeUIsZ0JBQXpCOztBQUVBLGFBQVMsRUFBVCxDQUFZLFVBQVosRUFBd0IsVUFBQyxRQUFELEVBQWM7QUFBRSxnQkFBUSxJQUFSLENBQWEsWUFBYixFQUEyQixRQUEzQjtBQUFzQyxLQUE5RTtBQUNBLFlBQVEsaUJBQVIsQ0FBMEIsRUFBMUIsQ0FBNkIsU0FBN0IsRUFBd0MsU0FBUyxjQUFqRDtBQUNBLFlBQVEsaUJBQVIsQ0FBMEIsTUFBMUI7O0FBRUEsU0FBSyxLQUFMLEdBQWEsWUFBVztBQUNwQixnQkFBUSxjQUFSLEdBQXlCLElBQXpCO0FBQ0gsS0FGRDs7QUFJQSxTQUFLLE9BQUwsR0FBZSxZQUFXO0FBQ3RCLFlBQUksaUJBQWlCLFFBQVEsT0FBN0I7QUFBQSxZQUNJLGVBQWUsUUFBUSxhQUQzQjs7QUFHQSxnQkFBUSxhQUFSLEdBQXdCLEtBQXhCO0FBQ0EsZ0JBQVEsY0FBUixHQUF5QixLQUF6Qjs7QUFFQSxnQkFBUSxJQUFSO0FBQ0ksaUJBQU0sQ0FBQyxjQUFQO0FBQ0ksd0JBQVEsT0FBUixHQUFrQixJQUFsQjtBQUNBLHdCQUFRLElBQVIsQ0FBYSxJQUFiO0FBQ0E7QUFDSixpQkFBTSxrQkFBa0IsQ0FBQyxZQUF6QjtBQUNJLHdCQUFRLE9BQVIsR0FBa0IsS0FBbEI7QUFDQSx3QkFBUSxJQUFSLENBQWEsS0FBYjtBQUNBO0FBUlI7QUFVSCxLQWpCRDs7QUFtQkEsU0FBSyxRQUFMLEdBQWdCLFVBQVMsWUFBVCxFQUF1QjtBQUNuQyxZQUFJLFFBQVEsY0FBWixFQUE0QjtBQUN4QixvQkFBUSxhQUFSLEdBQXdCLElBQXhCO0FBQ0Esb0JBQVEsaUJBQVIsQ0FBMEIsY0FBMUIsQ0FBeUMsU0FBekMsRUFBb0QsU0FBUyxjQUE3RDtBQUNBLG9CQUFRLGlCQUFSLEdBQTRCLFlBQTVCO0FBQ0Esb0JBQVEsaUJBQVIsQ0FBMEIsRUFBMUIsQ0FBNkIsU0FBN0IsRUFBd0MsU0FBUyxjQUFqRDtBQUNBLG9CQUFRLGVBQVI7QUFDQSxvQkFBUSxpQkFBUixDQUEwQixNQUExQjtBQUNIO0FBQ0osS0FURDs7QUFXQSxTQUFLLEtBQUwsR0FBYSxVQUFTLFFBQVQsRUFBbUI7QUFDNUIsWUFBSSxDQUFDLFFBQVEsT0FBYixFQUFzQjtBQUNsQjtBQUNBO0FBQ0g7QUFDRCxpQkFBUyxLQUFULENBQWUsUUFBZjtBQUNILEtBTkQ7O0FBUUEsU0FBSyxJQUFMLEdBQVksU0FBUyxJQUFyQjtBQUNBLFNBQUssZUFBTCxHQUF1QixZQUFXO0FBQUUsZ0JBQVEsSUFBUixDQUFhLFVBQWIsRUFBeUIsUUFBUSxpQkFBUixDQUEwQixLQUFuRDtBQUE0RCxLQUFoRztBQUNIO0FBQ0QsS0FBSyxRQUFMLENBQWMsT0FBZCxFQUF1QixZQUF2Qjs7QUFFQSxPQUFPLE9BQVAsR0FBaUIsU0FBUyxhQUFULENBQXVCLFFBQXZCLEVBQWlDLE9BQWpDLEVBQTBDO0FBQ3ZELFFBQUksV0FBVyxXQUFXLE9BQVgsRUFBb0IsUUFBcEIsQ0FBNkIsSUFBN0IsQ0FBZixDQUR1RCxDQUNKO0FBQ25ELFdBQU8sSUFBSSxPQUFKLENBQVksUUFBWixFQUFzQixRQUF0QixDQUFQO0FBQ0gsQ0FIRDs7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCdcbmNvbnN0IFB1c2ggPSByZXF1aXJlKCdwdXNoLXdyYXBwZXInKSxcbiAgICBmb3JlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKSxcbiAgICBwYXJ0aWFsID0gcmVxdWlyZSgnbG9kYXNoLnBhcnRpYWwnKSxcbiAgICBQbGF5ZXIgPSByZXF1aXJlKCcuL3NyYy9wbGF5ZXIuanMnKSxcbiAgICBjb250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCA/IG5ldyB3aW5kb3cuQXVkaW9Db250ZXh0KCkgOiBuZXcgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCgpLFxuICAgIFJlcGV0YWUgPSByZXF1aXJlKCcuL3NyYy9yZXBldGFlLmpzJyksXG4gICAgQlBNID0gcmVxdWlyZSgnLi9zcmMvYnBtLmpzJyksXG4gICAgYnBtID0gbmV3IEJQTSgxMjApLFxuICAgIEludGVydmFsID0gcmVxdWlyZSgnLi9zcmMvaW50ZXJ2YWwuanMnKSxcbiAgICBpbnRlcnZhbHMgPSB7XG4gICAgICAgICcxLzQnOiBJbnRlcnZhbFsnNG4nXShicG0sICcxLzQnKSxcbiAgICAgICAgJzEvNHQnOiBJbnRlcnZhbFsnNG50J10oYnBtLCAnMS80dCcpLFxuICAgICAgICAnMS84JzogSW50ZXJ2YWxbJzhuJ10oYnBtLCAnMS84JyksXG4gICAgICAgICcxLzh0JzogSW50ZXJ2YWxbJzhudCddKGJwbSwgJzEvOHQnKSxcbiAgICAgICAgJzEvMTYnOiBJbnRlcnZhbFsnMTZuJ10oYnBtLCAnMS8xNicpLFxuICAgICAgICAnMS8xNnQnOiBJbnRlcnZhbFsnMTZudCddKGJwbSwgJzEvMTZ0JyksXG4gICAgICAgICcxLzMyJzogSW50ZXJ2YWxbJzMybiddKGJwbSwgJzEvMzInKSxcbiAgICAgICAgJzEvMzJ0JzogSW50ZXJ2YWxbJzMybnQnXShicG0sICcxLzMydCcpLFxuICAgIH0sXG4gICAgc2FtcGxlcyA9IFtcbiAgICAgICAgJ2Fzc2V0cy9hdWRpby9Cb251c19LaWNrMjcubXAzJyxcbiAgICAgICAgJ2Fzc2V0cy9hdWRpby9zbmFyZV90dXJuYm9vdC5tcDMnLFxuICAgICAgICAnYXNzZXRzL2F1ZGlvL0hhbmRDbGFwLm1wMycsXG4gICAgICAgICdhc3NldHMvYXVkaW8vQmVhdDA3X0hhdC5tcDMnLFxuICAgICAgICAnYXNzZXRzL2F1ZGlvL0hIX0tJVDA5XzEwMF9UTUIubXAzJyxcbiAgICAgICAgJ2Fzc2V0cy9hdWRpby9jbGluZ2ZpbG0ubXAzJyxcbiAgICAgICAgJ2Fzc2V0cy9hdWRpby90YW5nLTEubXAzJyxcbiAgICAgICAgJ2Fzc2V0cy9hdWRpby9DYXNzZXR0ZTgwOF9Ub20wMS5tcDMnXG4gICAgXSxcbiAgICBmaWx0ZXJfZnJlcXVlbmNpZXMgPSBbMCwgMTAwLCAyMDAsIDQwMCwgODAwLCAyMDAwLCA2MDAwLCAxMDAwMCwgMjAwMDBdO1xuXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsICgpID0+IHtcbiAgICBpZiAobmF2aWdhdG9yLnJlcXVlc3RNSURJQWNjZXNzKSB7XG4gICAgICAgIG5hdmlnYXRvci5yZXF1ZXN0TUlESUFjY2Vzcyh7IHN5c2V4OiB0cnVlIH0pXG4gICAgICAgICAgICAudGhlbihQdXNoLmNyZWF0ZV9ib3VuZF90b193ZWJfbWlkaV9hcGkpXG4gICAgICAgICAgICAudGhlbihvZmZfd2VfZ28pXG4gICAgfSBlbHNlIHtcbiAgICAgICAgUHJvbWlzZS5yZXNvbHZlKG5ldyBQdXNoKHsgc2VuZDogKGJ5dGVzKSA9PiB7IH0gfSkpLnRoZW4ob2ZmX3dlX2dvKS50aGVuKHNob3dfbm9fbWlkaV93YXJuaW5nKTtcbiAgICB9XG59KTtcblxuZnVuY3Rpb24gc2hvd19ub19taWRpX3dhcm5pbmcoKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJuby1taWRpLXdhcm5pbmdcIikuc3R5bGUuZGlzcGxheSA9ICcnO1xufVxuXG5mdW5jdGlvbiBvZmZfd2VfZ28oYm91bmRfcHVzaCkge1xuICAgIGNvbnN0IGJ1dHRvbnMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdwdXNoLXdyYXBwZXItYnV0dG9uJyksXG4gICAgICAgIHBsYXllcnMgPSBjcmVhdGVfcGxheWVycygpLFxuICAgICAgICBwdXNoID0gYm91bmRfcHVzaDtcblxuICAgIHB1c2gubGNkLmNsZWFyKCk7XG5cbiAgICBmb3JlYWNoKHBsYXllcnMsIChwbGF5ZXIsIGkpID0+IHtcbiAgICAgICAgdmFyIGNvbHVtbl9udW1iZXIgPSBpICsgMSxcbiAgICAgICAgICAgIGZ1bGxfcGF0aF9zYW1wbGVfbmFtZSA9IHNhbXBsZXNbaV0uc3BsaXQoJy4nKVswXSxcbiAgICAgICAgICAgIHNhbXBsZV9uYW1lID0gZnVsbF9wYXRoX3NhbXBsZV9uYW1lLnNwbGl0KCcvJykucG9wKCksXG4gICAgICAgICAgICByZXBldGFlID0gbmV3IFJlcGV0YWUoaW50ZXJ2YWxzWycxLzQnXSwgY29udGV4dCk7XG5cbiAgICAgICAgcHVzaC5ncmlkLnhbY29sdW1uX251bWJlcl0uc2VsZWN0Lm9uKCdwcmVzc2VkJywgcmVwZXRhZS5wcmVzcyk7XG4gICAgICAgIHB1c2guZ3JpZC54W2NvbHVtbl9udW1iZXJdLnNlbGVjdC5vbigncmVsZWFzZWQnLCByZXBldGFlLnJlbGVhc2UpO1xuXG4gICAgICAgIHB1c2guZ3JpZC54W2NvbHVtbl9udW1iZXJdLnNlbGVjdC5sZWRfb24oKTtcbiAgICAgICAgcmVwZXRhZS5vbignb24nLCBwYXJ0aWFsKHB1c2guZ3JpZC54W2NvbHVtbl9udW1iZXJdLnNlbGVjdC5sZWRfcmdiLCAwLCAwLCAyNTUpKTtcbiAgICAgICAgcmVwZXRhZS5vbignb2ZmJywgcHVzaC5ncmlkLnhbY29sdW1uX251bWJlcl0uc2VsZWN0LmxlZF9vbik7XG4gICAgICAgIHJlcGV0YWUub24oJ2ludGVydmFsJywgcHVzaC5sY2QueFtjb2x1bW5fbnVtYmVyXS55WzFdLnVwZGF0ZSk7XG5cbiAgICAgICAgcmVwZXRhZS5yZXBvcnRfaW50ZXJ2YWwoKTtcblxuICAgICAgICBmb3JlYWNoKGludGVydmFscywgKGludGVydmFsLCBidXR0b25fbmFtZSkgPT4ge1xuICAgICAgICAgICAgcHVzaC5idXR0b25bYnV0dG9uX25hbWVdLm9uKCdwcmVzc2VkJywgcGFydGlhbChyZXBldGFlLmludGVydmFsLCBpbnRlcnZhbCkpXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHR1cm5fb2ZmX2NvbHVtbihwdXNoLCBjb2x1bW5fbnVtYmVyKTtcbiAgICAgICAgcHVzaC5sY2QueFtjb2x1bW5fbnVtYmVyXS55WzJdLnVwZGF0ZShzYW1wbGVfbmFtZS5sZW5ndGggPiA4ID8gc2FtcGxlX25hbWUuc3Vic3RyKHNhbXBsZV9uYW1lLmxlbmd0aCAtIDgpIDogc2FtcGxlX25hbWUpO1xuICAgICAgICBwbGF5ZXIub24oJ3N0YXJ0ZWQnLCBwYXJ0aWFsKHR1cm5fYnV0dG9uX2Rpc3BsYXlfb24sIGJ1dHRvbnNbaV0pKTtcbiAgICAgICAgcGxheWVyLm9uKCdzdG9wcGVkJywgcGFydGlhbCh0dXJuX2J1dHRvbl9kaXNwbGF5X29mZiwgYnV0dG9uc1tpXSkpO1xuICAgICAgICBwbGF5ZXIub24oJ3N0YXJ0ZWQnLCBwYXJ0aWFsKHR1cm5fb25fY29sdW1uLCBwdXNoLCBjb2x1bW5fbnVtYmVyKSk7XG4gICAgICAgIHBsYXllci5vbignc3RvcHBlZCcsIHBhcnRpYWwodHVybl9vZmZfY29sdW1uLCBwdXNoLCBjb2x1bW5fbnVtYmVyKSk7XG5cbiAgICAgICAgcGxheWVyLm9uKCdwaXRjaCcsIHB1c2gubGNkLnhbY29sdW1uX251bWJlcl0ueVs0XS51cGRhdGUpO1xuICAgICAgICBwdXNoLmNoYW5uZWxbY29sdW1uX251bWJlcl0ua25vYi5vbigndHVybmVkJywgcGxheWVyLmNoYW5nZVBpdGNoQnlJbnRlcnZhbCk7XG4gICAgICAgIHBsYXllci5yZXBvcnRQaXRjaCgpO1xuXG4gICAgICAgIGJ1dHRvbnNbaV0uYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKCkgPT4geyBwbGF5ZXIuY3V0T2ZmKGZpbHRlcl9mcmVxdWVuY2llc1s4XSkucGxheShtaWRpR2FpbigxMTApKSB9KTtcbiAgICAgICAgYmluZF9jb2x1bW5fdG9fcGxheWVyKHB1c2gsIHBsYXllciwgY29sdW1uX251bWJlciwgcmVwZXRhZSk7XG4gICAgfSk7XG5cbiAgICBmb3JlYWNoKGludGVydmFscywgKGludGVydmFsLCBidXR0b25fbmFtZSkgPT4ge1xuICAgICAgICBwdXNoLmJ1dHRvbltidXR0b25fbmFtZV0ubGVkX2RpbSgpO1xuICAgIH0pO1xuXG4gICAgYmluZF9waXRjaGJlbmQocHVzaCwgcGxheWVycyk7XG5cbiAgICBiaW5kUXdlcnR5dWlUb1BsYXliYWNrKHBsYXllcnMpO1xuICAgIGJpbmRfdGVtcG9fa25vYl90b19icG0ocHVzaCwgYnBtKTtcbiAgICBicG0ucmVwb3J0KCk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZV9wbGF5ZXJzKCkge1xuICAgIHZhciBwbGF5ZXJzID0gW107XG4gICAgZm9yICh2YXIgIGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBwbGF5ZXJzW2ldID0gbmV3IFBsYXllcihzYW1wbGVzW2ldLCBjb250ZXh0KS50b01hc3RlcigpO1xuICAgIH1cbiAgICByZXR1cm4gcGxheWVycztcbn1cblxuZnVuY3Rpb24gYmluZF9jb2x1bW5fdG9fcGxheWVyKHB1c2gsIHBsYXllciwgeCwgcmVwZXRhZSkge1xuICAgIGxldCBtdXRhYmxlX3ZlbG9jaXR5ID0gMTI3LFxuICAgICAgICBtdXRhYmxlX2ZyZXF1ZW5jeSA9IGZpbHRlcl9mcmVxdWVuY2llc1s4XSxcbiAgICAgICAgcHJlc3NlZF9wYWRzX2luX2NvbCA9IDA7XG5cbiAgICBsZXQgcGxheWJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcGxheWVyLmN1dE9mZihtdXRhYmxlX2ZyZXF1ZW5jeSkucGxheShtaWRpR2FpbihtdXRhYmxlX3ZlbG9jaXR5KSk7XG4gICAgfVxuXG4gICAgZm9yZWFjaChbMSwgMiwgMywgNCwgNSwgNiwgNywgOF0sICh5KSA9PiB7XG4gICAgICAgIGNvbnN0IGdyaWRfYnV0dG9uID0gcHVzaC5ncmlkLnhbeF0ueVt5XTtcblxuICAgICAgICBncmlkX2J1dHRvbi5vbigncHJlc3NlZCcsICh2ZWxvY2l0eSkgPT4ge1xuICAgICAgICAgICAgbXV0YWJsZV92ZWxvY2l0eSA9IHZlbG9jaXR5O1xuICAgICAgICAgICAgbXV0YWJsZV9mcmVxdWVuY3kgPSBmaWx0ZXJfZnJlcXVlbmNpZXNbeV07XG4gICAgICAgICAgICBpZiAoKytwcmVzc2VkX3BhZHNfaW5fY29sID09IDEpIHJlcGV0YWUuc3RhcnQocGxheWJhY2spO1xuICAgICAgICB9KTtcbiAgICAgICAgZ3JpZF9idXR0b24ub24oJ2FmdGVydG91Y2gnLCAocHJlc3N1cmUpID0+IHsgaWYgKHByZXNzdXJlID4gMCkgbXV0YWJsZV92ZWxvY2l0eSA9IHByZXNzdXJlIH0pO1xuICAgICAgICBncmlkX2J1dHRvbi5vbigncmVsZWFzZWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoLS1wcmVzc2VkX3BhZHNfaW5fY29sID09IDApIHJlcGV0YWUuc3RvcCgpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gYmluZFF3ZXJ0eXVpVG9QbGF5YmFjayhwbGF5ZXJzKSB7XG4gICAgbGV0IGxvb2t1cCA9IHsxMTM6IDAsIDExOTogMSwgMTAxOiAyLCAxMTQ6IDMsIDExNjogNCwgMTIxOiA1LCAxMTc6IDYsIDEwNTogN307XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlwcmVzc1wiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgaWYgKGV2ZW50LmNoYXJDb2RlIGluIGxvb2t1cCkge1xuICAgICAgICAgICAgcGxheWVyc1tsb29rdXBbZXZlbnQuY2hhckNvZGVdXS5jdXRPZmYoZmlsdGVyX2ZyZXF1ZW5jaWVzWzhdKS5wbGF5KG1pZGlHYWluKDExMCkpO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIG1pZGlHYWluKHZlbG9jaXR5KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdmVsb2NpdHk6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdmVsb2NpdHkgfSxcbiAgICAgICAgdG9BYnNvbHV0ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdmVsb2NpdHkgLyAxMjc7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHR1cm5fb25fY29sdW1uKHB1c2gsIHgsIGdhaW4pIHtcbiAgICBmb3JlYWNoKFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4XSwgKHkpID0+IHtcbiAgICAgICAgaWYgKCgoZ2Fpbi52ZWxvY2l0eSgpICsgMTUpIC8gMTYpID49IHkpIHtcbiAgICAgICAgICAgIHB1c2guZ3JpZC54W3hdLnlbeV0ubGVkX29uKGdhaW4udmVsb2NpdHkoKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwdXNoLmdyaWQueFt4XS55W3ldLmxlZF9vZmYoKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiB0dXJuX29mZl9jb2x1bW4ocHVzaCwgeCkge1xuICAgIGZvcmVhY2goWzIsIDMsIDQsIDUsIDYsIDcsIDhdLCAoeSkgPT4ge1xuICAgICAgICBwdXNoLmdyaWQueFt4XS55W3ldLmxlZF9vZmYoKTtcbiAgICB9KTtcbiAgICBwdXNoLmdyaWQueFt4XS55WzFdLmxlZF9vbigpO1xufVxuXG5mdW5jdGlvbiBiaW5kX3BpdGNoYmVuZChwdXNoLCBwbGF5ZXJzKSB7XG4gICAgcHVzaC50b3VjaHN0cmlwLm9uKCdwaXRjaGJlbmQnLCAocGIpID0+IHtcbiAgICAgICAgdmFyIHJhdGUgPSBzY2FsZShwYiwgMCwgMTYzODQsIC0xMiwgMTIpO1xuICAgICAgICBmb3JlYWNoKHBsYXllcnMsIChwbGF5ZXIpID0+IHBsYXllci5tb2R1bGF0ZVBpdGNoKHJhdGUpKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gYmluZF90ZW1wb19rbm9iX3RvX2JwbShwdXNoLCBicG0pIHtcbiAgICBwdXNoLmtub2JbJ3RlbXBvJ10ub24oJ3R1cm5lZCcsIGJwbS5jaGFuZ2VfYnkpO1xuICAgIGJwbS5vbignY2hhbmdlZCcsIGJwbSA9PiBwdXNoLmxjZC54WzFdLnlbM10udXBkYXRlKCdicG09ICcgKyBicG0uY3VycmVudCkpO1xufVxuXG5mdW5jdGlvbiB0dXJuX2J1dHRvbl9kaXNwbGF5X29uKHVpX2J0bikge1xuICAgIHVpX2J0bi5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKTtcbn1cblxuZnVuY3Rpb24gdHVybl9idXR0b25fZGlzcGxheV9vZmYodWlfYnRuKSB7XG4gICAgdWlfYnRuLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xufVxuXG5mdW5jdGlvbiBzY2FsZShpbnB1dCwgbWluSW4sIG1heEluLCBtaW5PdXQsIG1heE91dCkge1xuICAgIHJldHVybiAoKG1heE91dCAtIG1pbk91dCkgKiAoKGlucHV0IC0gbWluSW4pIC8gKG1heEluIC0gbWluSW4pKSkgKyBtaW5PdXQ7XG59IiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjAgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjcuMCA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqXG4gKiBBIHNwZWNpYWxpemVkIHZlcnNpb24gb2YgYF8uZm9yRWFjaGAgZm9yIGFycmF5cyB3aXRob3V0IHN1cHBvcnQgZm9yIGNhbGxiYWNrXG4gKiBzaG9ydGhhbmRzIG9yIGB0aGlzYCBiaW5kaW5nLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gaXRlcmF0ZSBvdmVyLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gaXRlcmF0ZWUgVGhlIGZ1bmN0aW9uIGludm9rZWQgcGVyIGl0ZXJhdGlvbi5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBgYXJyYXlgLlxuICovXG5mdW5jdGlvbiBhcnJheUVhY2goYXJyYXksIGl0ZXJhdGVlKSB7XG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgaWYgKGl0ZXJhdGVlKGFycmF5W2luZGV4XSwgaW5kZXgsIGFycmF5KSA9PT0gZmFsc2UpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYXJyYXk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYXJyYXlFYWNoO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjQgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbnZhciBrZXlzID0gcmVxdWlyZSgnbG9kYXNoLmtleXMnKTtcblxuLyoqXG4gKiBVc2VkIGFzIHRoZSBbbWF4aW11bSBsZW5ndGhdKGh0dHBzOi8vcGVvcGxlLm1vemlsbGEub3JnL35qb3JlbmRvcmZmL2VzNi1kcmFmdC5odG1sI3NlYy1udW1iZXIubWF4X3NhZmVfaW50ZWdlcilcbiAqIG9mIGFuIGFycmF5LWxpa2UgdmFsdWUuXG4gKi9cbnZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5mb3JFYWNoYCB3aXRob3V0IHN1cHBvcnQgZm9yIGNhbGxiYWNrXG4gKiBzaG9ydGhhbmRzIGFuZCBgdGhpc2AgYmluZGluZy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGl0ZXJhdGVlIFRoZSBmdW5jdGlvbiBpbnZva2VkIHBlciBpdGVyYXRpb24uXG4gKiBAcmV0dXJucyB7QXJyYXl8T2JqZWN0fHN0cmluZ30gUmV0dXJucyBgY29sbGVjdGlvbmAuXG4gKi9cbnZhciBiYXNlRWFjaCA9IGNyZWF0ZUJhc2VFYWNoKGJhc2VGb3JPd24pO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBiYXNlRm9ySW5gIGFuZCBgYmFzZUZvck93bmAgd2hpY2ggaXRlcmF0ZXNcbiAqIG92ZXIgYG9iamVjdGAgcHJvcGVydGllcyByZXR1cm5lZCBieSBga2V5c0Z1bmNgIGludm9raW5nIGBpdGVyYXRlZWAgZm9yXG4gKiBlYWNoIHByb3BlcnR5LiBJdGVyYXRlZSBmdW5jdGlvbnMgbWF5IGV4aXQgaXRlcmF0aW9uIGVhcmx5IGJ5IGV4cGxpY2l0bHlcbiAqIHJldHVybmluZyBgZmFsc2VgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaXRlcmF0ZSBvdmVyLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gaXRlcmF0ZWUgVGhlIGZ1bmN0aW9uIGludm9rZWQgcGVyIGl0ZXJhdGlvbi5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGtleXNGdW5jIFRoZSBmdW5jdGlvbiB0byBnZXQgdGhlIGtleXMgb2YgYG9iamVjdGAuXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICovXG52YXIgYmFzZUZvciA9IGNyZWF0ZUJhc2VGb3IoKTtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5mb3JPd25gIHdpdGhvdXQgc3VwcG9ydCBmb3IgY2FsbGJhY2tcbiAqIHNob3J0aGFuZHMgYW5kIGB0aGlzYCBiaW5kaW5nLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaXRlcmF0ZSBvdmVyLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gaXRlcmF0ZWUgVGhlIGZ1bmN0aW9uIGludm9rZWQgcGVyIGl0ZXJhdGlvbi5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gKi9cbmZ1bmN0aW9uIGJhc2VGb3JPd24ob2JqZWN0LCBpdGVyYXRlZSkge1xuICByZXR1cm4gYmFzZUZvcihvYmplY3QsIGl0ZXJhdGVlLCBrZXlzKTtcbn1cblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5wcm9wZXJ0eWAgd2l0aG91dCBzdXBwb3J0IGZvciBkZWVwIHBhdGhzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHByb3BlcnR5IHRvIGdldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBiYXNlUHJvcGVydHkoa2V5KSB7XG4gIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYGJhc2VFYWNoYCBvciBgYmFzZUVhY2hSaWdodGAgZnVuY3Rpb24uXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGVhY2hGdW5jIFRoZSBmdW5jdGlvbiB0byBpdGVyYXRlIG92ZXIgYSBjb2xsZWN0aW9uLlxuICogQHBhcmFtIHtib29sZWFufSBbZnJvbVJpZ2h0XSBTcGVjaWZ5IGl0ZXJhdGluZyBmcm9tIHJpZ2h0IHRvIGxlZnQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBiYXNlIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVCYXNlRWFjaChlYWNoRnVuYywgZnJvbVJpZ2h0KSB7XG4gIHJldHVybiBmdW5jdGlvbihjb2xsZWN0aW9uLCBpdGVyYXRlZSkge1xuICAgIHZhciBsZW5ndGggPSBjb2xsZWN0aW9uID8gZ2V0TGVuZ3RoKGNvbGxlY3Rpb24pIDogMDtcbiAgICBpZiAoIWlzTGVuZ3RoKGxlbmd0aCkpIHtcbiAgICAgIHJldHVybiBlYWNoRnVuYyhjb2xsZWN0aW9uLCBpdGVyYXRlZSk7XG4gICAgfVxuICAgIHZhciBpbmRleCA9IGZyb21SaWdodCA/IGxlbmd0aCA6IC0xLFxuICAgICAgICBpdGVyYWJsZSA9IHRvT2JqZWN0KGNvbGxlY3Rpb24pO1xuXG4gICAgd2hpbGUgKChmcm9tUmlnaHQgPyBpbmRleC0tIDogKytpbmRleCA8IGxlbmd0aCkpIHtcbiAgICAgIGlmIChpdGVyYXRlZShpdGVyYWJsZVtpbmRleF0sIGluZGV4LCBpdGVyYWJsZSkgPT09IGZhbHNlKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY29sbGVjdGlvbjtcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYmFzZSBmdW5jdGlvbiBmb3IgYF8uZm9ySW5gIG9yIGBfLmZvckluUmlnaHRgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtmcm9tUmlnaHRdIFNwZWNpZnkgaXRlcmF0aW5nIGZyb20gcmlnaHQgdG8gbGVmdC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGJhc2UgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUJhc2VGb3IoZnJvbVJpZ2h0KSB7XG4gIHJldHVybiBmdW5jdGlvbihvYmplY3QsIGl0ZXJhdGVlLCBrZXlzRnVuYykge1xuICAgIHZhciBpdGVyYWJsZSA9IHRvT2JqZWN0KG9iamVjdCksXG4gICAgICAgIHByb3BzID0ga2V5c0Z1bmMob2JqZWN0KSxcbiAgICAgICAgbGVuZ3RoID0gcHJvcHMubGVuZ3RoLFxuICAgICAgICBpbmRleCA9IGZyb21SaWdodCA/IGxlbmd0aCA6IC0xO1xuXG4gICAgd2hpbGUgKChmcm9tUmlnaHQgPyBpbmRleC0tIDogKytpbmRleCA8IGxlbmd0aCkpIHtcbiAgICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XG4gICAgICBpZiAoaXRlcmF0ZWUoaXRlcmFibGVba2V5XSwga2V5LCBpdGVyYWJsZSkgPT09IGZhbHNlKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0O1xuICB9O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIFwibGVuZ3RoXCIgcHJvcGVydHkgdmFsdWUgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCB0byBhdm9pZCBhIFtKSVQgYnVnXShodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTQyNzkyKVxuICogdGhhdCBhZmZlY3RzIFNhZmFyaSBvbiBhdCBsZWFzdCBpT1MgOC4xLTguMyBBUk02NC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIFwibGVuZ3RoXCIgdmFsdWUuXG4gKi9cbnZhciBnZXRMZW5ndGggPSBiYXNlUHJvcGVydHkoJ2xlbmd0aCcpO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgYmFzZWQgb24gW2BUb0xlbmd0aGBdKGh0dHBzOi8vcGVvcGxlLm1vemlsbGEub3JnL35qb3JlbmRvcmZmL2VzNi1kcmFmdC5odG1sI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDw9IE1BWF9TQUZFX0lOVEVHRVI7XG59XG5cbi8qKlxuICogQ29udmVydHMgYHZhbHVlYCB0byBhbiBvYmplY3QgaWYgaXQncyBub3Qgb25lLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBwcm9jZXNzLlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgb2JqZWN0LlxuICovXG5mdW5jdGlvbiB0b09iamVjdCh2YWx1ZSkge1xuICByZXR1cm4gaXNPYmplY3QodmFsdWUpID8gdmFsdWUgOiBPYmplY3QodmFsdWUpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KDEpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgLy8gQXZvaWQgYSBWOCBKSVQgYnVnIGluIENocm9tZSAxOS0yMC5cbiAgLy8gU2VlIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0yMjkxIGZvciBtb3JlIGRldGFpbHMuXG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJhc2VFYWNoO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjEgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqXG4gKiBBIHNwZWNpYWxpemVkIHZlcnNpb24gb2YgYGJhc2VDYWxsYmFja2Agd2hpY2ggb25seSBzdXBwb3J0cyBgdGhpc2AgYmluZGluZ1xuICogYW5kIHNwZWNpZnlpbmcgdGhlIG51bWJlciBvZiBhcmd1bWVudHMgdG8gcHJvdmlkZSB0byBgZnVuY2AuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGJpbmQuXG4gKiBAcGFyYW0geyp9IHRoaXNBcmcgVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbYXJnQ291bnRdIFRoZSBudW1iZXIgb2YgYXJndW1lbnRzIHRvIHByb3ZpZGUgdG8gYGZ1bmNgLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBjYWxsYmFjay5cbiAqL1xuZnVuY3Rpb24gYmluZENhbGxiYWNrKGZ1bmMsIHRoaXNBcmcsIGFyZ0NvdW50KSB7XG4gIGlmICh0eXBlb2YgZnVuYyAhPSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGlkZW50aXR5O1xuICB9XG4gIGlmICh0aGlzQXJnID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gZnVuYztcbiAgfVxuICBzd2l0Y2ggKGFyZ0NvdW50KSB7XG4gICAgY2FzZSAxOiByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgdmFsdWUpO1xuICAgIH07XG4gICAgY2FzZSAzOiByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgfTtcbiAgICBjYXNlIDQ6IHJldHVybiBmdW5jdGlvbihhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgIH07XG4gICAgY2FzZSA1OiByZXR1cm4gZnVuY3Rpb24odmFsdWUsIG90aGVyLCBrZXksIG9iamVjdCwgc291cmNlKSB7XG4gICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIHZhbHVlLCBvdGhlciwga2V5LCBvYmplY3QsIHNvdXJjZSk7XG4gICAgfTtcbiAgfVxuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpc0FyZywgYXJndW1lbnRzKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBUaGlzIG1ldGhvZCByZXR1cm5zIHRoZSBmaXJzdCBhcmd1bWVudCBwcm92aWRlZCB0byBpdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IFV0aWxpdHlcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgQW55IHZhbHVlLlxuICogQHJldHVybnMgeyp9IFJldHVybnMgYHZhbHVlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogdmFyIG9iamVjdCA9IHsgJ3VzZXInOiAnZnJlZCcgfTtcbiAqXG4gKiBfLmlkZW50aXR5KG9iamVjdCkgPT09IG9iamVjdDtcbiAqIC8vID0+IHRydWVcbiAqL1xuZnVuY3Rpb24gaWRlbnRpdHkodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJpbmRDYWxsYmFjaztcbiIsIi8qKlxuICogbG9kYXNoIDMuMi4wIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE2IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTYgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbnZhciByb290ID0gcmVxdWlyZSgnbG9kYXNoLl9yb290Jyk7XG5cbi8qKiBVc2VkIHRvIGNvbXBvc2UgYml0bWFza3MgZm9yIHdyYXBwZXIgbWV0YWRhdGEuICovXG52YXIgQklORF9GTEFHID0gMSxcbiAgICBCSU5EX0tFWV9GTEFHID0gMixcbiAgICBDVVJSWV9CT1VORF9GTEFHID0gNCxcbiAgICBDVVJSWV9GTEFHID0gOCxcbiAgICBDVVJSWV9SSUdIVF9GTEFHID0gMTYsXG4gICAgUEFSVElBTF9GTEFHID0gMzIsXG4gICAgUEFSVElBTF9SSUdIVF9GTEFHID0gNjQsXG4gICAgQVJZX0ZMQUcgPSAxMjgsXG4gICAgRkxJUF9GTEFHID0gNTEyO1xuXG4vKiogVXNlZCBhcyB0aGUgYFR5cGVFcnJvcmAgbWVzc2FnZSBmb3IgXCJGdW5jdGlvbnNcIiBtZXRob2RzLiAqL1xudmFyIEZVTkNfRVJST1JfVEVYVCA9ICdFeHBlY3RlZCBhIGZ1bmN0aW9uJztcblxuLyoqIFVzZWQgYXMgcmVmZXJlbmNlcyBmb3IgdmFyaW91cyBgTnVtYmVyYCBjb25zdGFudHMuICovXG52YXIgSU5GSU5JVFkgPSAxIC8gMCxcbiAgICBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MSxcbiAgICBNQVhfSU5URUdFUiA9IDEuNzk3NjkzMTM0ODYyMzE1N2UrMzA4LFxuICAgIE5BTiA9IDAgLyAwO1xuXG4vKiogVXNlZCBhcyB0aGUgaW50ZXJuYWwgYXJndW1lbnQgcGxhY2Vob2xkZXIuICovXG52YXIgUExBQ0VIT0xERVIgPSAnX19sb2Rhc2hfcGxhY2Vob2xkZXJfXyc7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJyxcbiAgICBnZW5UYWcgPSAnW29iamVjdCBHZW5lcmF0b3JGdW5jdGlvbl0nO1xuXG4vKiogVXNlZCB0byBtYXRjaCBsZWFkaW5nIGFuZCB0cmFpbGluZyB3aGl0ZXNwYWNlLiAqL1xudmFyIHJlVHJpbSA9IC9eXFxzK3xcXHMrJC9nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgYmFkIHNpZ25lZCBoZXhhZGVjaW1hbCBzdHJpbmcgdmFsdWVzLiAqL1xudmFyIHJlSXNCYWRIZXggPSAvXlstK10weFswLTlhLWZdKyQvaTtcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGJpbmFyeSBzdHJpbmcgdmFsdWVzLiAqL1xudmFyIHJlSXNCaW5hcnkgPSAvXjBiWzAxXSskL2k7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBvY3RhbCBzdHJpbmcgdmFsdWVzLiAqL1xudmFyIHJlSXNPY3RhbCA9IC9eMG9bMC03XSskL2k7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCB1bnNpZ25lZCBpbnRlZ2VyIHZhbHVlcy4gKi9cbnZhciByZUlzVWludCA9IC9eKD86MHxbMS05XVxcZCopJC87XG5cbi8qKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyB3aXRob3V0IGEgZGVwZW5kZW5jeSBvbiBgcm9vdGAuICovXG52YXIgZnJlZVBhcnNlSW50ID0gcGFyc2VJbnQ7XG5cbi8qKlxuICogQSBmYXN0ZXIgYWx0ZXJuYXRpdmUgdG8gYEZ1bmN0aW9uI2FwcGx5YCwgdGhpcyBmdW5jdGlvbiBpbnZva2VzIGBmdW5jYFxuICogd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgYHRoaXNBcmdgIGFuZCB0aGUgYXJndW1lbnRzIG9mIGBhcmdzYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gaW52b2tlLlxuICogQHBhcmFtIHsqfSB0aGlzQXJnIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXG4gKiBAcGFyYW0gey4uLip9IGFyZ3MgVGhlIGFyZ3VtZW50cyB0byBpbnZva2UgYGZ1bmNgIHdpdGguXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgcmVzdWx0IG9mIGBmdW5jYC5cbiAqL1xuZnVuY3Rpb24gYXBwbHkoZnVuYywgdGhpc0FyZywgYXJncykge1xuICB2YXIgbGVuZ3RoID0gYXJncy5sZW5ndGg7XG4gIHN3aXRjaCAobGVuZ3RoKSB7XG4gICAgY2FzZSAwOiByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcpO1xuICAgIGNhc2UgMTogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCBhcmdzWzBdKTtcbiAgICBjYXNlIDI6IHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgYXJnc1swXSwgYXJnc1sxXSk7XG4gICAgY2FzZSAzOiByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0pO1xuICB9XG4gIHJldHVybiBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3MpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBpbmRleC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcGFyYW0ge251bWJlcn0gW2xlbmd0aD1NQVhfU0FGRV9JTlRFR0VSXSBUaGUgdXBwZXIgYm91bmRzIG9mIGEgdmFsaWQgaW5kZXguXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGluZGV4LCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzSW5kZXgodmFsdWUsIGxlbmd0aCkge1xuICB2YWx1ZSA9ICh0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgfHwgcmVJc1VpbnQudGVzdCh2YWx1ZSkpID8gK3ZhbHVlIDogLTE7XG4gIGxlbmd0aCA9IGxlbmd0aCA9PSBudWxsID8gTUFYX1NBRkVfSU5URUdFUiA6IGxlbmd0aDtcbiAgcmV0dXJuIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPCBsZW5ndGg7XG59XG5cbi8qKlxuICogUmVwbGFjZXMgYWxsIGBwbGFjZWhvbGRlcmAgZWxlbWVudHMgaW4gYGFycmF5YCB3aXRoIGFuIGludGVybmFsIHBsYWNlaG9sZGVyXG4gKiBhbmQgcmV0dXJucyBhbiBhcnJheSBvZiB0aGVpciBpbmRleGVzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gbW9kaWZ5LlxuICogQHBhcmFtIHsqfSBwbGFjZWhvbGRlciBUaGUgcGxhY2Vob2xkZXIgdG8gcmVwbGFjZS5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgbmV3IGFycmF5IG9mIHBsYWNlaG9sZGVyIGluZGV4ZXMuXG4gKi9cbmZ1bmN0aW9uIHJlcGxhY2VIb2xkZXJzKGFycmF5LCBwbGFjZWhvbGRlcikge1xuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCxcbiAgICAgIHJlc0luZGV4ID0gLTEsXG4gICAgICByZXN1bHQgPSBbXTtcblxuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIGlmIChhcnJheVtpbmRleF0gPT09IHBsYWNlaG9sZGVyKSB7XG4gICAgICBhcnJheVtpbmRleF0gPSBQTEFDRUhPTERFUjtcbiAgICAgIHJlc3VsdFsrK3Jlc0luZGV4XSA9IGluZGV4O1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmplY3RUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyBmb3IgdGhvc2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGFzIG90aGVyIGBsb2Rhc2hgIG1ldGhvZHMuICovXG52YXIgbmF0aXZlTWF4ID0gTWF0aC5tYXgsXG4gICAgbmF0aXZlTWluID0gTWF0aC5taW47XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8uY3JlYXRlYCB3aXRob3V0IHN1cHBvcnQgZm9yIGFzc2lnbmluZ1xuICogcHJvcGVydGllcyB0byB0aGUgY3JlYXRlZCBvYmplY3QuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm90b3R5cGUgVGhlIG9iamVjdCB0byBpbmhlcml0IGZyb20uXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBuZXcgb2JqZWN0LlxuICovXG52YXIgYmFzZUNyZWF0ZSA9IChmdW5jdGlvbigpIHtcbiAgZnVuY3Rpb24gb2JqZWN0KCkge31cbiAgcmV0dXJuIGZ1bmN0aW9uKHByb3RvdHlwZSkge1xuICAgIGlmIChpc09iamVjdChwcm90b3R5cGUpKSB7XG4gICAgICBvYmplY3QucHJvdG90eXBlID0gcHJvdG90eXBlO1xuICAgICAgdmFyIHJlc3VsdCA9IG5ldyBvYmplY3Q7XG4gICAgICBvYmplY3QucHJvdG90eXBlID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0IHx8IHt9O1xuICB9O1xufSgpKTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IHRoYXQgaXMgdGhlIGNvbXBvc2l0aW9uIG9mIHBhcnRpYWxseSBhcHBsaWVkIGFyZ3VtZW50cyxcbiAqIHBsYWNlaG9sZGVycywgYW5kIHByb3ZpZGVkIGFyZ3VtZW50cyBpbnRvIGEgc2luZ2xlIGFycmF5IG9mIGFyZ3VtZW50cy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGFyZ3MgVGhlIHByb3ZpZGVkIGFyZ3VtZW50cy5cbiAqIEBwYXJhbSB7QXJyYXl9IHBhcnRpYWxzIFRoZSBhcmd1bWVudHMgdG8gcHJlcGVuZCB0byB0aG9zZSBwcm92aWRlZC5cbiAqIEBwYXJhbSB7QXJyYXl9IGhvbGRlcnMgVGhlIGBwYXJ0aWFsc2AgcGxhY2Vob2xkZXIgaW5kZXhlcy5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgbmV3IGFycmF5IG9mIGNvbXBvc2VkIGFyZ3VtZW50cy5cbiAqL1xuZnVuY3Rpb24gY29tcG9zZUFyZ3MoYXJncywgcGFydGlhbHMsIGhvbGRlcnMpIHtcbiAgdmFyIGhvbGRlcnNMZW5ndGggPSBob2xkZXJzLmxlbmd0aCxcbiAgICAgIGFyZ3NJbmRleCA9IC0xLFxuICAgICAgYXJnc0xlbmd0aCA9IG5hdGl2ZU1heChhcmdzLmxlbmd0aCAtIGhvbGRlcnNMZW5ndGgsIDApLFxuICAgICAgbGVmdEluZGV4ID0gLTEsXG4gICAgICBsZWZ0TGVuZ3RoID0gcGFydGlhbHMubGVuZ3RoLFxuICAgICAgcmVzdWx0ID0gQXJyYXkobGVmdExlbmd0aCArIGFyZ3NMZW5ndGgpO1xuXG4gIHdoaWxlICgrK2xlZnRJbmRleCA8IGxlZnRMZW5ndGgpIHtcbiAgICByZXN1bHRbbGVmdEluZGV4XSA9IHBhcnRpYWxzW2xlZnRJbmRleF07XG4gIH1cbiAgd2hpbGUgKCsrYXJnc0luZGV4IDwgaG9sZGVyc0xlbmd0aCkge1xuICAgIHJlc3VsdFtob2xkZXJzW2FyZ3NJbmRleF1dID0gYXJnc1thcmdzSW5kZXhdO1xuICB9XG4gIHdoaWxlIChhcmdzTGVuZ3RoLS0pIHtcbiAgICByZXN1bHRbbGVmdEluZGV4KytdID0gYXJnc1thcmdzSW5kZXgrK107XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIGxpa2UgYGNvbXBvc2VBcmdzYCBleGNlcHQgdGhhdCB0aGUgYXJndW1lbnRzIGNvbXBvc2l0aW9uXG4gKiBpcyB0YWlsb3JlZCBmb3IgYF8ucGFydGlhbFJpZ2h0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGFyZ3MgVGhlIHByb3ZpZGVkIGFyZ3VtZW50cy5cbiAqIEBwYXJhbSB7QXJyYXl9IHBhcnRpYWxzIFRoZSBhcmd1bWVudHMgdG8gYXBwZW5kIHRvIHRob3NlIHByb3ZpZGVkLlxuICogQHBhcmFtIHtBcnJheX0gaG9sZGVycyBUaGUgYHBhcnRpYWxzYCBwbGFjZWhvbGRlciBpbmRleGVzLlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBuZXcgYXJyYXkgb2YgY29tcG9zZWQgYXJndW1lbnRzLlxuICovXG5mdW5jdGlvbiBjb21wb3NlQXJnc1JpZ2h0KGFyZ3MsIHBhcnRpYWxzLCBob2xkZXJzKSB7XG4gIHZhciBob2xkZXJzSW5kZXggPSAtMSxcbiAgICAgIGhvbGRlcnNMZW5ndGggPSBob2xkZXJzLmxlbmd0aCxcbiAgICAgIGFyZ3NJbmRleCA9IC0xLFxuICAgICAgYXJnc0xlbmd0aCA9IG5hdGl2ZU1heChhcmdzLmxlbmd0aCAtIGhvbGRlcnNMZW5ndGgsIDApLFxuICAgICAgcmlnaHRJbmRleCA9IC0xLFxuICAgICAgcmlnaHRMZW5ndGggPSBwYXJ0aWFscy5sZW5ndGgsXG4gICAgICByZXN1bHQgPSBBcnJheShhcmdzTGVuZ3RoICsgcmlnaHRMZW5ndGgpO1xuXG4gIHdoaWxlICgrK2FyZ3NJbmRleCA8IGFyZ3NMZW5ndGgpIHtcbiAgICByZXN1bHRbYXJnc0luZGV4XSA9IGFyZ3NbYXJnc0luZGV4XTtcbiAgfVxuICB2YXIgb2Zmc2V0ID0gYXJnc0luZGV4O1xuICB3aGlsZSAoKytyaWdodEluZGV4IDwgcmlnaHRMZW5ndGgpIHtcbiAgICByZXN1bHRbb2Zmc2V0ICsgcmlnaHRJbmRleF0gPSBwYXJ0aWFsc1tyaWdodEluZGV4XTtcbiAgfVxuICB3aGlsZSAoKytob2xkZXJzSW5kZXggPCBob2xkZXJzTGVuZ3RoKSB7XG4gICAgcmVzdWx0W29mZnNldCArIGhvbGRlcnNbaG9sZGVyc0luZGV4XV0gPSBhcmdzW2FyZ3NJbmRleCsrXTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIENvcGllcyB0aGUgdmFsdWVzIG9mIGBzb3VyY2VgIHRvIGBhcnJheWAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXl9IHNvdXJjZSBUaGUgYXJyYXkgdG8gY29weSB2YWx1ZXMgZnJvbS5cbiAqIEBwYXJhbSB7QXJyYXl9IFthcnJheT1bXV0gVGhlIGFycmF5IHRvIGNvcHkgdmFsdWVzIHRvLlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGBhcnJheWAuXG4gKi9cbmZ1bmN0aW9uIGNvcHlBcnJheShzb3VyY2UsIGFycmF5KSB7XG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgbGVuZ3RoID0gc291cmNlLmxlbmd0aDtcblxuICBhcnJheSB8fCAoYXJyYXkgPSBBcnJheShsZW5ndGgpKTtcbiAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICBhcnJheVtpbmRleF0gPSBzb3VyY2VbaW5kZXhdO1xuICB9XG4gIHJldHVybiBhcnJheTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCB3cmFwcyBgZnVuY2AgdG8gaW52b2tlIGl0IHdpdGggdGhlIG9wdGlvbmFsIGB0aGlzYFxuICogYmluZGluZyBvZiBgdGhpc0FyZ2AuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHdyYXAuXG4gKiBAcGFyYW0ge251bWJlcn0gYml0bWFzayBUaGUgYml0bWFzayBvZiB3cmFwcGVyIGZsYWdzLiBTZWUgYGNyZWF0ZVdyYXBwZXJgIGZvciBtb3JlIGRldGFpbHMuXG4gKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgd3JhcHBlZCBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQmFzZVdyYXBwZXIoZnVuYywgYml0bWFzaywgdGhpc0FyZykge1xuICB2YXIgaXNCaW5kID0gYml0bWFzayAmIEJJTkRfRkxBRyxcbiAgICAgIEN0b3IgPSBjcmVhdGVDdG9yV3JhcHBlcihmdW5jKTtcblxuICBmdW5jdGlvbiB3cmFwcGVyKCkge1xuICAgIHZhciBmbiA9ICh0aGlzICYmIHRoaXMgIT09IHJvb3QgJiYgdGhpcyBpbnN0YW5jZW9mIHdyYXBwZXIpID8gQ3RvciA6IGZ1bmM7XG4gICAgcmV0dXJuIGZuLmFwcGx5KGlzQmluZCA/IHRoaXNBcmcgOiB0aGlzLCBhcmd1bWVudHMpO1xuICB9XG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IHByb2R1Y2VzIGFuIGluc3RhbmNlIG9mIGBDdG9yYCByZWdhcmRsZXNzIG9mXG4gKiB3aGV0aGVyIGl0IHdhcyBpbnZva2VkIGFzIHBhcnQgb2YgYSBgbmV3YCBleHByZXNzaW9uIG9yIGJ5IGBjYWxsYCBvciBgYXBwbHlgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBDdG9yIFRoZSBjb25zdHJ1Y3RvciB0byB3cmFwLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgd3JhcHBlZCBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ3RvcldyYXBwZXIoQ3Rvcikge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgLy8gVXNlIGEgYHN3aXRjaGAgc3RhdGVtZW50IHRvIHdvcmsgd2l0aCBjbGFzcyBjb25zdHJ1Y3RvcnMuXG4gICAgLy8gU2VlIGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLWVjbWFzY3JpcHQtZnVuY3Rpb24tb2JqZWN0cy1jYWxsLXRoaXNhcmd1bWVudC1hcmd1bWVudHNsaXN0XG4gICAgLy8gZm9yIG1vcmUgZGV0YWlscy5cbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBjYXNlIDA6IHJldHVybiBuZXcgQ3RvcjtcbiAgICAgIGNhc2UgMTogcmV0dXJuIG5ldyBDdG9yKGFyZ3NbMF0pO1xuICAgICAgY2FzZSAyOiByZXR1cm4gbmV3IEN0b3IoYXJnc1swXSwgYXJnc1sxXSk7XG4gICAgICBjYXNlIDM6IHJldHVybiBuZXcgQ3RvcihhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdKTtcbiAgICAgIGNhc2UgNDogcmV0dXJuIG5ldyBDdG9yKGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0sIGFyZ3NbM10pO1xuICAgICAgY2FzZSA1OiByZXR1cm4gbmV3IEN0b3IoYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSwgYXJnc1szXSwgYXJnc1s0XSk7XG4gICAgICBjYXNlIDY6IHJldHVybiBuZXcgQ3RvcihhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdLCBhcmdzWzNdLCBhcmdzWzRdLCBhcmdzWzVdKTtcbiAgICAgIGNhc2UgNzogcmV0dXJuIG5ldyBDdG9yKGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0sIGFyZ3NbM10sIGFyZ3NbNF0sIGFyZ3NbNV0sIGFyZ3NbNl0pO1xuICAgIH1cbiAgICB2YXIgdGhpc0JpbmRpbmcgPSBiYXNlQ3JlYXRlKEN0b3IucHJvdG90eXBlKSxcbiAgICAgICAgcmVzdWx0ID0gQ3Rvci5hcHBseSh0aGlzQmluZGluZywgYXJncyk7XG5cbiAgICAvLyBNaW1pYyB0aGUgY29uc3RydWN0b3IncyBgcmV0dXJuYCBiZWhhdmlvci5cbiAgICAvLyBTZWUgaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4MTMuMi4yIGZvciBtb3JlIGRldGFpbHMuXG4gICAgcmV0dXJuIGlzT2JqZWN0KHJlc3VsdCkgPyByZXN1bHQgOiB0aGlzQmluZGluZztcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCB3cmFwcyBgZnVuY2AgdG8gZW5hYmxlIGN1cnJ5aW5nLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byB3cmFwLlxuICogQHBhcmFtIHtudW1iZXJ9IGJpdG1hc2sgVGhlIGJpdG1hc2sgb2Ygd3JhcHBlciBmbGFncy4gU2VlIGBjcmVhdGVXcmFwcGVyYCBmb3IgbW9yZSBkZXRhaWxzLlxuICogQHBhcmFtIHtudW1iZXJ9IGFyaXR5IFRoZSBhcml0eSBvZiBgZnVuY2AuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyB3cmFwcGVkIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVDdXJyeVdyYXBwZXIoZnVuYywgYml0bWFzaywgYXJpdHkpIHtcbiAgdmFyIEN0b3IgPSBjcmVhdGVDdG9yV3JhcHBlcihmdW5jKTtcblxuICBmdW5jdGlvbiB3cmFwcGVyKCkge1xuICAgIHZhciBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuICAgICAgICBpbmRleCA9IGxlbmd0aCxcbiAgICAgICAgYXJncyA9IEFycmF5KGxlbmd0aCksXG4gICAgICAgIGZuID0gKHRoaXMgJiYgdGhpcyAhPT0gcm9vdCAmJiB0aGlzIGluc3RhbmNlb2Ygd3JhcHBlcikgPyBDdG9yIDogZnVuYyxcbiAgICAgICAgcGxhY2Vob2xkZXIgPSB3cmFwcGVyLnBsYWNlaG9sZGVyO1xuXG4gICAgd2hpbGUgKGluZGV4LS0pIHtcbiAgICAgIGFyZ3NbaW5kZXhdID0gYXJndW1lbnRzW2luZGV4XTtcbiAgICB9XG4gICAgdmFyIGhvbGRlcnMgPSAobGVuZ3RoIDwgMyAmJiBhcmdzWzBdICE9PSBwbGFjZWhvbGRlciAmJiBhcmdzW2xlbmd0aCAtIDFdICE9PSBwbGFjZWhvbGRlcilcbiAgICAgID8gW11cbiAgICAgIDogcmVwbGFjZUhvbGRlcnMoYXJncywgcGxhY2Vob2xkZXIpO1xuXG4gICAgbGVuZ3RoIC09IGhvbGRlcnMubGVuZ3RoO1xuICAgIHJldHVybiBsZW5ndGggPCBhcml0eVxuICAgICAgPyBjcmVhdGVSZWN1cnJ5V3JhcHBlcihmdW5jLCBiaXRtYXNrLCBjcmVhdGVIeWJyaWRXcmFwcGVyLCBwbGFjZWhvbGRlciwgdW5kZWZpbmVkLCBhcmdzLCBob2xkZXJzLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgYXJpdHkgLSBsZW5ndGgpXG4gICAgICA6IGFwcGx5KGZuLCB0aGlzLCBhcmdzKTtcbiAgfVxuICByZXR1cm4gd3JhcHBlcjtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCB3cmFwcyBgZnVuY2AgdG8gaW52b2tlIGl0IHdpdGggb3B0aW9uYWwgYHRoaXNgXG4gKiBiaW5kaW5nIG9mIGB0aGlzQXJnYCwgcGFydGlhbCBhcHBsaWNhdGlvbiwgYW5kIGN1cnJ5aW5nLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufHN0cmluZ30gZnVuYyBUaGUgZnVuY3Rpb24gb3IgbWV0aG9kIG5hbWUgdG8gd3JhcC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBiaXRtYXNrIFRoZSBiaXRtYXNrIG9mIHdyYXBwZXIgZmxhZ3MuIFNlZSBgY3JlYXRlV3JhcHBlcmAgZm9yIG1vcmUgZGV0YWlscy5cbiAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXG4gKiBAcGFyYW0ge0FycmF5fSBbcGFydGlhbHNdIFRoZSBhcmd1bWVudHMgdG8gcHJlcGVuZCB0byB0aG9zZSBwcm92aWRlZCB0byB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQHBhcmFtIHtBcnJheX0gW2hvbGRlcnNdIFRoZSBgcGFydGlhbHNgIHBsYWNlaG9sZGVyIGluZGV4ZXMuXG4gKiBAcGFyYW0ge0FycmF5fSBbcGFydGlhbHNSaWdodF0gVGhlIGFyZ3VtZW50cyB0byBhcHBlbmQgdG8gdGhvc2UgcHJvdmlkZWQgdG8gdGhlIG5ldyBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7QXJyYXl9IFtob2xkZXJzUmlnaHRdIFRoZSBgcGFydGlhbHNSaWdodGAgcGxhY2Vob2xkZXIgaW5kZXhlcy5cbiAqIEBwYXJhbSB7QXJyYXl9IFthcmdQb3NdIFRoZSBhcmd1bWVudCBwb3NpdGlvbnMgb2YgdGhlIG5ldyBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbYXJ5XSBUaGUgYXJpdHkgY2FwIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbYXJpdHldIFRoZSBhcml0eSBvZiBgZnVuY2AuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyB3cmFwcGVkIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVIeWJyaWRXcmFwcGVyKGZ1bmMsIGJpdG1hc2ssIHRoaXNBcmcsIHBhcnRpYWxzLCBob2xkZXJzLCBwYXJ0aWFsc1JpZ2h0LCBob2xkZXJzUmlnaHQsIGFyZ1BvcywgYXJ5LCBhcml0eSkge1xuICB2YXIgaXNBcnkgPSBiaXRtYXNrICYgQVJZX0ZMQUcsXG4gICAgICBpc0JpbmQgPSBiaXRtYXNrICYgQklORF9GTEFHLFxuICAgICAgaXNCaW5kS2V5ID0gYml0bWFzayAmIEJJTkRfS0VZX0ZMQUcsXG4gICAgICBpc0N1cnJ5ID0gYml0bWFzayAmIENVUlJZX0ZMQUcsXG4gICAgICBpc0N1cnJ5UmlnaHQgPSBiaXRtYXNrICYgQ1VSUllfUklHSFRfRkxBRyxcbiAgICAgIGlzRmxpcCA9IGJpdG1hc2sgJiBGTElQX0ZMQUcsXG4gICAgICBDdG9yID0gaXNCaW5kS2V5ID8gdW5kZWZpbmVkIDogY3JlYXRlQ3RvcldyYXBwZXIoZnVuYyk7XG5cbiAgZnVuY3Rpb24gd3JhcHBlcigpIHtcbiAgICB2YXIgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCxcbiAgICAgICAgaW5kZXggPSBsZW5ndGgsXG4gICAgICAgIGFyZ3MgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgd2hpbGUgKGluZGV4LS0pIHtcbiAgICAgIGFyZ3NbaW5kZXhdID0gYXJndW1lbnRzW2luZGV4XTtcbiAgICB9XG4gICAgaWYgKHBhcnRpYWxzKSB7XG4gICAgICBhcmdzID0gY29tcG9zZUFyZ3MoYXJncywgcGFydGlhbHMsIGhvbGRlcnMpO1xuICAgIH1cbiAgICBpZiAocGFydGlhbHNSaWdodCkge1xuICAgICAgYXJncyA9IGNvbXBvc2VBcmdzUmlnaHQoYXJncywgcGFydGlhbHNSaWdodCwgaG9sZGVyc1JpZ2h0KTtcbiAgICB9XG4gICAgaWYgKGlzQ3VycnkgfHwgaXNDdXJyeVJpZ2h0KSB7XG4gICAgICB2YXIgcGxhY2Vob2xkZXIgPSB3cmFwcGVyLnBsYWNlaG9sZGVyLFxuICAgICAgICAgIGFyZ3NIb2xkZXJzID0gcmVwbGFjZUhvbGRlcnMoYXJncywgcGxhY2Vob2xkZXIpO1xuXG4gICAgICBsZW5ndGggLT0gYXJnc0hvbGRlcnMubGVuZ3RoO1xuICAgICAgaWYgKGxlbmd0aCA8IGFyaXR5KSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVSZWN1cnJ5V3JhcHBlcihmdW5jLCBiaXRtYXNrLCBjcmVhdGVIeWJyaWRXcmFwcGVyLCBwbGFjZWhvbGRlciwgdGhpc0FyZywgYXJncywgYXJnc0hvbGRlcnMsIGFyZ1BvcywgYXJ5LCBhcml0eSAtIGxlbmd0aCk7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciB0aGlzQmluZGluZyA9IGlzQmluZCA/IHRoaXNBcmcgOiB0aGlzLFxuICAgICAgICBmbiA9IGlzQmluZEtleSA/IHRoaXNCaW5kaW5nW2Z1bmNdIDogZnVuYztcblxuICAgIGlmIChhcmdQb3MpIHtcbiAgICAgIGFyZ3MgPSByZW9yZGVyKGFyZ3MsIGFyZ1Bvcyk7XG4gICAgfSBlbHNlIGlmIChpc0ZsaXAgJiYgYXJncy5sZW5ndGggPiAxKSB7XG4gICAgICBhcmdzLnJldmVyc2UoKTtcbiAgICB9XG4gICAgaWYgKGlzQXJ5ICYmIGFyeSA8IGFyZ3MubGVuZ3RoKSB7XG4gICAgICBhcmdzLmxlbmd0aCA9IGFyeTtcbiAgICB9XG4gICAgaWYgKHRoaXMgJiYgdGhpcyAhPT0gcm9vdCAmJiB0aGlzIGluc3RhbmNlb2Ygd3JhcHBlcikge1xuICAgICAgZm4gPSBDdG9yIHx8IGNyZWF0ZUN0b3JXcmFwcGVyKGZuKTtcbiAgICB9XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXNCaW5kaW5nLCBhcmdzKTtcbiAgfVxuICByZXR1cm4gd3JhcHBlcjtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCB3cmFwcyBgZnVuY2AgdG8gaW52b2tlIGl0IHdpdGggdGhlIG9wdGlvbmFsIGB0aGlzYFxuICogYmluZGluZyBvZiBgdGhpc0FyZ2AgYW5kIHRoZSBgcGFydGlhbHNgIHByZXBlbmRlZCB0byB0aG9zZSBwcm92aWRlZCB0b1xuICogdGhlIHdyYXBwZXIuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHdyYXAuXG4gKiBAcGFyYW0ge251bWJlcn0gYml0bWFzayBUaGUgYml0bWFzayBvZiB3cmFwcGVyIGZsYWdzLiBTZWUgYGNyZWF0ZVdyYXBwZXJgIGZvciBtb3JlIGRldGFpbHMuXG4gKiBAcGFyYW0geyp9IHRoaXNBcmcgVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7QXJyYXl9IHBhcnRpYWxzIFRoZSBhcmd1bWVudHMgdG8gcHJlcGVuZCB0byB0aG9zZSBwcm92aWRlZCB0byB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgd3JhcHBlZCBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlUGFydGlhbFdyYXBwZXIoZnVuYywgYml0bWFzaywgdGhpc0FyZywgcGFydGlhbHMpIHtcbiAgdmFyIGlzQmluZCA9IGJpdG1hc2sgJiBCSU5EX0ZMQUcsXG4gICAgICBDdG9yID0gY3JlYXRlQ3RvcldyYXBwZXIoZnVuYyk7XG5cbiAgZnVuY3Rpb24gd3JhcHBlcigpIHtcbiAgICB2YXIgYXJnc0luZGV4ID0gLTEsXG4gICAgICAgIGFyZ3NMZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuICAgICAgICBsZWZ0SW5kZXggPSAtMSxcbiAgICAgICAgbGVmdExlbmd0aCA9IHBhcnRpYWxzLmxlbmd0aCxcbiAgICAgICAgYXJncyA9IEFycmF5KGxlZnRMZW5ndGggKyBhcmdzTGVuZ3RoKSxcbiAgICAgICAgZm4gPSAodGhpcyAmJiB0aGlzICE9PSByb290ICYmIHRoaXMgaW5zdGFuY2VvZiB3cmFwcGVyKSA/IEN0b3IgOiBmdW5jO1xuXG4gICAgd2hpbGUgKCsrbGVmdEluZGV4IDwgbGVmdExlbmd0aCkge1xuICAgICAgYXJnc1tsZWZ0SW5kZXhdID0gcGFydGlhbHNbbGVmdEluZGV4XTtcbiAgICB9XG4gICAgd2hpbGUgKGFyZ3NMZW5ndGgtLSkge1xuICAgICAgYXJnc1tsZWZ0SW5kZXgrK10gPSBhcmd1bWVudHNbKythcmdzSW5kZXhdO1xuICAgIH1cbiAgICByZXR1cm4gYXBwbHkoZm4sIGlzQmluZCA/IHRoaXNBcmcgOiB0aGlzLCBhcmdzKTtcbiAgfVxuICByZXR1cm4gd3JhcHBlcjtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCB3cmFwcyBgZnVuY2AgdG8gY29udGludWUgY3VycnlpbmcuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHdyYXAuXG4gKiBAcGFyYW0ge251bWJlcn0gYml0bWFzayBUaGUgYml0bWFzayBvZiB3cmFwcGVyIGZsYWdzLiBTZWUgYGNyZWF0ZVdyYXBwZXJgIGZvciBtb3JlIGRldGFpbHMuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSB3cmFwRnVuYyBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIHRoZSBgZnVuY2Agd3JhcHBlci5cbiAqIEBwYXJhbSB7Kn0gcGxhY2Vob2xkZXIgVGhlIHBsYWNlaG9sZGVyIHRvIHJlcGxhY2UuXG4gKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICogQHBhcmFtIHtBcnJheX0gW3BhcnRpYWxzXSBUaGUgYXJndW1lbnRzIHRvIHByZXBlbmQgdG8gdGhvc2UgcHJvdmlkZWQgdG8gdGhlIG5ldyBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7QXJyYXl9IFtob2xkZXJzXSBUaGUgYHBhcnRpYWxzYCBwbGFjZWhvbGRlciBpbmRleGVzLlxuICogQHBhcmFtIHtBcnJheX0gW2FyZ1Bvc10gVGhlIGFyZ3VtZW50IHBvc2l0aW9ucyBvZiB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQHBhcmFtIHtudW1iZXJ9IFthcnldIFRoZSBhcml0eSBjYXAgb2YgYGZ1bmNgLlxuICogQHBhcmFtIHtudW1iZXJ9IFthcml0eV0gVGhlIGFyaXR5IG9mIGBmdW5jYC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHdyYXBwZWQgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVJlY3VycnlXcmFwcGVyKGZ1bmMsIGJpdG1hc2ssIHdyYXBGdW5jLCBwbGFjZWhvbGRlciwgdGhpc0FyZywgcGFydGlhbHMsIGhvbGRlcnMsIGFyZ1BvcywgYXJ5LCBhcml0eSkge1xuICB2YXIgaXNDdXJyeSA9IGJpdG1hc2sgJiBDVVJSWV9GTEFHLFxuICAgICAgbmV3QXJnUG9zID0gYXJnUG9zID8gY29weUFycmF5KGFyZ1BvcykgOiB1bmRlZmluZWQsXG4gICAgICBuZXdzSG9sZGVycyA9IGlzQ3VycnkgPyBob2xkZXJzIDogdW5kZWZpbmVkLFxuICAgICAgbmV3SG9sZGVyc1JpZ2h0ID0gaXNDdXJyeSA/IHVuZGVmaW5lZCA6IGhvbGRlcnMsXG4gICAgICBuZXdQYXJ0aWFscyA9IGlzQ3VycnkgPyBwYXJ0aWFscyA6IHVuZGVmaW5lZCxcbiAgICAgIG5ld1BhcnRpYWxzUmlnaHQgPSBpc0N1cnJ5ID8gdW5kZWZpbmVkIDogcGFydGlhbHM7XG5cbiAgYml0bWFzayB8PSAoaXNDdXJyeSA/IFBBUlRJQUxfRkxBRyA6IFBBUlRJQUxfUklHSFRfRkxBRyk7XG4gIGJpdG1hc2sgJj0gfihpc0N1cnJ5ID8gUEFSVElBTF9SSUdIVF9GTEFHIDogUEFSVElBTF9GTEFHKTtcblxuICBpZiAoIShiaXRtYXNrICYgQ1VSUllfQk9VTkRfRkxBRykpIHtcbiAgICBiaXRtYXNrICY9IH4oQklORF9GTEFHIHwgQklORF9LRVlfRkxBRyk7XG4gIH1cbiAgdmFyIHJlc3VsdCA9IHdyYXBGdW5jKGZ1bmMsIGJpdG1hc2ssIHRoaXNBcmcsIG5ld1BhcnRpYWxzLCBuZXdzSG9sZGVycywgbmV3UGFydGlhbHNSaWdodCwgbmV3SG9sZGVyc1JpZ2h0LCBuZXdBcmdQb3MsIGFyeSwgYXJpdHkpO1xuXG4gIHJlc3VsdC5wbGFjZWhvbGRlciA9IHBsYWNlaG9sZGVyO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGVpdGhlciBjdXJyaWVzIG9yIGludm9rZXMgYGZ1bmNgIHdpdGggb3B0aW9uYWxcbiAqIGB0aGlzYCBiaW5kaW5nIGFuZCBwYXJ0aWFsbHkgYXBwbGllZCBhcmd1bWVudHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb258c3RyaW5nfSBmdW5jIFRoZSBmdW5jdGlvbiBvciBtZXRob2QgbmFtZSB0byB3cmFwLlxuICogQHBhcmFtIHtudW1iZXJ9IGJpdG1hc2sgVGhlIGJpdG1hc2sgb2Ygd3JhcHBlciBmbGFncy5cbiAqICBUaGUgYml0bWFzayBtYXkgYmUgY29tcG9zZWQgb2YgdGhlIGZvbGxvd2luZyBmbGFnczpcbiAqICAgICAxIC0gYF8uYmluZGBcbiAqICAgICAyIC0gYF8uYmluZEtleWBcbiAqICAgICA0IC0gYF8uY3VycnlgIG9yIGBfLmN1cnJ5UmlnaHRgIG9mIGEgYm91bmQgZnVuY3Rpb25cbiAqICAgICA4IC0gYF8uY3VycnlgXG4gKiAgICAxNiAtIGBfLmN1cnJ5UmlnaHRgXG4gKiAgICAzMiAtIGBfLnBhcnRpYWxgXG4gKiAgICA2NCAtIGBfLnBhcnRpYWxSaWdodGBcbiAqICAgMTI4IC0gYF8ucmVhcmdgXG4gKiAgIDI1NiAtIGBfLmFyeWBcbiAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXG4gKiBAcGFyYW0ge0FycmF5fSBbcGFydGlhbHNdIFRoZSBhcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXG4gKiBAcGFyYW0ge0FycmF5fSBbaG9sZGVyc10gVGhlIGBwYXJ0aWFsc2AgcGxhY2Vob2xkZXIgaW5kZXhlcy5cbiAqIEBwYXJhbSB7QXJyYXl9IFthcmdQb3NdIFRoZSBhcmd1bWVudCBwb3NpdGlvbnMgb2YgdGhlIG5ldyBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbYXJ5XSBUaGUgYXJpdHkgY2FwIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbYXJpdHldIFRoZSBhcml0eSBvZiBgZnVuY2AuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyB3cmFwcGVkIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVXcmFwcGVyKGZ1bmMsIGJpdG1hc2ssIHRoaXNBcmcsIHBhcnRpYWxzLCBob2xkZXJzLCBhcmdQb3MsIGFyeSwgYXJpdHkpIHtcbiAgdmFyIGlzQmluZEtleSA9IGJpdG1hc2sgJiBCSU5EX0tFWV9GTEFHO1xuICBpZiAoIWlzQmluZEtleSAmJiB0eXBlb2YgZnVuYyAhPSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihGVU5DX0VSUk9SX1RFWFQpO1xuICB9XG4gIHZhciBsZW5ndGggPSBwYXJ0aWFscyA/IHBhcnRpYWxzLmxlbmd0aCA6IDA7XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgYml0bWFzayAmPSB+KFBBUlRJQUxfRkxBRyB8IFBBUlRJQUxfUklHSFRfRkxBRyk7XG4gICAgcGFydGlhbHMgPSBob2xkZXJzID0gdW5kZWZpbmVkO1xuICB9XG4gIGFyeSA9IGFyeSA9PT0gdW5kZWZpbmVkID8gYXJ5IDogbmF0aXZlTWF4KHRvSW50ZWdlcihhcnkpLCAwKTtcbiAgYXJpdHkgPSBhcml0eSA9PT0gdW5kZWZpbmVkID8gYXJpdHkgOiB0b0ludGVnZXIoYXJpdHkpO1xuICBsZW5ndGggLT0gaG9sZGVycyA/IGhvbGRlcnMubGVuZ3RoIDogMDtcblxuICBpZiAoYml0bWFzayAmIFBBUlRJQUxfUklHSFRfRkxBRykge1xuICAgIHZhciBwYXJ0aWFsc1JpZ2h0ID0gcGFydGlhbHMsXG4gICAgICAgIGhvbGRlcnNSaWdodCA9IGhvbGRlcnM7XG5cbiAgICBwYXJ0aWFscyA9IGhvbGRlcnMgPSB1bmRlZmluZWQ7XG4gIH1cbiAgdmFyIG5ld0RhdGEgPSBbZnVuYywgYml0bWFzaywgdGhpc0FyZywgcGFydGlhbHMsIGhvbGRlcnMsIHBhcnRpYWxzUmlnaHQsIGhvbGRlcnNSaWdodCwgYXJnUG9zLCBhcnksIGFyaXR5XTtcblxuICBmdW5jID0gbmV3RGF0YVswXTtcbiAgYml0bWFzayA9IG5ld0RhdGFbMV07XG4gIHRoaXNBcmcgPSBuZXdEYXRhWzJdO1xuICBwYXJ0aWFscyA9IG5ld0RhdGFbM107XG4gIGhvbGRlcnMgPSBuZXdEYXRhWzRdO1xuICBhcml0eSA9IG5ld0RhdGFbOV0gPSBuZXdEYXRhWzldID09IG51bGxcbiAgICA/IChpc0JpbmRLZXkgPyAwIDogZnVuYy5sZW5ndGgpXG4gICAgOiBuYXRpdmVNYXgobmV3RGF0YVs5XSAtIGxlbmd0aCwgMCk7XG5cbiAgaWYgKCFhcml0eSAmJiBiaXRtYXNrICYgKENVUlJZX0ZMQUcgfCBDVVJSWV9SSUdIVF9GTEFHKSkge1xuICAgIGJpdG1hc2sgJj0gfihDVVJSWV9GTEFHIHwgQ1VSUllfUklHSFRfRkxBRyk7XG4gIH1cbiAgaWYgKCFiaXRtYXNrIHx8IGJpdG1hc2sgPT0gQklORF9GTEFHKSB7XG4gICAgdmFyIHJlc3VsdCA9IGNyZWF0ZUJhc2VXcmFwcGVyKGZ1bmMsIGJpdG1hc2ssIHRoaXNBcmcpO1xuICB9IGVsc2UgaWYgKGJpdG1hc2sgPT0gQ1VSUllfRkxBRyB8fCBiaXRtYXNrID09IENVUlJZX1JJR0hUX0ZMQUcpIHtcbiAgICByZXN1bHQgPSBjcmVhdGVDdXJyeVdyYXBwZXIoZnVuYywgYml0bWFzaywgYXJpdHkpO1xuICB9IGVsc2UgaWYgKChiaXRtYXNrID09IFBBUlRJQUxfRkxBRyB8fCBiaXRtYXNrID09IChCSU5EX0ZMQUcgfCBQQVJUSUFMX0ZMQUcpKSAmJiAhaG9sZGVycy5sZW5ndGgpIHtcbiAgICByZXN1bHQgPSBjcmVhdGVQYXJ0aWFsV3JhcHBlcihmdW5jLCBiaXRtYXNrLCB0aGlzQXJnLCBwYXJ0aWFscyk7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0ID0gY3JlYXRlSHlicmlkV3JhcHBlci5hcHBseSh1bmRlZmluZWQsIG5ld0RhdGEpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogUmVvcmRlciBgYXJyYXlgIGFjY29yZGluZyB0byB0aGUgc3BlY2lmaWVkIGluZGV4ZXMgd2hlcmUgdGhlIGVsZW1lbnQgYXRcbiAqIHRoZSBmaXJzdCBpbmRleCBpcyBhc3NpZ25lZCBhcyB0aGUgZmlyc3QgZWxlbWVudCwgdGhlIGVsZW1lbnQgYXRcbiAqIHRoZSBzZWNvbmQgaW5kZXggaXMgYXNzaWduZWQgYXMgdGhlIHNlY29uZCBlbGVtZW50LCBhbmQgc28gb24uXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byByZW9yZGVyLlxuICogQHBhcmFtIHtBcnJheX0gaW5kZXhlcyBUaGUgYXJyYW5nZWQgYXJyYXkgaW5kZXhlcy5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBgYXJyYXlgLlxuICovXG5mdW5jdGlvbiByZW9yZGVyKGFycmF5LCBpbmRleGVzKSB7XG4gIHZhciBhcnJMZW5ndGggPSBhcnJheS5sZW5ndGgsXG4gICAgICBsZW5ndGggPSBuYXRpdmVNaW4oaW5kZXhlcy5sZW5ndGgsIGFyckxlbmd0aCksXG4gICAgICBvbGRBcnJheSA9IGNvcHlBcnJheShhcnJheSk7XG5cbiAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgdmFyIGluZGV4ID0gaW5kZXhlc1tsZW5ndGhdO1xuICAgIGFycmF5W2xlbmd0aF0gPSBpc0luZGV4KGluZGV4LCBhcnJMZW5ndGgpID8gb2xkQXJyYXlbaW5kZXhdIDogdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiBhcnJheTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYEZ1bmN0aW9uYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNGdW5jdGlvbihfKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oL2FiYy8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZSkge1xuICAvLyBUaGUgdXNlIG9mIGBPYmplY3QjdG9TdHJpbmdgIGF2b2lkcyBpc3N1ZXMgd2l0aCB0aGUgYHR5cGVvZmAgb3BlcmF0b3JcbiAgLy8gaW4gU2FmYXJpIDggd2hpY2ggcmV0dXJucyAnb2JqZWN0JyBmb3IgdHlwZWQgYXJyYXkgY29uc3RydWN0b3JzLCBhbmRcbiAgLy8gUGhhbnRvbUpTIDEuOSB3aGljaCByZXR1cm5zICdmdW5jdGlvbicgZm9yIGBOb2RlTGlzdGAgaW5zdGFuY2VzLlxuICB2YXIgdGFnID0gaXNPYmplY3QodmFsdWUpID8gb2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSkgOiAnJztcbiAgcmV0dXJuIHRhZyA9PSBmdW5jVGFnIHx8IHRhZyA9PSBnZW5UYWc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoXy5ub29wKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KG51bGwpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbi8qKlxuICogQ29udmVydHMgYHZhbHVlYCB0byBhbiBpbnRlZ2VyLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGxvb3NlbHkgYmFzZWQgb24gW2BUb0ludGVnZXJgXShodHRwOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtdG9pbnRlZ2VyKS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBjb252ZXJ0ZWQgaW50ZWdlci5cbiAqIEBleGFtcGxlXG4gKlxuICogXy50b0ludGVnZXIoMyk7XG4gKiAvLyA9PiAzXG4gKlxuICogXy50b0ludGVnZXIoTnVtYmVyLk1JTl9WQUxVRSk7XG4gKiAvLyA9PiAwXG4gKlxuICogXy50b0ludGVnZXIoSW5maW5pdHkpO1xuICogLy8gPT4gMS43OTc2OTMxMzQ4NjIzMTU3ZSszMDhcbiAqXG4gKiBfLnRvSW50ZWdlcignMycpO1xuICogLy8gPT4gM1xuICovXG5mdW5jdGlvbiB0b0ludGVnZXIodmFsdWUpIHtcbiAgaWYgKCF2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gMCA/IHZhbHVlIDogMDtcbiAgfVxuICB2YWx1ZSA9IHRvTnVtYmVyKHZhbHVlKTtcbiAgaWYgKHZhbHVlID09PSBJTkZJTklUWSB8fCB2YWx1ZSA9PT0gLUlORklOSVRZKSB7XG4gICAgdmFyIHNpZ24gPSAodmFsdWUgPCAwID8gLTEgOiAxKTtcbiAgICByZXR1cm4gc2lnbiAqIE1BWF9JTlRFR0VSO1xuICB9XG4gIHZhciByZW1haW5kZXIgPSB2YWx1ZSAlIDE7XG4gIHJldHVybiB2YWx1ZSA9PT0gdmFsdWUgPyAocmVtYWluZGVyID8gdmFsdWUgLSByZW1haW5kZXIgOiB2YWx1ZSkgOiAwO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGB2YWx1ZWAgdG8gYSBudW1iZXIuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBwcm9jZXNzLlxuICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgbnVtYmVyLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLnRvTnVtYmVyKDMpO1xuICogLy8gPT4gM1xuICpcbiAqIF8udG9OdW1iZXIoTnVtYmVyLk1JTl9WQUxVRSk7XG4gKiAvLyA9PiA1ZS0zMjRcbiAqXG4gKiBfLnRvTnVtYmVyKEluZmluaXR5KTtcbiAqIC8vID0+IEluZmluaXR5XG4gKlxuICogXy50b051bWJlcignMycpO1xuICogLy8gPT4gM1xuICovXG5mdW5jdGlvbiB0b051bWJlcih2YWx1ZSkge1xuICBpZiAoaXNPYmplY3QodmFsdWUpKSB7XG4gICAgdmFyIG90aGVyID0gaXNGdW5jdGlvbih2YWx1ZS52YWx1ZU9mKSA/IHZhbHVlLnZhbHVlT2YoKSA6IHZhbHVlO1xuICAgIHZhbHVlID0gaXNPYmplY3Qob3RoZXIpID8gKG90aGVyICsgJycpIDogb3RoZXI7XG4gIH1cbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPSAnc3RyaW5nJykge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gMCA/IHZhbHVlIDogK3ZhbHVlO1xuICB9XG4gIHZhbHVlID0gdmFsdWUucmVwbGFjZShyZVRyaW0sICcnKTtcbiAgdmFyIGlzQmluYXJ5ID0gcmVJc0JpbmFyeS50ZXN0KHZhbHVlKTtcbiAgcmV0dXJuIChpc0JpbmFyeSB8fCByZUlzT2N0YWwudGVzdCh2YWx1ZSkpXG4gICAgPyBmcmVlUGFyc2VJbnQodmFsdWUuc2xpY2UoMiksIGlzQmluYXJ5ID8gMiA6IDgpXG4gICAgOiAocmVJc0JhZEhleC50ZXN0KHZhbHVlKSA/IE5BTiA6ICt2YWx1ZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlV3JhcHBlcjtcbiIsIi8qKlxuICogbG9kYXNoIDMuOS4xIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJztcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGhvc3QgY29uc3RydWN0b3JzIChTYWZhcmkgPiA1KS4gKi9cbnZhciByZUlzSG9zdEN0b3IgPSAvXlxcW29iamVjdCAuKz9Db25zdHJ1Y3RvclxcXSQvO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCc7XG59XG5cbi8qKiBVc2VkIGZvciBuYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byByZXNvbHZlIHRoZSBkZWNvbXBpbGVkIHNvdXJjZSBvZiBmdW5jdGlvbnMuICovXG52YXIgZm5Ub1N0cmluZyA9IEZ1bmN0aW9uLnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqVG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGlmIGEgbWV0aG9kIGlzIG5hdGl2ZS4gKi9cbnZhciByZUlzTmF0aXZlID0gUmVnRXhwKCdeJyArXG4gIGZuVG9TdHJpbmcuY2FsbChoYXNPd25Qcm9wZXJ0eSkucmVwbGFjZSgvW1xcXFxeJC4qKz8oKVtcXF17fXxdL2csICdcXFxcJCYnKVxuICAucmVwbGFjZSgvaGFzT3duUHJvcGVydHl8KGZ1bmN0aW9uKS4qPyg/PVxcXFxcXCgpfCBmb3IgLis/KD89XFxcXFxcXSkvZywgJyQxLio/JykgKyAnJCdcbik7XG5cbi8qKlxuICogR2V0cyB0aGUgbmF0aXZlIGZ1bmN0aW9uIGF0IGBrZXlgIG9mIGBvYmplY3RgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIG1ldGhvZCB0byBnZXQuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgZnVuY3Rpb24gaWYgaXQncyBuYXRpdmUsIGVsc2UgYHVuZGVmaW5lZGAuXG4gKi9cbmZ1bmN0aW9uIGdldE5hdGl2ZShvYmplY3QsIGtleSkge1xuICB2YXIgdmFsdWUgPSBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICByZXR1cm4gaXNOYXRpdmUodmFsdWUpID8gdmFsdWUgOiB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIG9sZGVyIHZlcnNpb25zIG9mIENocm9tZSBhbmQgU2FmYXJpIHdoaWNoIHJldHVybiAnZnVuY3Rpb24nIGZvciByZWdleGVzXG4gIC8vIGFuZCBTYWZhcmkgOCBlcXVpdmFsZW50cyB3aGljaCByZXR1cm4gJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGNvbnN0cnVjdG9ycy5cbiAgcmV0dXJuIGlzT2JqZWN0KHZhbHVlKSAmJiBvYmpUb1N0cmluZy5jYWxsKHZhbHVlKSA9PSBmdW5jVGFnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KDEpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgLy8gQXZvaWQgYSBWOCBKSVQgYnVnIGluIENocm9tZSAxOS0yMC5cbiAgLy8gU2VlIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0yMjkxIGZvciBtb3JlIGRldGFpbHMuXG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgbmF0aXZlIGZ1bmN0aW9uLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIG5hdGl2ZSBmdW5jdGlvbiwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzTmF0aXZlKEFycmF5LnByb3RvdHlwZS5wdXNoKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzTmF0aXZlKF8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNOYXRpdmUodmFsdWUpIHtcbiAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgcmV0dXJuIHJlSXNOYXRpdmUudGVzdChmblRvU3RyaW5nLmNhbGwodmFsdWUpKTtcbiAgfVxuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiByZUlzSG9zdEN0b3IudGVzdCh2YWx1ZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0TmF0aXZlO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjAgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjcuMCA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqIFVzZWQgYXMgdGhlIGludGVybmFsIGFyZ3VtZW50IHBsYWNlaG9sZGVyLiAqL1xudmFyIFBMQUNFSE9MREVSID0gJ19fbG9kYXNoX3BsYWNlaG9sZGVyX18nO1xuXG4vKipcbiAqIFJlcGxhY2VzIGFsbCBgcGxhY2Vob2xkZXJgIGVsZW1lbnRzIGluIGBhcnJheWAgd2l0aCBhbiBpbnRlcm5hbCBwbGFjZWhvbGRlclxuICogYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgdGhlaXIgaW5kZXhlcy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIG1vZGlmeS5cbiAqIEBwYXJhbSB7Kn0gcGxhY2Vob2xkZXIgVGhlIHBsYWNlaG9sZGVyIHRvIHJlcGxhY2UuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIG5ldyBhcnJheSBvZiBwbGFjZWhvbGRlciBpbmRleGVzLlxuICovXG5mdW5jdGlvbiByZXBsYWNlSG9sZGVycyhhcnJheSwgcGxhY2Vob2xkZXIpIHtcbiAgdmFyIGluZGV4ID0gLTEsXG4gICAgICBsZW5ndGggPSBhcnJheS5sZW5ndGgsXG4gICAgICByZXNJbmRleCA9IC0xLFxuICAgICAgcmVzdWx0ID0gW107XG5cbiAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICBpZiAoYXJyYXlbaW5kZXhdID09PSBwbGFjZWhvbGRlcikge1xuICAgICAgYXJyYXlbaW5kZXhdID0gUExBQ0VIT0xERVI7XG4gICAgICByZXN1bHRbKytyZXNJbmRleF0gPSBpbmRleDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZXBsYWNlSG9sZGVycztcbiIsIi8qKlxuICogbG9kYXNoIDMuMC4xIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE2IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTYgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqIFVzZWQgdG8gZGV0ZXJtaW5lIGlmIHZhbHVlcyBhcmUgb2YgdGhlIGxhbmd1YWdlIHR5cGUgYE9iamVjdGAuICovXG52YXIgb2JqZWN0VHlwZXMgPSB7XG4gICdmdW5jdGlvbic6IHRydWUsXG4gICdvYmplY3QnOiB0cnVlXG59O1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGV4cG9ydHNgLiAqL1xudmFyIGZyZWVFeHBvcnRzID0gKG9iamVjdFR5cGVzW3R5cGVvZiBleHBvcnRzXSAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlKVxuICA/IGV4cG9ydHNcbiAgOiB1bmRlZmluZWQ7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYC4gKi9cbnZhciBmcmVlTW9kdWxlID0gKG9iamVjdFR5cGVzW3R5cGVvZiBtb2R1bGVdICYmIG1vZHVsZSAmJiAhbW9kdWxlLm5vZGVUeXBlKVxuICA/IG1vZHVsZVxuICA6IHVuZGVmaW5lZDtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcy4gKi9cbnZhciBmcmVlR2xvYmFsID0gY2hlY2tHbG9iYWwoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSAmJiB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbCk7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgc2VsZmAuICovXG52YXIgZnJlZVNlbGYgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygc2VsZl0gJiYgc2VsZik7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgd2luZG93YC4gKi9cbnZhciBmcmVlV2luZG93ID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHdpbmRvd10gJiYgd2luZG93KTtcblxuLyoqIERldGVjdCBgdGhpc2AgYXMgdGhlIGdsb2JhbCBvYmplY3QuICovXG52YXIgdGhpc0dsb2JhbCA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB0aGlzXSAmJiB0aGlzKTtcblxuLyoqXG4gKiBVc2VkIGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxuICpcbiAqIFRoZSBgdGhpc2AgdmFsdWUgaXMgdXNlZCBpZiBpdCdzIHRoZSBnbG9iYWwgb2JqZWN0IHRvIGF2b2lkIEdyZWFzZW1vbmtleSdzXG4gKiByZXN0cmljdGVkIGB3aW5kb3dgIG9iamVjdCwgb3RoZXJ3aXNlIHRoZSBgd2luZG93YCBvYmplY3QgaXMgdXNlZC5cbiAqL1xudmFyIHJvb3QgPSBmcmVlR2xvYmFsIHx8XG4gICgoZnJlZVdpbmRvdyAhPT0gKHRoaXNHbG9iYWwgJiYgdGhpc0dsb2JhbC53aW5kb3cpKSAmJiBmcmVlV2luZG93KSB8fFxuICAgIGZyZWVTZWxmIHx8IHRoaXNHbG9iYWwgfHwgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIGdsb2JhbCBvYmplY3QuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge251bGx8T2JqZWN0fSBSZXR1cm5zIGB2YWx1ZWAgaWYgaXQncyBhIGdsb2JhbCBvYmplY3QsIGVsc2UgYG51bGxgLlxuICovXG5mdW5jdGlvbiBjaGVja0dsb2JhbCh2YWx1ZSkge1xuICByZXR1cm4gKHZhbHVlICYmIHZhbHVlLk9iamVjdCA9PT0gT2JqZWN0KSA/IHZhbHVlIDogbnVsbDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByb290O1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjMgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbnZhciBhcnJheUVhY2ggPSByZXF1aXJlKCdsb2Rhc2guX2FycmF5ZWFjaCcpLFxuICAgIGJhc2VFYWNoID0gcmVxdWlyZSgnbG9kYXNoLl9iYXNlZWFjaCcpLFxuICAgIGJpbmRDYWxsYmFjayA9IHJlcXVpcmUoJ2xvZGFzaC5fYmluZGNhbGxiYWNrJyksXG4gICAgaXNBcnJheSA9IHJlcXVpcmUoJ2xvZGFzaC5pc2FycmF5Jyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIGZvciBgXy5mb3JFYWNoYCBvciBgXy5mb3JFYWNoUmlnaHRgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBhcnJheUZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGl0ZXJhdGUgb3ZlciBhbiBhcnJheS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGVhY2hGdW5jIFRoZSBmdW5jdGlvbiB0byBpdGVyYXRlIG92ZXIgYSBjb2xsZWN0aW9uLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZWFjaCBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRm9yRWFjaChhcnJheUZ1bmMsIGVhY2hGdW5jKSB7XG4gIHJldHVybiBmdW5jdGlvbihjb2xsZWN0aW9uLCBpdGVyYXRlZSwgdGhpc0FyZykge1xuICAgIHJldHVybiAodHlwZW9mIGl0ZXJhdGVlID09ICdmdW5jdGlvbicgJiYgdGhpc0FyZyA9PT0gdW5kZWZpbmVkICYmIGlzQXJyYXkoY29sbGVjdGlvbikpXG4gICAgICA/IGFycmF5RnVuYyhjb2xsZWN0aW9uLCBpdGVyYXRlZSlcbiAgICAgIDogZWFjaEZ1bmMoY29sbGVjdGlvbiwgYmluZENhbGxiYWNrKGl0ZXJhdGVlLCB0aGlzQXJnLCAzKSk7XG4gIH07XG59XG5cbi8qKlxuICogSXRlcmF0ZXMgb3ZlciBlbGVtZW50cyBvZiBgY29sbGVjdGlvbmAgaW52b2tpbmcgYGl0ZXJhdGVlYCBmb3IgZWFjaCBlbGVtZW50LlxuICogVGhlIGBpdGVyYXRlZWAgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOlxuICogKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLiBJdGVyYXRlZSBmdW5jdGlvbnMgbWF5IGV4aXQgaXRlcmF0aW9uIGVhcmx5XG4gKiBieSBleHBsaWNpdGx5IHJldHVybmluZyBgZmFsc2VgLlxuICpcbiAqICoqTm90ZToqKiBBcyB3aXRoIG90aGVyIFwiQ29sbGVjdGlvbnNcIiBtZXRob2RzLCBvYmplY3RzIHdpdGggYSBcImxlbmd0aFwiIHByb3BlcnR5XG4gKiBhcmUgaXRlcmF0ZWQgbGlrZSBhcnJheXMuIFRvIGF2b2lkIHRoaXMgYmVoYXZpb3IgYF8uZm9ySW5gIG9yIGBfLmZvck93bmBcbiAqIG1heSBiZSB1c2VkIGZvciBvYmplY3QgaXRlcmF0aW9uLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAYWxpYXMgZWFjaFxuICogQGNhdGVnb3J5IENvbGxlY3Rpb25cbiAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbaXRlcmF0ZWU9Xy5pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGludm9rZWQgcGVyIGl0ZXJhdGlvbi5cbiAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgaXRlcmF0ZWVgLlxuICogQHJldHVybnMge0FycmF5fE9iamVjdHxzdHJpbmd9IFJldHVybnMgYGNvbGxlY3Rpb25gLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfKFsxLCAyXSkuZm9yRWFjaChmdW5jdGlvbihuKSB7XG4gKiAgIGNvbnNvbGUubG9nKG4pO1xuICogfSkudmFsdWUoKTtcbiAqIC8vID0+IGxvZ3MgZWFjaCB2YWx1ZSBmcm9tIGxlZnQgdG8gcmlnaHQgYW5kIHJldHVybnMgdGhlIGFycmF5XG4gKlxuICogXy5mb3JFYWNoKHsgJ2EnOiAxLCAnYic6IDIgfSwgZnVuY3Rpb24obiwga2V5KSB7XG4gKiAgIGNvbnNvbGUubG9nKG4sIGtleSk7XG4gKiB9KTtcbiAqIC8vID0+IGxvZ3MgZWFjaCB2YWx1ZS1rZXkgcGFpciBhbmQgcmV0dXJucyB0aGUgb2JqZWN0IChpdGVyYXRpb24gb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gKi9cbnZhciBmb3JFYWNoID0gY3JlYXRlRm9yRWFjaChhcnJheUVhY2gsIGJhc2VFYWNoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmb3JFYWNoO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjggKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTYgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNiBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogVXNlZCBhcyByZWZlcmVuY2VzIGZvciB2YXJpb3VzIGBOdW1iZXJgIGNvbnN0YW50cy4gKi9cbnZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIGFyZ3NUYWcgPSAnW29iamVjdCBBcmd1bWVudHNdJyxcbiAgICBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJyxcbiAgICBnZW5UYWcgPSAnW29iamVjdCBHZW5lcmF0b3JGdW5jdGlvbl0nO1xuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byBjaGVjayBvYmplY3RzIGZvciBvd24gcHJvcGVydGllcy4gKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmplY3RUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKiogQnVpbHQtaW4gdmFsdWUgcmVmZXJlbmNlcy4gKi9cbnZhciBwcm9wZXJ0eUlzRW51bWVyYWJsZSA9IG9iamVjdFByb3RvLnByb3BlcnR5SXNFbnVtZXJhYmxlO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnByb3BlcnR5YCB3aXRob3V0IHN1cHBvcnQgZm9yIGRlZXAgcGF0aHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgcHJvcGVydHkgdG8gZ2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGJhc2VQcm9wZXJ0eShrZXkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICB9O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIFwibGVuZ3RoXCIgcHJvcGVydHkgdmFsdWUgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCB0byBhdm9pZCBhIFtKSVQgYnVnXShodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTQyNzkyKVxuICogdGhhdCBhZmZlY3RzIFNhZmFyaSBvbiBhdCBsZWFzdCBpT1MgOC4xLTguMyBBUk02NC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIFwibGVuZ3RoXCIgdmFsdWUuXG4gKi9cbnZhciBnZXRMZW5ndGggPSBiYXNlUHJvcGVydHkoJ2xlbmd0aCcpO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGxpa2VseSBhbiBgYXJndW1lbnRzYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcmd1bWVudHMoZnVuY3Rpb24oKSB7IHJldHVybiBhcmd1bWVudHM7IH0oKSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FyZ3VtZW50cyhbMSwgMiwgM10pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcmd1bWVudHModmFsdWUpIHtcbiAgLy8gU2FmYXJpIDguMSBpbmNvcnJlY3RseSBtYWtlcyBgYXJndW1lbnRzLmNhbGxlZWAgZW51bWVyYWJsZSBpbiBzdHJpY3QgbW9kZS5cbiAgcmV0dXJuIGlzQXJyYXlMaWtlT2JqZWN0KHZhbHVlKSAmJiBoYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCAnY2FsbGVlJykgJiZcbiAgICAoIXByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwodmFsdWUsICdjYWxsZWUnKSB8fCBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA9PSBhcmdzVGFnKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLiBBIHZhbHVlIGlzIGNvbnNpZGVyZWQgYXJyYXktbGlrZSBpZiBpdCdzXG4gKiBub3QgYSBmdW5jdGlvbiBhbmQgaGFzIGEgYHZhbHVlLmxlbmd0aGAgdGhhdCdzIGFuIGludGVnZXIgZ3JlYXRlciB0aGFuIG9yXG4gKiBlcXVhbCB0byBgMGAgYW5kIGxlc3MgdGhhbiBvciBlcXVhbCB0byBgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJgLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKGRvY3VtZW50LmJvZHkuY2hpbGRyZW4pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoJ2FiYycpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlMaWtlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPSBudWxsICYmIGlzTGVuZ3RoKGdldExlbmd0aCh2YWx1ZSkpICYmICFpc0Z1bmN0aW9uKHZhbHVlKTtcbn1cblxuLyoqXG4gKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmlzQXJyYXlMaWtlYCBleGNlcHQgdGhhdCBpdCBhbHNvIGNoZWNrcyBpZiBgdmFsdWVgXG4gKiBpcyBhbiBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIGFycmF5LWxpa2Ugb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheUxpa2VPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlT2JqZWN0KGRvY3VtZW50LmJvZHkuY2hpbGRyZW4pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2VPYmplY3QoJ2FiYycpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzQXJyYXlMaWtlT2JqZWN0KF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5TGlrZU9iamVjdCh2YWx1ZSkge1xuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBpc0FycmF5TGlrZSh2YWx1ZSk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIFNhZmFyaSA4IHdoaWNoIHJldHVybnMgJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGFuZCB3ZWFrIG1hcCBjb25zdHJ1Y3RvcnMsXG4gIC8vIGFuZCBQaGFudG9tSlMgMS45IHdoaWNoIHJldHVybnMgJ2Z1bmN0aW9uJyBmb3IgYE5vZGVMaXN0YCBpbnN0YW5jZXMuXG4gIHZhciB0YWcgPSBpc09iamVjdCh2YWx1ZSkgPyBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA6ICcnO1xuICByZXR1cm4gdGFnID09IGZ1bmNUYWcgfHwgdGFnID09IGdlblRhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgbGVuZ3RoLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGxvb3NlbHkgYmFzZWQgb24gW2BUb0xlbmd0aGBdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXRvbGVuZ3RoKS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0xlbmd0aCgzKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzTGVuZ3RoKE51bWJlci5NSU5fVkFMVUUpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzTGVuZ3RoKEluZmluaXR5KTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0xlbmd0aCgnMycpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJlxuICAgIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPD0gTUFYX1NBRkVfSU5URUdFUjtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChfLm5vb3ApO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZS4gQSB2YWx1ZSBpcyBvYmplY3QtbGlrZSBpZiBpdCdzIG5vdCBgbnVsbGBcbiAqIGFuZCBoYXMgYSBgdHlwZW9mYCByZXN1bHQgb2YgXCJvYmplY3RcIi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdExpa2Uoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc09iamVjdExpa2UobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJndW1lbnRzO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjQgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIGFycmF5VGFnID0gJ1tvYmplY3QgQXJyYXldJyxcbiAgICBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJztcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGhvc3QgY29uc3RydWN0b3JzIChTYWZhcmkgPiA1KS4gKi9cbnZhciByZUlzSG9zdEN0b3IgPSAvXlxcW29iamVjdCAuKz9Db25zdHJ1Y3RvclxcXSQvO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCc7XG59XG5cbi8qKiBVc2VkIGZvciBuYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byByZXNvbHZlIHRoZSBkZWNvbXBpbGVkIHNvdXJjZSBvZiBmdW5jdGlvbnMuICovXG52YXIgZm5Ub1N0cmluZyA9IEZ1bmN0aW9uLnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqVG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGlmIGEgbWV0aG9kIGlzIG5hdGl2ZS4gKi9cbnZhciByZUlzTmF0aXZlID0gUmVnRXhwKCdeJyArXG4gIGZuVG9TdHJpbmcuY2FsbChoYXNPd25Qcm9wZXJ0eSkucmVwbGFjZSgvW1xcXFxeJC4qKz8oKVtcXF17fXxdL2csICdcXFxcJCYnKVxuICAucmVwbGFjZSgvaGFzT3duUHJvcGVydHl8KGZ1bmN0aW9uKS4qPyg/PVxcXFxcXCgpfCBmb3IgLis/KD89XFxcXFxcXSkvZywgJyQxLio/JykgKyAnJCdcbik7XG5cbi8qIE5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcyBmb3IgdGhvc2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGFzIG90aGVyIGBsb2Rhc2hgIG1ldGhvZHMuICovXG52YXIgbmF0aXZlSXNBcnJheSA9IGdldE5hdGl2ZShBcnJheSwgJ2lzQXJyYXknKTtcblxuLyoqXG4gKiBVc2VkIGFzIHRoZSBbbWF4aW11bSBsZW5ndGhdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW51bWJlci5tYXhfc2FmZV9pbnRlZ2VyKVxuICogb2YgYW4gYXJyYXktbGlrZSB2YWx1ZS5cbiAqL1xudmFyIE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxO1xuXG4vKipcbiAqIEdldHMgdGhlIG5hdGl2ZSBmdW5jdGlvbiBhdCBga2V5YCBvZiBgb2JqZWN0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBtZXRob2QgdG8gZ2V0LlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIGZ1bmN0aW9uIGlmIGl0J3MgbmF0aXZlLCBlbHNlIGB1bmRlZmluZWRgLlxuICovXG5mdW5jdGlvbiBnZXROYXRpdmUob2JqZWN0LCBrZXkpIHtcbiAgdmFyIHZhbHVlID0gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgcmV0dXJuIGlzTmF0aXZlKHZhbHVlKSA/IHZhbHVlIDogdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgYmFzZWQgb24gW2BUb0xlbmd0aGBdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXRvbGVuZ3RoKS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0xlbmd0aCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInICYmIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPD0gTUFYX1NBRkVfSU5URUdFUjtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGFuIGBBcnJheWAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzQXJyYXkoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXkoZnVuY3Rpb24oKSB7IHJldHVybiBhcmd1bWVudHM7IH0oKSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG52YXIgaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgaXNMZW5ndGgodmFsdWUubGVuZ3RoKSAmJiBvYmpUb1N0cmluZy5jYWxsKHZhbHVlKSA9PSBhcnJheVRhZztcbn07XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIG9sZGVyIHZlcnNpb25zIG9mIENocm9tZSBhbmQgU2FmYXJpIHdoaWNoIHJldHVybiAnZnVuY3Rpb24nIGZvciByZWdleGVzXG4gIC8vIGFuZCBTYWZhcmkgOCBlcXVpdmFsZW50cyB3aGljaCByZXR1cm4gJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGNvbnN0cnVjdG9ycy5cbiAgcmV0dXJuIGlzT2JqZWN0KHZhbHVlKSAmJiBvYmpUb1N0cmluZy5jYWxsKHZhbHVlKSA9PSBmdW5jVGFnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KDEpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgLy8gQXZvaWQgYSBWOCBKSVQgYnVnIGluIENocm9tZSAxOS0yMC5cbiAgLy8gU2VlIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0yMjkxIGZvciBtb3JlIGRldGFpbHMuXG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgbmF0aXZlIGZ1bmN0aW9uLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIG5hdGl2ZSBmdW5jdGlvbiwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzTmF0aXZlKEFycmF5LnByb3RvdHlwZS5wdXNoKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzTmF0aXZlKF8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNOYXRpdmUodmFsdWUpIHtcbiAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgcmV0dXJuIHJlSXNOYXRpdmUudGVzdChmblRvU3RyaW5nLmNhbGwodmFsdWUpKTtcbiAgfVxuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiByZUlzSG9zdEN0b3IudGVzdCh2YWx1ZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcnJheTtcbiIsIi8qKlxuICogbG9kYXNoIDMuMS4yIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIgZ2V0TmF0aXZlID0gcmVxdWlyZSgnbG9kYXNoLl9nZXRuYXRpdmUnKSxcbiAgICBpc0FyZ3VtZW50cyA9IHJlcXVpcmUoJ2xvZGFzaC5pc2FyZ3VtZW50cycpLFxuICAgIGlzQXJyYXkgPSByZXF1aXJlKCdsb2Rhc2guaXNhcnJheScpO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgdW5zaWduZWQgaW50ZWdlciB2YWx1ZXMuICovXG52YXIgcmVJc1VpbnQgPSAvXlxcZCskLztcblxuLyoqIFVzZWQgZm9yIG5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qIE5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcyBmb3IgdGhvc2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGFzIG90aGVyIGBsb2Rhc2hgIG1ldGhvZHMuICovXG52YXIgbmF0aXZlS2V5cyA9IGdldE5hdGl2ZShPYmplY3QsICdrZXlzJyk7XG5cbi8qKlxuICogVXNlZCBhcyB0aGUgW21heGltdW0gbGVuZ3RoXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1udW1iZXIubWF4X3NhZmVfaW50ZWdlcilcbiAqIG9mIGFuIGFycmF5LWxpa2UgdmFsdWUuXG4gKi9cbnZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5wcm9wZXJ0eWAgd2l0aG91dCBzdXBwb3J0IGZvciBkZWVwIHBhdGhzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHByb3BlcnR5IHRvIGdldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBiYXNlUHJvcGVydHkoa2V5KSB7XG4gIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgfTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBcImxlbmd0aFwiIHByb3BlcnR5IHZhbHVlIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gYXZvaWQgYSBbSklUIGJ1Z10oaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE0Mjc5MilcbiAqIHRoYXQgYWZmZWN0cyBTYWZhcmkgb24gYXQgbGVhc3QgaU9TIDguMS04LjMgQVJNNjQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBcImxlbmd0aFwiIHZhbHVlLlxuICovXG52YXIgZ2V0TGVuZ3RoID0gYmFzZVByb3BlcnR5KCdsZW5ndGgnKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNBcnJheUxpa2UodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiYgaXNMZW5ndGgoZ2V0TGVuZ3RoKHZhbHVlKSk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGluZGV4LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoPU1BWF9TQUZFX0lOVEVHRVJdIFRoZSB1cHBlciBib3VuZHMgb2YgYSB2YWxpZCBpbmRleC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgaW5kZXgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNJbmRleCh2YWx1ZSwgbGVuZ3RoKSB7XG4gIHZhbHVlID0gKHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fCByZUlzVWludC50ZXN0KHZhbHVlKSkgPyArdmFsdWUgOiAtMTtcbiAgbGVuZ3RoID0gbGVuZ3RoID09IG51bGwgPyBNQVhfU0FGRV9JTlRFR0VSIDogbGVuZ3RoO1xuICByZXR1cm4gdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8IGxlbmd0aDtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgbGVuZ3RoLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGJhc2VkIG9uIFtgVG9MZW5ndGhgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDw9IE1BWF9TQUZFX0lOVEVHRVI7XG59XG5cbi8qKlxuICogQSBmYWxsYmFjayBpbXBsZW1lbnRhdGlvbiBvZiBgT2JqZWN0LmtleXNgIHdoaWNoIGNyZWF0ZXMgYW4gYXJyYXkgb2YgdGhlXG4gKiBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBgb2JqZWN0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqL1xuZnVuY3Rpb24gc2hpbUtleXMob2JqZWN0KSB7XG4gIHZhciBwcm9wcyA9IGtleXNJbihvYmplY3QpLFxuICAgICAgcHJvcHNMZW5ndGggPSBwcm9wcy5sZW5ndGgsXG4gICAgICBsZW5ndGggPSBwcm9wc0xlbmd0aCAmJiBvYmplY3QubGVuZ3RoO1xuXG4gIHZhciBhbGxvd0luZGV4ZXMgPSAhIWxlbmd0aCAmJiBpc0xlbmd0aChsZW5ndGgpICYmXG4gICAgKGlzQXJyYXkob2JqZWN0KSB8fCBpc0FyZ3VtZW50cyhvYmplY3QpKTtcblxuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIHJlc3VsdCA9IFtdO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgcHJvcHNMZW5ndGgpIHtcbiAgICB2YXIga2V5ID0gcHJvcHNbaW5kZXhdO1xuICAgIGlmICgoYWxsb3dJbmRleGVzICYmIGlzSW5kZXgoa2V5LCBsZW5ndGgpKSB8fCBoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwga2V5KSkge1xuICAgICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdCgxKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIC8vIEF2b2lkIGEgVjggSklUIGJ1ZyBpbiBDaHJvbWUgMTktMjAuXG4gIC8vIFNlZSBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MjI5MSBmb3IgbW9yZSBkZXRhaWxzLlxuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIHRoZSBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogTm9uLW9iamVjdCB2YWx1ZXMgYXJlIGNvZXJjZWQgdG8gb2JqZWN0cy4gU2VlIHRoZVxuICogW0VTIHNwZWNdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5rZXlzKVxuICogZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IE9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqIEBleGFtcGxlXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmEgPSAxO1xuICogICB0aGlzLmIgPSAyO1xuICogfVxuICpcbiAqIEZvby5wcm90b3R5cGUuYyA9IDM7XG4gKlxuICogXy5rZXlzKG5ldyBGb28pO1xuICogLy8gPT4gWydhJywgJ2InXSAoaXRlcmF0aW9uIG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICpcbiAqIF8ua2V5cygnaGknKTtcbiAqIC8vID0+IFsnMCcsICcxJ11cbiAqL1xudmFyIGtleXMgPSAhbmF0aXZlS2V5cyA/IHNoaW1LZXlzIDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gIHZhciBDdG9yID0gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3QuY29uc3RydWN0b3I7XG4gIGlmICgodHlwZW9mIEN0b3IgPT0gJ2Z1bmN0aW9uJyAmJiBDdG9yLnByb3RvdHlwZSA9PT0gb2JqZWN0KSB8fFxuICAgICAgKHR5cGVvZiBvYmplY3QgIT0gJ2Z1bmN0aW9uJyAmJiBpc0FycmF5TGlrZShvYmplY3QpKSkge1xuICAgIHJldHVybiBzaGltS2V5cyhvYmplY3QpO1xuICB9XG4gIHJldHVybiBpc09iamVjdChvYmplY3QpID8gbmF0aXZlS2V5cyhvYmplY3QpIDogW107XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgdGhlIG93biBhbmQgaW5oZXJpdGVkIGVudW1lcmFibGUgcHJvcGVydHkgbmFtZXMgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIE5vbi1vYmplY3QgdmFsdWVzIGFyZSBjb2VyY2VkIHRvIG9iamVjdHMuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBPYmplY3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgYXJyYXkgb2YgcHJvcGVydHkgbmFtZXMuXG4gKiBAZXhhbXBsZVxuICpcbiAqIGZ1bmN0aW9uIEZvbygpIHtcbiAqICAgdGhpcy5hID0gMTtcbiAqICAgdGhpcy5iID0gMjtcbiAqIH1cbiAqXG4gKiBGb28ucHJvdG90eXBlLmMgPSAzO1xuICpcbiAqIF8ua2V5c0luKG5ldyBGb28pO1xuICogLy8gPT4gWydhJywgJ2InLCAnYyddIChpdGVyYXRpb24gb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gKi9cbmZ1bmN0aW9uIGtleXNJbihvYmplY3QpIHtcbiAgaWYgKG9iamVjdCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG4gIGlmICghaXNPYmplY3Qob2JqZWN0KSkge1xuICAgIG9iamVjdCA9IE9iamVjdChvYmplY3QpO1xuICB9XG4gIHZhciBsZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuICBsZW5ndGggPSAobGVuZ3RoICYmIGlzTGVuZ3RoKGxlbmd0aCkgJiZcbiAgICAoaXNBcnJheShvYmplY3QpIHx8IGlzQXJndW1lbnRzKG9iamVjdCkpICYmIGxlbmd0aCkgfHwgMDtcblxuICB2YXIgQ3RvciA9IG9iamVjdC5jb25zdHJ1Y3RvcixcbiAgICAgIGluZGV4ID0gLTEsXG4gICAgICBpc1Byb3RvID0gdHlwZW9mIEN0b3IgPT0gJ2Z1bmN0aW9uJyAmJiBDdG9yLnByb3RvdHlwZSA9PT0gb2JqZWN0LFxuICAgICAgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKSxcbiAgICAgIHNraXBJbmRleGVzID0gbGVuZ3RoID4gMDtcblxuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIHJlc3VsdFtpbmRleF0gPSAoaW5kZXggKyAnJyk7XG4gIH1cbiAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgIGlmICghKHNraXBJbmRleGVzICYmIGlzSW5kZXgoa2V5LCBsZW5ndGgpKSAmJlxuICAgICAgICAhKGtleSA9PSAnY29uc3RydWN0b3InICYmIChpc1Byb3RvIHx8ICFoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwga2V5KSkpKSB7XG4gICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGtleXM7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjEuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xudmFyIGNyZWF0ZVdyYXBwZXIgPSByZXF1aXJlKCdsb2Rhc2guX2NyZWF0ZXdyYXBwZXInKSxcbiAgICByZXBsYWNlSG9sZGVycyA9IHJlcXVpcmUoJ2xvZGFzaC5fcmVwbGFjZWhvbGRlcnMnKSxcbiAgICByZXN0UGFyYW0gPSByZXF1aXJlKCdsb2Rhc2gucmVzdHBhcmFtJyk7XG5cbi8qKiBVc2VkIHRvIGNvbXBvc2UgYml0bWFza3MgZm9yIHdyYXBwZXIgbWV0YWRhdGEuICovXG52YXIgUEFSVElBTF9GTEFHID0gMzI7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBfLnBhcnRpYWxgIG9yIGBfLnBhcnRpYWxSaWdodGAgZnVuY3Rpb24uXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gZmxhZyBUaGUgcGFydGlhbCBiaXQgZmxhZy5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHBhcnRpYWwgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVBhcnRpYWwoZmxhZykge1xuICB2YXIgcGFydGlhbEZ1bmMgPSByZXN0UGFyYW0oZnVuY3Rpb24oZnVuYywgcGFydGlhbHMpIHtcbiAgICB2YXIgaG9sZGVycyA9IHJlcGxhY2VIb2xkZXJzKHBhcnRpYWxzLCBwYXJ0aWFsRnVuYy5wbGFjZWhvbGRlcik7XG4gICAgcmV0dXJuIGNyZWF0ZVdyYXBwZXIoZnVuYywgZmxhZywgdW5kZWZpbmVkLCBwYXJ0aWFscywgaG9sZGVycyk7XG4gIH0pO1xuICByZXR1cm4gcGFydGlhbEZ1bmM7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaW52b2tlcyBgZnVuY2Agd2l0aCBgcGFydGlhbGAgYXJndW1lbnRzIHByZXBlbmRlZFxuICogdG8gdGhvc2UgcHJvdmlkZWQgdG8gdGhlIG5ldyBmdW5jdGlvbi4gVGhpcyBtZXRob2QgaXMgbGlrZSBgXy5iaW5kYCBleGNlcHRcbiAqIGl0IGRvZXMgKipub3QqKiBhbHRlciB0aGUgYHRoaXNgIGJpbmRpbmcuXG4gKlxuICogVGhlIGBfLnBhcnRpYWwucGxhY2Vob2xkZXJgIHZhbHVlLCB3aGljaCBkZWZhdWx0cyB0byBgX2AgaW4gbW9ub2xpdGhpY1xuICogYnVpbGRzLCBtYXkgYmUgdXNlZCBhcyBhIHBsYWNlaG9sZGVyIGZvciBwYXJ0aWFsbHkgYXBwbGllZCBhcmd1bWVudHMuXG4gKlxuICogKipOb3RlOioqIFRoaXMgbWV0aG9kIGRvZXMgbm90IHNldCB0aGUgXCJsZW5ndGhcIiBwcm9wZXJ0eSBvZiBwYXJ0aWFsbHlcbiAqIGFwcGxpZWQgZnVuY3Rpb25zLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgRnVuY3Rpb25cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHBhcnRpYWxseSBhcHBseSBhcmd1bWVudHMgdG8uXG4gKiBAcGFyYW0gey4uLip9IFtwYXJ0aWFsc10gVGhlIGFyZ3VtZW50cyB0byBiZSBwYXJ0aWFsbHkgYXBwbGllZC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHBhcnRpYWxseSBhcHBsaWVkIGZ1bmN0aW9uLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgZ3JlZXQgPSBmdW5jdGlvbihncmVldGluZywgbmFtZSkge1xuICogICByZXR1cm4gZ3JlZXRpbmcgKyAnICcgKyBuYW1lO1xuICogfTtcbiAqXG4gKiB2YXIgc2F5SGVsbG9UbyA9IF8ucGFydGlhbChncmVldCwgJ2hlbGxvJyk7XG4gKiBzYXlIZWxsb1RvKCdmcmVkJyk7XG4gKiAvLyA9PiAnaGVsbG8gZnJlZCdcbiAqXG4gKiAvLyB1c2luZyBwbGFjZWhvbGRlcnNcbiAqIHZhciBncmVldEZyZWQgPSBfLnBhcnRpYWwoZ3JlZXQsIF8sICdmcmVkJyk7XG4gKiBncmVldEZyZWQoJ2hpJyk7XG4gKiAvLyA9PiAnaGkgZnJlZCdcbiAqL1xudmFyIHBhcnRpYWwgPSBjcmVhdGVQYXJ0aWFsKFBBUlRJQUxfRkxBRyk7XG5cbi8vIEFzc2lnbiBkZWZhdWx0IHBsYWNlaG9sZGVycy5cbnBhcnRpYWwucGxhY2Vob2xkZXIgPSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBwYXJ0aWFsO1xuIiwiLyoqXG4gKiBsb2Rhc2ggKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCBqUXVlcnkgRm91bmRhdGlvbiBhbmQgb3RoZXIgY29udHJpYnV0b3JzIDxodHRwczovL2pxdWVyeS5vcmcvPlxuICogUmVsZWFzZWQgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICovXG5cbi8qKiBVc2VkIGFzIHJlZmVyZW5jZXMgZm9yIHZhcmlvdXMgYE51bWJlcmAgY29uc3RhbnRzLiAqL1xudmFyIE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxLFxuICAgIE5BTiA9IDAgLyAwO1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgZnVuY1RhZyA9ICdbb2JqZWN0IEZ1bmN0aW9uXScsXG4gICAgZ2VuVGFnID0gJ1tvYmplY3QgR2VuZXJhdG9yRnVuY3Rpb25dJyxcbiAgICBzeW1ib2xUYWcgPSAnW29iamVjdCBTeW1ib2xdJztcblxuLyoqIFVzZWQgdG8gbWF0Y2ggbGVhZGluZyBhbmQgdHJhaWxpbmcgd2hpdGVzcGFjZS4gKi9cbnZhciByZVRyaW0gPSAvXlxccyt8XFxzKyQvZztcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGJhZCBzaWduZWQgaGV4YWRlY2ltYWwgc3RyaW5nIHZhbHVlcy4gKi9cbnZhciByZUlzQmFkSGV4ID0gL15bLStdMHhbMC05YS1mXSskL2k7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBiaW5hcnkgc3RyaW5nIHZhbHVlcy4gKi9cbnZhciByZUlzQmluYXJ5ID0gL14wYlswMV0rJC9pO1xuXG4vKiogVXNlZCB0byBkZXRlY3Qgb2N0YWwgc3RyaW5nIHZhbHVlcy4gKi9cbnZhciByZUlzT2N0YWwgPSAvXjBvWzAtN10rJC9pO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgdW5zaWduZWQgaW50ZWdlciB2YWx1ZXMuICovXG52YXIgcmVJc1VpbnQgPSAvXig/OjB8WzEtOV1cXGQqKSQvO1xuXG4vKiogQnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMgd2l0aG91dCBhIGRlcGVuZGVuY3kgb24gYHJvb3RgLiAqL1xudmFyIGZyZWVQYXJzZUludCA9IHBhcnNlSW50O1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnByb3BlcnR5YCB3aXRob3V0IHN1cHBvcnQgZm9yIGRlZXAgcGF0aHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgcHJvcGVydHkgdG8gZ2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgYWNjZXNzb3IgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGJhc2VQcm9wZXJ0eShrZXkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICB9O1xufVxuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGVcbiAqIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyogQnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMgZm9yIHRob3NlIHdpdGggdGhlIHNhbWUgbmFtZSBhcyBvdGhlciBgbG9kYXNoYCBtZXRob2RzLiAqL1xudmFyIG5hdGl2ZUNlaWwgPSBNYXRoLmNlaWwsXG4gICAgbmF0aXZlTWF4ID0gTWF0aC5tYXg7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8ucmFuZ2VgIGFuZCBgXy5yYW5nZVJpZ2h0YCB3aGljaCBkb2Vzbid0XG4gKiBjb2VyY2UgYXJndW1lbnRzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge251bWJlcn0gc3RhcnQgVGhlIHN0YXJ0IG9mIHRoZSByYW5nZS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBlbmQgVGhlIGVuZCBvZiB0aGUgcmFuZ2UuXG4gKiBAcGFyYW0ge251bWJlcn0gc3RlcCBUaGUgdmFsdWUgdG8gaW5jcmVtZW50IG9yIGRlY3JlbWVudCBieS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW2Zyb21SaWdodF0gU3BlY2lmeSBpdGVyYXRpbmcgZnJvbSByaWdodCB0byBsZWZ0LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSByYW5nZSBvZiBudW1iZXJzLlxuICovXG5mdW5jdGlvbiBiYXNlUmFuZ2Uoc3RhcnQsIGVuZCwgc3RlcCwgZnJvbVJpZ2h0KSB7XG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgbGVuZ3RoID0gbmF0aXZlTWF4KG5hdGl2ZUNlaWwoKGVuZCAtIHN0YXJ0KSAvIChzdGVwIHx8IDEpKSwgMCksXG4gICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpO1xuXG4gIHdoaWxlIChsZW5ndGgtLSkge1xuICAgIHJlc3VsdFtmcm9tUmlnaHQgPyBsZW5ndGggOiArK2luZGV4XSA9IHN0YXJ0O1xuICAgIHN0YXJ0ICs9IHN0ZXA7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYF8ucmFuZ2VgIG9yIGBfLnJhbmdlUmlnaHRgIGZ1bmN0aW9uLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtmcm9tUmlnaHRdIFNwZWNpZnkgaXRlcmF0aW5nIGZyb20gcmlnaHQgdG8gbGVmdC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHJhbmdlIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVSYW5nZShmcm9tUmlnaHQpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHN0YXJ0LCBlbmQsIHN0ZXApIHtcbiAgICBpZiAoc3RlcCAmJiB0eXBlb2Ygc3RlcCAhPSAnbnVtYmVyJyAmJiBpc0l0ZXJhdGVlQ2FsbChzdGFydCwgZW5kLCBzdGVwKSkge1xuICAgICAgZW5kID0gc3RlcCA9IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgLy8gRW5zdXJlIHRoZSBzaWduIG9mIGAtMGAgaXMgcHJlc2VydmVkLlxuICAgIHN0YXJ0ID0gdG9OdW1iZXIoc3RhcnQpO1xuICAgIHN0YXJ0ID0gc3RhcnQgPT09IHN0YXJ0ID8gc3RhcnQgOiAwO1xuICAgIGlmIChlbmQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZW5kID0gc3RhcnQ7XG4gICAgICBzdGFydCA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVuZCA9IHRvTnVtYmVyKGVuZCkgfHwgMDtcbiAgICB9XG4gICAgc3RlcCA9IHN0ZXAgPT09IHVuZGVmaW5lZCA/IChzdGFydCA8IGVuZCA/IDEgOiAtMSkgOiAodG9OdW1iZXIoc3RlcCkgfHwgMCk7XG4gICAgcmV0dXJuIGJhc2VSYW5nZShzdGFydCwgZW5kLCBzdGVwLCBmcm9tUmlnaHQpO1xuICB9O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIFwibGVuZ3RoXCIgcHJvcGVydHkgdmFsdWUgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCB0byBhdm9pZCBhXG4gKiBbSklUIGJ1Z10oaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE0Mjc5MikgdGhhdCBhZmZlY3RzXG4gKiBTYWZhcmkgb24gYXQgbGVhc3QgaU9TIDguMS04LjMgQVJNNjQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBcImxlbmd0aFwiIHZhbHVlLlxuICovXG52YXIgZ2V0TGVuZ3RoID0gYmFzZVByb3BlcnR5KCdsZW5ndGgnKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgaW5kZXguXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHBhcmFtIHtudW1iZXJ9IFtsZW5ndGg9TUFYX1NBRkVfSU5URUdFUl0gVGhlIHVwcGVyIGJvdW5kcyBvZiBhIHZhbGlkIGluZGV4LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBpbmRleCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0luZGV4KHZhbHVlLCBsZW5ndGgpIHtcbiAgbGVuZ3RoID0gbGVuZ3RoID09IG51bGwgPyBNQVhfU0FGRV9JTlRFR0VSIDogbGVuZ3RoO1xuICByZXR1cm4gISFsZW5ndGggJiZcbiAgICAodHlwZW9mIHZhbHVlID09ICdudW1iZXInIHx8IHJlSXNVaW50LnRlc3QodmFsdWUpKSAmJlxuICAgICh2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDwgbGVuZ3RoKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIGdpdmVuIGFyZ3VtZW50cyBhcmUgZnJvbSBhbiBpdGVyYXRlZSBjYWxsLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSBwb3RlbnRpYWwgaXRlcmF0ZWUgdmFsdWUgYXJndW1lbnQuXG4gKiBAcGFyYW0geyp9IGluZGV4IFRoZSBwb3RlbnRpYWwgaXRlcmF0ZWUgaW5kZXggb3Iga2V5IGFyZ3VtZW50LlxuICogQHBhcmFtIHsqfSBvYmplY3QgVGhlIHBvdGVudGlhbCBpdGVyYXRlZSBvYmplY3QgYXJndW1lbnQuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGFyZ3VtZW50cyBhcmUgZnJvbSBhbiBpdGVyYXRlZSBjYWxsLFxuICogIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNJdGVyYXRlZUNhbGwodmFsdWUsIGluZGV4LCBvYmplY3QpIHtcbiAgaWYgKCFpc09iamVjdChvYmplY3QpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHZhciB0eXBlID0gdHlwZW9mIGluZGV4O1xuICBpZiAodHlwZSA9PSAnbnVtYmVyJ1xuICAgICAgICA/IChpc0FycmF5TGlrZShvYmplY3QpICYmIGlzSW5kZXgoaW5kZXgsIG9iamVjdC5sZW5ndGgpKVxuICAgICAgICA6ICh0eXBlID09ICdzdHJpbmcnICYmIGluZGV4IGluIG9iamVjdClcbiAgICAgICkge1xuICAgIHJldHVybiBlcShvYmplY3RbaW5kZXhdLCB2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIFBlcmZvcm1zIGFcbiAqIFtgU2FtZVZhbHVlWmVyb2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXNhbWV2YWx1ZXplcm8pXG4gKiBjb21wYXJpc29uIGJldHdlZW4gdHdvIHZhbHVlcyB0byBkZXRlcm1pbmUgaWYgdGhleSBhcmUgZXF1aXZhbGVudC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDQuMC4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY29tcGFyZS5cbiAqIEBwYXJhbSB7Kn0gb3RoZXIgVGhlIG90aGVyIHZhbHVlIHRvIGNvbXBhcmUuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhbHVlcyBhcmUgZXF1aXZhbGVudCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgb2JqZWN0ID0geyAnYSc6IDEgfTtcbiAqIHZhciBvdGhlciA9IHsgJ2EnOiAxIH07XG4gKlxuICogXy5lcShvYmplY3QsIG9iamVjdCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5lcShvYmplY3QsIG90aGVyKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5lcSgnYScsICdhJyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5lcSgnYScsIE9iamVjdCgnYScpKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5lcShOYU4sIE5hTik7XG4gKiAvLyA9PiB0cnVlXG4gKi9cbmZ1bmN0aW9uIGVxKHZhbHVlLCBvdGhlcikge1xuICByZXR1cm4gdmFsdWUgPT09IG90aGVyIHx8ICh2YWx1ZSAhPT0gdmFsdWUgJiYgb3RoZXIgIT09IG90aGVyKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLiBBIHZhbHVlIGlzIGNvbnNpZGVyZWQgYXJyYXktbGlrZSBpZiBpdCdzXG4gKiBub3QgYSBmdW5jdGlvbiBhbmQgaGFzIGEgYHZhbHVlLmxlbmd0aGAgdGhhdCdzIGFuIGludGVnZXIgZ3JlYXRlciB0aGFuIG9yXG4gKiBlcXVhbCB0byBgMGAgYW5kIGxlc3MgdGhhbiBvciBlcXVhbCB0byBgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJgLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgNC4wLjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FycmF5TGlrZShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoZG9jdW1lbnQuYm9keS5jaGlsZHJlbik7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZSgnYWJjJyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZShfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcnJheUxpa2UodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiYgaXNMZW5ndGgoZ2V0TGVuZ3RoKHZhbHVlKSkgJiYgIWlzRnVuY3Rpb24odmFsdWUpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgRnVuY3Rpb25gIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDAuMS4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIGZ1bmN0aW9uLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNGdW5jdGlvbihfKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oL2FiYy8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZSkge1xuICAvLyBUaGUgdXNlIG9mIGBPYmplY3QjdG9TdHJpbmdgIGF2b2lkcyBpc3N1ZXMgd2l0aCB0aGUgYHR5cGVvZmAgb3BlcmF0b3JcbiAgLy8gaW4gU2FmYXJpIDggd2hpY2ggcmV0dXJucyAnb2JqZWN0JyBmb3IgdHlwZWQgYXJyYXkgYW5kIHdlYWsgbWFwIGNvbnN0cnVjdG9ycyxcbiAgLy8gYW5kIFBoYW50b21KUyAxLjkgd2hpY2ggcmV0dXJucyAnZnVuY3Rpb24nIGZvciBgTm9kZUxpc3RgIGluc3RhbmNlcy5cbiAgdmFyIHRhZyA9IGlzT2JqZWN0KHZhbHVlKSA/IG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpIDogJyc7XG4gIHJldHVybiB0YWcgPT0gZnVuY1RhZyB8fCB0YWcgPT0gZ2VuVGFnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgbG9vc2VseSBiYXNlZCBvblxuICogW2BUb0xlbmd0aGBdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXRvbGVuZ3RoKS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDQuMC4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCxcbiAqICBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNMZW5ndGgoMyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0xlbmd0aChOdW1iZXIuTUlOX1ZBTFVFKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0xlbmd0aChJbmZpbml0eSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNMZW5ndGgoJzMnKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzTGVuZ3RoKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgJiZcbiAgICB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDw9IE1BWF9TQUZFX0lOVEVHRVI7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlXG4gKiBbbGFuZ3VhZ2UgdHlwZV0oaHR0cDovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLWVjbWFzY3JpcHQtbGFuZ3VhZ2UtdHlwZXMpXG4gKiBvZiBgT2JqZWN0YC4gKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSAwLjEuMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KF8ubm9vcCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLiBBIHZhbHVlIGlzIG9iamVjdC1saWtlIGlmIGl0J3Mgbm90IGBudWxsYFxuICogYW5kIGhhcyBhIGB0eXBlb2ZgIHJlc3VsdCBvZiBcIm9iamVjdFwiLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgNC4wLjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKG51bGwpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3RMaWtlKHZhbHVlKSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYFN5bWJvbGAgcHJpbWl0aXZlIG9yIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDQuMC4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHN5bWJvbCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzU3ltYm9sKFN5bWJvbC5pdGVyYXRvcik7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc1N5bWJvbCgnYWJjJyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1N5bWJvbCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdzeW1ib2wnIHx8XG4gICAgKGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgb2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gc3ltYm9sVGFnKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBgdmFsdWVgIHRvIGEgbnVtYmVyLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgNC4wLjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBwcm9jZXNzLlxuICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgbnVtYmVyLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLnRvTnVtYmVyKDMuMik7XG4gKiAvLyA9PiAzLjJcbiAqXG4gKiBfLnRvTnVtYmVyKE51bWJlci5NSU5fVkFMVUUpO1xuICogLy8gPT4gNWUtMzI0XG4gKlxuICogXy50b051bWJlcihJbmZpbml0eSk7XG4gKiAvLyA9PiBJbmZpbml0eVxuICpcbiAqIF8udG9OdW1iZXIoJzMuMicpO1xuICogLy8gPT4gMy4yXG4gKi9cbmZ1bmN0aW9uIHRvTnVtYmVyKHZhbHVlKSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgaWYgKGlzU3ltYm9sKHZhbHVlKSkge1xuICAgIHJldHVybiBOQU47XG4gIH1cbiAgaWYgKGlzT2JqZWN0KHZhbHVlKSkge1xuICAgIHZhciBvdGhlciA9IGlzRnVuY3Rpb24odmFsdWUudmFsdWVPZikgPyB2YWx1ZS52YWx1ZU9mKCkgOiB2YWx1ZTtcbiAgICB2YWx1ZSA9IGlzT2JqZWN0KG90aGVyKSA/IChvdGhlciArICcnKSA6IG90aGVyO1xuICB9XG4gIGlmICh0eXBlb2YgdmFsdWUgIT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IDAgPyB2YWx1ZSA6ICt2YWx1ZTtcbiAgfVxuICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UocmVUcmltLCAnJyk7XG4gIHZhciBpc0JpbmFyeSA9IHJlSXNCaW5hcnkudGVzdCh2YWx1ZSk7XG4gIHJldHVybiAoaXNCaW5hcnkgfHwgcmVJc09jdGFsLnRlc3QodmFsdWUpKVxuICAgID8gZnJlZVBhcnNlSW50KHZhbHVlLnNsaWNlKDIpLCBpc0JpbmFyeSA/IDIgOiA4KVxuICAgIDogKHJlSXNCYWRIZXgudGVzdCh2YWx1ZSkgPyBOQU4gOiArdmFsdWUpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgbnVtYmVycyAocG9zaXRpdmUgYW5kL29yIG5lZ2F0aXZlKSBwcm9ncmVzc2luZyBmcm9tXG4gKiBgc3RhcnRgIHVwIHRvLCBidXQgbm90IGluY2x1ZGluZywgYGVuZGAuIEEgc3RlcCBvZiBgLTFgIGlzIHVzZWQgaWYgYSBuZWdhdGl2ZVxuICogYHN0YXJ0YCBpcyBzcGVjaWZpZWQgd2l0aG91dCBhbiBgZW5kYCBvciBgc3RlcGAuIElmIGBlbmRgIGlzIG5vdCBzcGVjaWZpZWQsXG4gKiBpdCdzIHNldCB0byBgc3RhcnRgIHdpdGggYHN0YXJ0YCB0aGVuIHNldCB0byBgMGAuXG4gKlxuICogKipOb3RlOioqIEphdmFTY3JpcHQgZm9sbG93cyB0aGUgSUVFRS03NTQgc3RhbmRhcmQgZm9yIHJlc29sdmluZ1xuICogZmxvYXRpbmctcG9pbnQgdmFsdWVzIHdoaWNoIGNhbiBwcm9kdWNlIHVuZXhwZWN0ZWQgcmVzdWx0cy5cbiAqXG4gKiBAc3RhdGljXG4gKiBAc2luY2UgMC4xLjBcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgVXRpbFxuICogQHBhcmFtIHtudW1iZXJ9IFtzdGFydD0wXSBUaGUgc3RhcnQgb2YgdGhlIHJhbmdlLlxuICogQHBhcmFtIHtudW1iZXJ9IGVuZCBUaGUgZW5kIG9mIHRoZSByYW5nZS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbc3RlcD0xXSBUaGUgdmFsdWUgdG8gaW5jcmVtZW50IG9yIGRlY3JlbWVudCBieS5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgcmFuZ2Ugb2YgbnVtYmVycy5cbiAqIEBzZWUgXy5pblJhbmdlLCBfLnJhbmdlUmlnaHRcbiAqIEBleGFtcGxlXG4gKlxuICogXy5yYW5nZSg0KTtcbiAqIC8vID0+IFswLCAxLCAyLCAzXVxuICpcbiAqIF8ucmFuZ2UoLTQpO1xuICogLy8gPT4gWzAsIC0xLCAtMiwgLTNdXG4gKlxuICogXy5yYW5nZSgxLCA1KTtcbiAqIC8vID0+IFsxLCAyLCAzLCA0XVxuICpcbiAqIF8ucmFuZ2UoMCwgMjAsIDUpO1xuICogLy8gPT4gWzAsIDUsIDEwLCAxNV1cbiAqXG4gKiBfLnJhbmdlKDAsIC00LCAtMSk7XG4gKiAvLyA9PiBbMCwgLTEsIC0yLCAtM11cbiAqXG4gKiBfLnJhbmdlKDEsIDQsIDApO1xuICogLy8gPT4gWzEsIDEsIDFdXG4gKlxuICogXy5yYW5nZSgwKTtcbiAqIC8vID0+IFtdXG4gKi9cbnZhciByYW5nZSA9IGNyZWF0ZVJhbmdlKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gcmFuZ2U7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjYuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogVXNlZCBhcyB0aGUgYFR5cGVFcnJvcmAgbWVzc2FnZSBmb3IgXCJGdW5jdGlvbnNcIiBtZXRob2RzLiAqL1xudmFyIEZVTkNfRVJST1JfVEVYVCA9ICdFeHBlY3RlZCBhIGZ1bmN0aW9uJztcblxuLyogTmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVNYXggPSBNYXRoLm1heDtcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIGBmdW5jYCB3aXRoIHRoZSBgdGhpc2AgYmluZGluZyBvZiB0aGVcbiAqIGNyZWF0ZWQgZnVuY3Rpb24gYW5kIGFyZ3VtZW50cyBmcm9tIGBzdGFydGAgYW5kIGJleW9uZCBwcm92aWRlZCBhcyBhbiBhcnJheS5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBtZXRob2QgaXMgYmFzZWQgb24gdGhlIFtyZXN0IHBhcmFtZXRlcl0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvRnVuY3Rpb25zL3Jlc3RfcGFyYW1ldGVycykuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBGdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gYXBwbHkgYSByZXN0IHBhcmFtZXRlciB0by5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbc3RhcnQ9ZnVuYy5sZW5ndGgtMV0gVGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoZSByZXN0IHBhcmFtZXRlci5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgc2F5ID0gXy5yZXN0UGFyYW0oZnVuY3Rpb24od2hhdCwgbmFtZXMpIHtcbiAqICAgcmV0dXJuIHdoYXQgKyAnICcgKyBfLmluaXRpYWwobmFtZXMpLmpvaW4oJywgJykgK1xuICogICAgIChfLnNpemUobmFtZXMpID4gMSA/ICcsICYgJyA6ICcnKSArIF8ubGFzdChuYW1lcyk7XG4gKiB9KTtcbiAqXG4gKiBzYXkoJ2hlbGxvJywgJ2ZyZWQnLCAnYmFybmV5JywgJ3BlYmJsZXMnKTtcbiAqIC8vID0+ICdoZWxsbyBmcmVkLCBiYXJuZXksICYgcGViYmxlcydcbiAqL1xuZnVuY3Rpb24gcmVzdFBhcmFtKGZ1bmMsIHN0YXJ0KSB7XG4gIGlmICh0eXBlb2YgZnVuYyAhPSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihGVU5DX0VSUk9SX1RFWFQpO1xuICB9XG4gIHN0YXJ0ID0gbmF0aXZlTWF4KHN0YXJ0ID09PSB1bmRlZmluZWQgPyAoZnVuYy5sZW5ndGggLSAxKSA6ICgrc3RhcnQgfHwgMCksIDApO1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IG5hdGl2ZU1heChhcmdzLmxlbmd0aCAtIHN0YXJ0LCAwKSxcbiAgICAgICAgcmVzdCA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgcmVzdFtpbmRleF0gPSBhcmdzW3N0YXJ0ICsgaW5kZXhdO1xuICAgIH1cbiAgICBzd2l0Y2ggKHN0YXJ0KSB7XG4gICAgICBjYXNlIDA6IHJldHVybiBmdW5jLmNhbGwodGhpcywgcmVzdCk7XG4gICAgICBjYXNlIDE6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJnc1swXSwgcmVzdCk7XG4gICAgICBjYXNlIDI6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJnc1swXSwgYXJnc1sxXSwgcmVzdCk7XG4gICAgfVxuICAgIHZhciBvdGhlckFyZ3MgPSBBcnJheShzdGFydCArIDEpO1xuICAgIGluZGV4ID0gLTE7XG4gICAgd2hpbGUgKCsraW5kZXggPCBzdGFydCkge1xuICAgICAgb3RoZXJBcmdzW2luZGV4XSA9IGFyZ3NbaW5kZXhdO1xuICAgIH1cbiAgICBvdGhlckFyZ3Nbc3RhcnRdID0gcmVzdDtcbiAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBvdGhlckFyZ3MpO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlc3RQYXJhbTtcbiIsIi8vIFB1YmxpYyBBUEkvbm9kZS1tb2R1bGUgZm9yIHRoZSBQdXNoXG5cbmNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgQnV0dG9ucyA9IHJlcXVpcmUoJy4vc3JjL2J1dHRvbnMuanMnKSxcbiAgICBLbm9icyA9IHJlcXVpcmUoJy4vc3JjL2tub2JzJyksXG4gICAgR3JpZCA9IHJlcXVpcmUoJy4vc3JjL2dyaWQuanMnKSxcbiAgICBUb3VjaHN0cmlwID0gcmVxdWlyZSgnLi9zcmMvdG91Y2hzdHJpcC5qcycpLFxuICAgIENvbnRyb2xCdXR0b25zID0gcmVxdWlyZSgnLi9zcmMvY29udHJvbC1idXR0b25zLmpzJyksXG4gICAgTENEcyA9IHJlcXVpcmUoJy4vc3JjL2xjZHMuanMnKSxcbiAgICBmb3JlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKSxcbiAgICBwYXJ0aWFsID0gcmVxdWlyZSgnbG9kYXNoLnBhcnRpYWwnKSxcbiAgICBvbmVfdG9fZWlnaHQgPSBbMSwgMiwgMywgNCwgNSwgNiwgNywgOF07XG5cbmZ1bmN0aW9uIFB1c2gobWlkaV9vdXRfcG9ydCkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuXG4gICAgdmFyIG1pZGlfb3V0ID0ge1xuICAgICAgICBzZW5kX2NjOiBmdW5jdGlvbihjYywgdmFsdWUpIHsgbWlkaV9vdXRfcG9ydC5zZW5kKFsxNzYsIGNjLCB2YWx1ZV0pIH0sXG4gICAgICAgIHNlbmRfbm90ZTogZnVuY3Rpb24obm90ZSwgdmVsb2NpdHkpIHsgbWlkaV9vdXRfcG9ydC5zZW5kKFsxNDQsIG5vdGUsIHZlbG9jaXR5XSkgfSxcbiAgICAgICAgc2VuZF9zeXNleDogZnVuY3Rpb24oZGF0YSkgeyBtaWRpX291dF9wb3J0LnNlbmQoWzI0MCwgNzEsIDEyNywgMjFdLmNvbmNhdChkYXRhKS5jb25jYXQoWzI0N10pKSB9XG4gICAgfVxuXG4gICAgY29uc3QgYnV0dG9ucyA9IG5ldyBCdXR0b25zKG1pZGlfb3V0LnNlbmRfY2MpO1xuICAgIHRoaXMua25vYnMgPSBuZXcgS25vYnMoKTtcbiAgICB0aGlzLmdyaWQgPSBuZXcgR3JpZChtaWRpX291dC5zZW5kX25vdGUsIG1pZGlfb3V0LnNlbmRfY2MsIG1pZGlfb3V0LnNlbmRfc3lzZXgpO1xuICAgIHRoaXMudG91Y2hzdHJpcCA9IG5ldyBUb3VjaHN0cmlwKCk7XG4gICAgdGhpcy5jb250cm9sID0gbmV3IENvbnRyb2xCdXR0b25zKG1pZGlfb3V0LnNlbmRfY2MpO1xuICAgIHRoaXMuY2NNYXAgPSBbXTtcbiAgICB0aGlzLm5vdGVNYXAgPSBbXTtcblxuICAgIGZvcmVhY2goXG4gICAgICAgIFt0aGlzLmtub2JzLCB0aGlzLnRvdWNoc3RyaXAsIHRoaXMuZ3JpZF0sXG4gICAgICAgIChtb2R1bGUpID0+IGZvcmVhY2gobW9kdWxlLmhhbmRsZWRfbm90ZXMsICh2YWx1ZSwga2V5KSA9PiB0aGlzLm5vdGVNYXBbdmFsdWVdID0gbW9kdWxlKVxuICAgICk7XG5cbiAgICBmb3JlYWNoKFxuICAgICAgICBbdGhpcy5rbm9icywgdGhpcy5jb250cm9sLCBidXR0b25zLCB0aGlzLmdyaWRdLFxuICAgICAgICAobW9kdWxlKSA9PiBmb3JlYWNoKG1vZHVsZS5oYW5kbGVkX2NjcywgKHZhbHVlLCBrZXkpID0+IHRoaXMuY2NNYXBbdmFsdWVdID0gbW9kdWxlKVxuICAgICk7XG5cbiAgICAvLyBEZWZpbmVzIHB1YmxpYyBBUEkgcmV0dXJuZWRcbiAgICBjb25zdCBhcGkgPSB7XG4gICAgICAgIGtub2I6IHtcbiAgICAgICAgICAgIHRlbXBvOiB0aGlzLmtub2JzLnRlbXBvLFxuICAgICAgICAgICAgc3dpbmc6IHRoaXMua25vYnMuc3dpbmcsXG4gICAgICAgICAgICBtYXN0ZXI6IHRoaXMua25vYnMubWFzdGVyLFxuICAgICAgICB9LFxuICAgICAgICBncmlkOiB7IHg6IHt9fSxcbiAgICAgICAgdG91Y2hzdHJpcDogdGhpcy50b3VjaHN0cmlwLFxuICAgICAgICBsY2Q6IG5ldyBMQ0RzKG1pZGlfb3V0LnNlbmRfc3lzZXgpLFxuICAgICAgICBidXR0b246IHtcbiAgICAgICAgICAgICcxLzMydCc6IHRoaXMuY29udHJvbFsnMS8zMnQnXSxcbiAgICAgICAgICAgICcxLzMyJzogdGhpcy5jb250cm9sWycxLzMyJ10sXG4gICAgICAgICAgICAnMS8xNnQnOiB0aGlzLmNvbnRyb2xbJzEvMTZ0J10sXG4gICAgICAgICAgICAnMS8xNic6IHRoaXMuY29udHJvbFsnMS8xNiddLFxuICAgICAgICAgICAgJzEvOHQnOiB0aGlzLmNvbnRyb2xbJzEvOHQnXSxcbiAgICAgICAgICAgICcxLzgnOiB0aGlzLmNvbnRyb2xbJzEvOCddLFxuICAgICAgICAgICAgJzEvNHQnOiB0aGlzLmNvbnRyb2xbJzEvNHQnXSxcbiAgICAgICAgICAgICcxLzQnOiB0aGlzLmNvbnRyb2xbJzEvNCddLFxuICAgICAgICB9LFxuICAgICAgICBjaGFubmVsOiB7fSxcbiAgICAgICAgcmVjZWl2ZV9taWRpOiBwYXJ0aWFsKHJlY2VpdmVfbWlkaSwgdGhpcyksXG4gICAgfVxuICAgIGZvcmVhY2goXG4gICAgICAgIG9uZV90b19laWdodCxcbiAgICAgICAgKG51bWJlcikgPT4gYXBpLmNoYW5uZWxbbnVtYmVyXSA9IHsga25vYjogdGhpcy5rbm9ic1tudW1iZXJdLCBzZWxlY3Q6IHRoaXMuY29udHJvbFtudW1iZXJdIH1cbiAgICApO1xuICAgIGZvcmVhY2goXG4gICAgICAgIG9uZV90b19laWdodCxcbiAgICAgICAgKFgpID0+IHtcbiAgICAgICAgICAgIGFwaS5ncmlkLnhbWF0gPSB7IHk6IHt9LCBzZWxlY3Q6IHRoaXMuZ3JpZC5zZWxlY3RbWF0sIH07XG4gICAgICAgICAgICBmb3JlYWNoKG9uZV90b19laWdodCwgKFkpID0+IHtcbiAgICAgICAgICAgICAgICBhcGkuZ3JpZC54W1hdLnlbWV0gPSB0aGlzLmdyaWQueFtYXS55W1ldO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICApO1xuICAgIGZvcmVhY2goXG4gICAgICAgIGJ1dHRvbnMubmFtZXMsXG4gICAgICAgIChidXR0b25fbmFtZSkgPT4gYXBpLmJ1dHRvbltidXR0b25fbmFtZV0gPSBidXR0b25zW2J1dHRvbl9uYW1lXVxuICAgIClcbiAgICByZXR1cm4gYXBpO1xufVxudXRpbC5pbmhlcml0cyhQdXNoLCBFdmVudEVtaXR0ZXIpO1xuXG5mdW5jdGlvbiBoYW5kbGVfbWlkaV9jYyhwdXNoLCBpbmRleCwgdmFsdWUpIHtcbiAgICBpZiAoaW5kZXggaW4gcHVzaC5jY01hcCkge1xuICAgICAgICBwdXNoLmNjTWFwW2luZGV4XS5yZWNlaXZlX21pZGlfY2MoaW5kZXgsIHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnTm8ga25vd24gbWFwcGluZyBmb3IgQ0M6ICcgKyBpbmRleCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVfbWlkaV9ub3RlKHB1c2gsIG5vdGUsIHZlbG9jaXR5KSB7XG4gICAgaWYgKG5vdGUgaW4gcHVzaC5ub3RlTWFwKSB7XG4gICAgICAgIHB1c2gubm90ZU1hcFtub3RlXS5yZWNlaXZlX21pZGlfbm90ZShub3RlLCB2ZWxvY2l0eSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ05vIGtub3duIG1hcHBpbmcgZm9yIG5vdGU6ICcgKyBub3RlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZV9taWRpX3BpdGNoX2JlbmQocHVzaCwgbHNiX2J5dGUsIG1zYl9ieXRlKSB7XG4gICAgcHVzaC50b3VjaHN0cmlwLnJlY2VpdmVfbWlkaV9waXRjaF9iZW5kKChtc2JfYnl0ZSA8PCA3KSArIGxzYl9ieXRlKTtcbn1cblxuZnVuY3Rpb24gaGFuZGxlX21pZGlfcG9seV9wcmVzc3VyZShwdXNoLCBub3RlLCBwcmVzc3VyZSkge1xuICAgIHB1c2guZ3JpZC5yZWNlaXZlX21pZGlfcG9seV9wcmVzc3VyZShub3RlLCBwcmVzc3VyZSk7XG59XG5cbnZhciBtaWRpX21lc3NhZ2VzID0ge1xuICAgICdub3RlLW9mZic6IDEyOCwgLy8gbm90ZSBudW1iZXIsIHZlbG9jaXR5XG4gICAgJ25vdGUtb24nOiAxNDQsIC8vIG5vdGUgbnVtYmVyLCB2ZWxvY2l0eVxuICAgICdwb2x5LXByZXNzdXJlJzogMTYwLCAvLyBub3RlIG51bWJlciwgdmVsb2NpdHlcbiAgICAnY2MnOiAxNzYsIC8vIGNjIG51bWJlciwgdmFsdWVcbiAgICAncHJvZ3JhbS1jaGFuZ2UnOiAxOTIsIC8vIHBnbSBudW1iZXJcbiAgICAnY2hhbm5lbC1wcmVzc3VyZSc6IDIwOCwgLy8gdmVsb2NpdHlcbiAgICAncGl0Y2gtYmVuZCc6IDIyNCwgLy8gbHNiICg3LWJpdHMpLCBtc2IgKDctYml0cylcbiAgICAnc3lzZXgnOiAyNDAsIC8vIGlkIFsxIG9yIDMgYnl0ZXNdLCBkYXRhIFtuIGJ5dGVzXSwgMjQ3XG59XG5cbi8vIEhhbmRsZXMgTUlESSAoQ0MpIGRhdGEgZnJvbSBQdXNoIC0gY2F1c2VzIGV2ZW50cyB0byBiZSBlbWl0dGVkXG5mdW5jdGlvbiByZWNlaXZlX21pZGkocHVzaCwgYnl0ZXMpIHtcbiAgICB2YXIgbWVzc2FnZV90eXBlID0gYnl0ZXNbMF0gJiAweGYwO1xuICAgIHZhciBtaWRpX2NoYW5uZWwgPSBieXRlc1swXSAmIDB4MGY7XG5cbiAgICBzd2l0Y2ggKG1lc3NhZ2VfdHlwZSkge1xuICAgICAgICBjYXNlIChtaWRpX21lc3NhZ2VzWydjYyddKTpcbiAgICAgICAgICAgIGhhbmRsZV9taWRpX2NjKHB1c2gsIGJ5dGVzWzFdLCBieXRlc1syXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAobWlkaV9tZXNzYWdlc1snbm90ZS1vbiddKTpcbiAgICAgICAgY2FzZSAobWlkaV9tZXNzYWdlc1snbm90ZS1vZmYnXSk6XG4gICAgICAgICAgICBoYW5kbGVfbWlkaV9ub3RlKHB1c2gsIGJ5dGVzWzFdLCBieXRlc1syXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAobWlkaV9tZXNzYWdlc1sncGl0Y2gtYmVuZCddKTpcbiAgICAgICAgICAgIGhhbmRsZV9taWRpX3BpdGNoX2JlbmQocHVzaCwgYnl0ZXNbMV0sIGJ5dGVzWzJdKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlKG1pZGlfbWVzc2FnZXNbJ3BvbHktcHJlc3N1cmUnXSk6XG4gICAgICAgICAgICBoYW5kbGVfbWlkaV9wb2x5X3ByZXNzdXJlKHB1c2gsIGJ5dGVzWzFdLCBieXRlc1syXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59XG5cbi8vIEFkYXB0b3IgZnVuY3Rpb24gdXNlZCB0byBiaW5kIHRvIHdlYiBNSURJIEFQSVxuUHVzaC5jcmVhdGVfYm91bmRfdG9fd2ViX21pZGlfYXBpID0gZnVuY3Rpb24obWlkaUFjY2Vzcykge1xuICAgIHZhciBpbnB1dHMgPSBtaWRpQWNjZXNzLmlucHV0cy52YWx1ZXMoKSxcbiAgICAgICAgb3V0cHV0cyA9IG1pZGlBY2Nlc3Mub3V0cHV0cy52YWx1ZXMoKSxcbiAgICAgICAgcHVzaDtcblxuICAgIGZvciAodmFyIG91dHB1dCA9IG91dHB1dHMubmV4dCgpOyBvdXRwdXQgJiYgIW91dHB1dC5kb25lOyBvdXRwdXQgPSBvdXRwdXRzLm5leHQoKSkge1xuICAgICAgICBjb25zb2xlLmxvZygnRm91bmQgb3V0cHV0OiAnICsgb3V0cHV0LnZhbHVlLm5hbWUpO1xuICAgICAgICBpZiAoJ0FibGV0b24gUHVzaCBVc2VyIFBvcnQnID09IG91dHB1dC52YWx1ZS5uYW1lKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQmluZGluZyBNSURJIG91dHB1dCB0byAnICsgb3V0cHV0LnZhbHVlLm5hbWUpO1xuICAgICAgICAgICAgcHVzaCA9IG5ldyBQdXNoKG91dHB1dC52YWx1ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwdXNoID09PSB1bmRlZmluZWQpIHB1c2ggPSBuZXcgUHVzaCh7IHNlbmQ6IChieXRlcykgPT4geyAnbm8gaW1wbGVtZW50YXRpb24gYnkgZGVmYXVsdCcgfSB9KTtcblxuICAgIGZvciAodmFyIGlucHV0ID0gaW5wdXRzLm5leHQoKTsgaW5wdXQgJiYgIWlucHV0LmRvbmU7IGlucHV0ID0gaW5wdXRzLm5leHQoKSkge1xuICAgICAgICBjb25zb2xlLmxvZygnRm91bmQgaW5wdXQ6ICcgKyBpbnB1dC52YWx1ZS5uYW1lKTtcbiAgICAgICAgaWYgKCdBYmxldG9uIFB1c2ggVXNlciBQb3J0JyA9PSBpbnB1dC52YWx1ZS5uYW1lKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQmluZGluZyBNSURJIGlucHV0IHRvICcgKyBpbnB1dC52YWx1ZS5uYW1lKTtcbiAgICAgICAgICAgIGlucHV0LnZhbHVlLm9ubWlkaW1lc3NhZ2UgPSAoZXZlbnQpID0+IHsgcHVzaC5yZWNlaXZlX21pZGkoZXZlbnQuZGF0YSkgfTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHB1c2g7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUHVzaDtcbiIsImNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgZm9yZWFjaCA9IHJlcXVpcmUoJ2xvZGFzaC5mb3JlYWNoJyk7XG5cbnZhciBjY1RvQnV0dG9uTWFwID0ge1xuICAgIDM6ICd0YXBfdGVtcG8nLFxuICAgIDk6ICdtZXRyb25vbWUnLFxuICAgIDExOTogJ3VuZG8nLFxuICAgIDExODogJ2RlbGV0ZScsXG4gICAgMTE3OiAnZG91YmxlJyxcbiAgICAxMTY6ICdxdWFudGl6ZScsXG4gICAgOTA6ICdmaXhlZF9sZW5ndGgnLFxuICAgIDg5OiAnYXV0b21hdGlvbicsXG4gICAgODg6ICdkdXBsaWNhdGUnLFxuICAgIDg3OiAnbmV3JyxcbiAgICA4NjogJ3JlYycsXG4gICAgODU6ICdwbGF5JyxcbiAgICAyODogJ21hc3RlcicsXG4gICAgMjk6ICdzdG9wJyxcbiAgICA0NDogJ2xlZnQnLFxuICAgIDQ1OiAncmlnaHQnLFxuICAgIDQ2OiAndXAnLFxuICAgIDQ3OiAnZG93bicsXG4gICAgMTE0OiAndm9sdW1lJyxcbiAgICAxMTU6ICdwYW5fJl9zZW5kJyxcbiAgICAxMTI6ICd0cmFjaycsXG4gICAgMTEzOiAnY2xpcCcsXG4gICAgMTEwOiAnZGV2aWNlJyxcbiAgICAxMTE6ICdicm93c2UnLFxuICAgIDYyOiAnc3RlcF9pbicsXG4gICAgNjM6ICdzdGVwX291dCcsXG4gICAgNjA6ICdtdXRlJyxcbiAgICA2MTogJ3NvbG8nLFxuICAgIDU4OiAnc2NhbGVzJyxcbiAgICA1OTogJ3VzZXInLFxuICAgIDU2OiAncmVwZWF0JyxcbiAgICA1NzogJ2FjY2VudCcsXG4gICAgNTQ6ICdvY3RhdmVfZG93bicsXG4gICAgNTU6ICdvY3RhdmVfdXAnLFxuICAgIDUyOiAnYWRkX2VmZmVjdCcsXG4gICAgNTM6ICdhZGRfdHJhY2snLFxuICAgIDUwOiAnbm90ZScsXG4gICAgNTE6ICdzZXNzaW9uJyxcbiAgICA0ODogJ3NlbGVjdCcsXG4gICAgNDk6ICdzaGlmdCdcbn1cbmNvbnN0IGhhbmRsZWRfY2NzID0gT2JqZWN0LmtleXMoY2NUb0J1dHRvbk1hcCk7XG5cbmZ1bmN0aW9uIEJ1dHRvbihzZW5kX2NjLCBjYykge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIHJldHVybiB7XG4gICAgICAgIGxlZF9vbjogZnVuY3Rpb24oKSB7IHNlbmRfY2MoY2MsIDQpIH0sXG4gICAgICAgIGxlZF9kaW06IGZ1bmN0aW9uKCkgeyBzZW5kX2NjKGNjLCAxKSB9LFxuICAgICAgICBsZWRfb2ZmOiBmdW5jdGlvbigpIHsgc2VuZF9jYyhjYywgMCkgfSxcbiAgICAgICAgcmVkOiAoKSA9PiB7fSxcbiAgICAgICAgb3JhbmdlOiAoKSA9PiB7fSxcbiAgICAgICAgeWVsbG93OiAoKSA9PiB7fSxcbiAgICAgICAgZ3JlZW46ICgpID0+IHt9LFxuICAgICAgICBvbjogdGhpcy5vbixcbiAgICAgICAgZW1pdDogdGhpcy5lbWl0LFxuICAgIH1cbn1cbnV0aWwuaW5oZXJpdHMoQnV0dG9uLCBFdmVudEVtaXR0ZXIpO1xuXG5mdW5jdGlvbiBCdXR0b25zKHNlbmRfY2MpIHtcbiAgICBjb25zdCBidXR0b25zID0gdGhpcztcbiAgICBmb3JlYWNoKGNjVG9CdXR0b25NYXAsICh2YWx1ZSwga2V5KSA9PiB0aGlzW3ZhbHVlXSA9IG5ldyBCdXR0b24oc2VuZF9jYywgcGFyc2VJbnQoa2V5KSkpO1xuICAgIHRoaXMubmFtZXMgPSBPYmplY3Qua2V5cyhjY1RvQnV0dG9uTWFwKS5tYXAoKGtleSkgPT4geyByZXR1cm4gY2NUb0J1dHRvbk1hcFtrZXldIH0pO1xuICAgIHRoaXMucmVjZWl2ZV9taWRpX2NjID0gZnVuY3Rpb24oaW5kZXgsIHZhbHVlKSB7XG4gICAgICAgIGJ1dHRvbnNbY2NUb0J1dHRvbk1hcFtpbmRleF1dLmVtaXQocHJlc3NlZF9vcl9yZWxlYXNlZCh2YWx1ZSkpO1xuICAgIH07XG4gICAgdGhpcy5oYW5kbGVkX2NjcyA9IGhhbmRsZWRfY2NzO1xufVxuXG5mdW5jdGlvbiBwcmVzc2VkX29yX3JlbGVhc2VkKHZlbG9jaXR5KSB7XG4gICAgcmV0dXJuIHBhcnNlSW50KHZlbG9jaXR5KSA+IDAgPyAncHJlc3NlZCcgOiAncmVsZWFzZWQnO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEJ1dHRvbnM7XG4iLCJjb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgndXRpbCcpLFxuICAgIGZvcmVhY2ggPSByZXF1aXJlKCdsb2Rhc2guZm9yZWFjaCcpO1xuXG52YXIgY2NUb1BhZE1hcCA9IHtcbiAgICAyMDogMSwgLy8gdG9wIHJvdyBhYm92ZSBncmlkXG4gICAgMjE6IDIsXG4gICAgMjI6IDMsXG4gICAgMjM6IDQsXG4gICAgMjQ6IDUsXG4gICAgMjU6IDYsXG4gICAgMjY6IDcsXG4gICAgMjc6IDgsXG4gICAgNDM6ICcxLzMydCcsXG4gICAgNDI6ICcxLzMyJyxcbiAgICA0MTogJzEvMTZ0JyxcbiAgICA0MDogJzEvMTYnLFxuICAgIDM5OiAnMS84dCcsXG4gICAgMzg6ICcxLzgnLFxuICAgIDM3OiAnMS80dCcsXG4gICAgMzY6ICcxLzQnLFxufVxuY29uc3QgaGFuZGxlZF9jY3MgPSBPYmplY3Qua2V5cyhjY1RvUGFkTWFwKTtcblxuZnVuY3Rpb24gUGFkKHNlbmRfY2MsIGNjKSB7XG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG4gICAgdGhpcy5vdXRwdXQgPSBmdW5jdGlvbih2YWx1ZSkgeyBzZW5kX2NjKGNjLCB2YWx1ZSkgfTtcbiAgICB2YXIgY29sb3VycyA9IFs3LCAxMF07IC8vIGRpbSwgYnJpZ2h0XG4gICAgdGhpcy5jb2xvdXJzID0gWzcsIDEwXTsgLy8gZGltLCBicmlnaHRcbiAgICByZXR1cm4ge1xuICAgICAgICBsZWRfb246IGZ1bmN0aW9uKCkgeyBzZW5kX2NjKGNjLCBjb2xvdXJzWzFdKSB9LFxuICAgICAgICBsZWRfZGltOiBmdW5jdGlvbigpIHsgc2VuZF9jYyhjYywgY29sb3Vyc1swXSkgfSxcbiAgICAgICAgbGVkX29mZjogZnVuY3Rpb24oKSB7IHNlbmRfY2MoY2MsIDApIH0sXG4gICAgICAgIHJlZDogZnVuY3Rpb24oKSB7IGNvbG91cnMgPSBbMSwgNF0gfSxcbiAgICAgICAgb3JhbmdlOiBmdW5jdGlvbigpIHsgY29sb3VycyA9IFs3LCAxMF0gfSxcbiAgICAgICAgeWVsbG93OiBmdW5jdGlvbigpIHsgY29sb3VycyA9IFsxMywgMTZdIH0sXG4gICAgICAgIGdyZWVuOiBmdW5jdGlvbigpIHsgY29sb3VycyA9IFsxOSwgMjJdIH0sXG4gICAgICAgIG9uOiB0aGlzLm9uLFxuICAgICAgICBlbWl0OiB0aGlzLmVtaXQsXG4gICAgfVxufVxudXRpbC5pbmhlcml0cyhQYWQsIEV2ZW50RW1pdHRlcik7XG5cbmZ1bmN0aW9uIENvbnRyb2xCdXR0b25zKHNlbmRfY2MpIHtcbiAgICBjb25zdCBjb250cm9sX2J1dHRvbnMgPSB0aGlzO1xuICAgIGZvcmVhY2goY2NUb1BhZE1hcCwgKHZhbHVlLCBrZXkpID0+IHRoaXNbdmFsdWVdID0gbmV3IFBhZChzZW5kX2NjLCBwYXJzZUludChrZXkpKSk7XG4gICAgdGhpcy5oYW5kbGVkX2NjcyA9IGhhbmRsZWRfY2NzO1xuICAgIHRoaXMucmVjZWl2ZV9taWRpX2NjID0gZnVuY3Rpb24oY2MsIHZhbHVlKSB7XG4gICAgICAgIHZhciBwYWRfbmFtZSA9IGNjVG9QYWRNYXBbY2NdO1xuICAgICAgICBjb250cm9sX2J1dHRvbnNbcGFkX25hbWVdLmVtaXQodmFsdWUgPiAwID8gJ3ByZXNzZWQnIDogJ3JlbGVhc2VkJyk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbnRyb2xCdXR0b25zO1xuIiwiY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKSxcbiAgICBmb3JlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKSxcbiAgICBwYXJ0aWFsID0gcmVxdWlyZSgnbG9kYXNoLnBhcnRpYWwnKTtcblxuY29uc3QgY29udHJvbF9idXR0b25zID0ge1xuICAgIDEwMjogMSxcbiAgICAxMDM6IDIsXG4gICAgMTA0OiAzLFxuICAgIDEwNTogNCxcbiAgICAxMDY6IDUsXG4gICAgMTA3OiA2LFxuICAgIDEwODogNyxcbiAgICAxMDk6IDhcbn07XG5jb25zdCBoYW5kbGVkX2NjcyA9IE9iamVjdC5rZXlzKGNvbnRyb2xfYnV0dG9ucyk7XG5cbnZhciBoYW5kbGVkX25vdGVzID0gW107XG5mb3IgKHZhciBpID0gMzY7IGkgPD0gOTk7IGkrKykgaGFuZGxlZF9ub3Rlcy5wdXNoKGkpO1xuXG5mdW5jdGlvbiBHcmlkQnV0dG9uKHNlbmRfbWlkaV9tZXNzYWdlLCBzZW5kX3N5c2V4LCBub3RlKSB7XG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG4gICAgdGhpcy5ub3RlX291dCA9IGZ1bmN0aW9uKHZlbG9jaXR5KSB7IHNlbmRfbWlkaV9tZXNzYWdlKG5vdGUsIHZlbG9jaXR5KSB9O1xuICAgIHRoaXMuc3lzZXhfb3V0ID0gZnVuY3Rpb24oZGF0YSkgeyBzZW5kX3N5c2V4KGRhdGEpIH07XG4gICAgdGhpcy5pbmRleCA9IG5vdGUgPCAxMDIgPyBub3RlIC0gMzYgOiBub3RlIC0gMzg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBsZWRfb246IHBhcnRpYWwobGVkX29uLCB0aGlzKSxcbiAgICAgICAgbGVkX29mZjogcGFydGlhbChsZWRfb2ZmLCB0aGlzKSxcbiAgICAgICAgbGVkX3JnYjogcGFydGlhbChsZWRfcmdiLCB0aGlzKSxcbiAgICAgICAgb246IHRoaXMub24sXG4gICAgICAgIGVtaXQ6IHRoaXMuZW1pdCxcbiAgICB9XG59XG51dGlsLmluaGVyaXRzKEdyaWRCdXR0b24sIEV2ZW50RW1pdHRlcik7XG5cbmZ1bmN0aW9uIGxlZF9vbihncmlkQnV0dG9uLCB2YWx1ZSkgeyBncmlkQnV0dG9uLm5vdGVfb3V0KHZhbHVlID8gdmFsdWUgOiAxMDApIH1cbmZ1bmN0aW9uIGxlZF9vZmYoZ3JpZEJ1dHRvbikgeyBncmlkQnV0dG9uLm5vdGVfb3V0KDApIH1cbmZ1bmN0aW9uIGxlZF9yZ2IoZ3JpZEJ1dHRvbiwgciwgZywgYikge1xuICAgIHZhciBtc2IgPSBbciwgZywgYl0ubWFwKCh4KSA9PiAoeCAmIDI0MCkgPj4gNCksXG4gICAgICAgIGxzYiA9IFtyLCBnLCBiXS5tYXAoKHgpID0+IHggJiAxNSk7XG4gICAgZ3JpZEJ1dHRvbi5zeXNleF9vdXQoWzQsIDAsIDgsIGdyaWRCdXR0b24uaW5kZXgsIDAsIG1zYlswXSwgbHNiWzBdLCBtc2JbMV0sIGxzYlsxXSwgbXNiWzJdLCBsc2JbMl1dKTtcbn1cblxuZnVuY3Rpb24gR3JpZChzZW5kX25vdGUsIHNlbmRfY2MsIHNlbmRfc3lzZXgpIHtcbiAgICB0aGlzLnggPSB7fTtcbiAgICB0aGlzLnNlbGVjdCA9IHt9O1xuICAgIGZvciAodmFyIHggPSAxOyB4IDw9IDg7IHgrKykge1xuICAgICAgICB0aGlzLnhbeF0gPSB7IHk6IHt9IH1cbiAgICAgICAgZm9yICh2YXIgeSA9IDE7IHkgPD0gODsgeSsrKSB7XG4gICAgICAgICAgICB0aGlzLnhbeF0ueVt5XSA9IG5ldyBHcmlkQnV0dG9uKHNlbmRfbm90ZSwgc2VuZF9zeXNleCwgKHggLSAxKSArICgoeSAtIDEpICogOCkgKyAzNik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3JlYWNoKGNvbnRyb2xfYnV0dG9ucywgKHZhbHVlLCBrZXkpID0+IHRoaXMuc2VsZWN0W3ZhbHVlXSA9IG5ldyBHcmlkQnV0dG9uKHNlbmRfY2MsIHNlbmRfc3lzZXgsIHBhcnNlSW50KGtleSkpKTtcbiAgICB0aGlzLmhhbmRsZWRfY2NzID0gaGFuZGxlZF9jY3M7XG4gICAgdGhpcy5oYW5kbGVkX25vdGVzID0gaGFuZGxlZF9ub3RlcztcbiAgICB0aGlzLnJlY2VpdmVfbWlkaV9ub3RlID0gcGFydGlhbChyZWNlaXZlX21pZGlfbm90ZSwgdGhpcyk7XG4gICAgdGhpcy5yZWNlaXZlX21pZGlfY2MgPSBwYXJ0aWFsKHJlY2VpdmVfbWlkaV9jYywgdGhpcyk7XG4gICAgdGhpcy5yZWNlaXZlX21pZGlfcG9seV9wcmVzc3VyZSA9IHBhcnRpYWwocmVjZWl2ZV9taWRpX3BvbHlfcHJlc3N1cmUsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiByZWNlaXZlX21pZGlfbm90ZShncmlkLCBub3RlLCB2ZWxvY2l0eSkge1xuICAgIHZhciBidXR0b24gPSBidXR0b25fZnJvbV9ub3RlKGdyaWQsIG5vdGUpLFxuICAgICAgICB2ZWwgPSBwYXJzZUludCh2ZWxvY2l0eSk7XG4gICAgdmVsID4gMCA/IGJ1dHRvbi5lbWl0KCdwcmVzc2VkJywgdmVsKSA6IGJ1dHRvbi5lbWl0KCdyZWxlYXNlZCcpO1xufVxuXG5mdW5jdGlvbiByZWNlaXZlX21pZGlfY2MoZ3JpZCwgaW5kZXgsIHZhbHVlKSB7XG4gICAgZ3JpZC5zZWxlY3RbY29udHJvbF9idXR0b25zW2luZGV4XV0uZW1pdCh2YWx1ZSA+IDAgPyAncHJlc3NlZCcgOiAncmVsZWFzZWQnKTtcbn1cblxuZnVuY3Rpb24gcmVjZWl2ZV9taWRpX3BvbHlfcHJlc3N1cmUoZ3JpZCwgbm90ZSwgcHJlc3N1cmUpIHtcbiAgICBidXR0b25fZnJvbV9ub3RlKGdyaWQsIG5vdGUpLmVtaXQoJ2FmdGVydG91Y2gnLCBwYXJzZUludChwcmVzc3VyZSkpO1xufVxuXG5mdW5jdGlvbiBidXR0b25fZnJvbV9ub3RlKGdyaWQsIG5vdGUpIHtcbiAgICB2YXIgaW5kZXhlZF9mcm9tX3plcm8gPSBub3RlIC0gMzYsXG4gICAgICAgIHggPSAoaW5kZXhlZF9mcm9tX3plcm8gJSA4KSArIDEsXG4gICAgICAgIHkgPSBwYXJzZUludChpbmRleGVkX2Zyb21femVybyAvIDgpICsgMTtcbiAgICByZXR1cm4gZ3JpZC54W3hdLnlbeV07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gR3JpZDtcbiIsImNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgZm9yZWFjaCA9IHJlcXVpcmUoJ2xvZGFzaC5mb3JlYWNoJyksXG4gICAgcGFydGlhbCA9IHJlcXVpcmUoJ2xvZGFzaC5wYXJ0aWFsJyk7XG5cbnZhciBrbm9iTWFwID0ge1xuICAgICd0ZW1wbyc6IHsgJ2NjJzogMTQsICdub3RlJzogMTAgfSxcbiAgICAnc3dpbmcnOiB7ICdjYyc6IDE1LCAnbm90ZSc6IDkgfSxcbiAgICAxOiB7ICdjYyc6IDcxLCAnbm90ZSc6IDAgfSxcbiAgICAyOiB7ICdjYyc6IDcyLCAnbm90ZSc6IDEgfSxcbiAgICAzOiB7ICdjYyc6IDczLCAnbm90ZSc6IDIgfSxcbiAgICA0OiB7ICdjYyc6IDc0LCAnbm90ZSc6IDMgfSxcbiAgICA1OiB7ICdjYyc6IDc1LCAnbm90ZSc6IDQgfSxcbiAgICA2OiB7ICdjYyc6IDc2LCAnbm90ZSc6IDUgfSxcbiAgICA3OiB7ICdjYyc6IDc3LCAnbm90ZSc6IDYgfSxcbiAgICA4OiB7ICdjYyc6IDc4LCAnbm90ZSc6IDcgfSxcbiAgICAnbWFzdGVyJzogeyAnY2MnOiA3OSwgJ25vdGUnOiA4IH0sXG59XG5cbnZhciBjY1RvS25vYk1hcCA9IHt9O1xudmFyIG5vdGVUb0tub2JNYXAgPSB7fTtcbmZvcmVhY2goa25vYk1hcCwgKHZhbHVlLCBrZXkpID0+IHtcbiAgICBjY1RvS25vYk1hcFt2YWx1ZS5jY10gPSBrZXk7XG4gICAgbm90ZVRvS25vYk1hcFt2YWx1ZS5ub3RlXSA9IGtleTtcbn0pO1xuY29uc3QgaGFuZGxlZF9jY3MgPSBPYmplY3Qua2V5cyhjY1RvS25vYk1hcCksXG4gICAgaGFuZGxlZF9ub3RlcyA9IE9iamVjdC5rZXlzKG5vdGVUb0tub2JNYXApO1xuXG5mdW5jdGlvbiBLbm9iKCkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xufVxudXRpbC5pbmhlcml0cyhLbm9iLCBFdmVudEVtaXR0ZXIpO1xuXG5mdW5jdGlvbiBLbm9icygpIHtcbiAgICBmb3JlYWNoKGtub2JNYXAsICh2YWx1ZSwga2V5KSA9PiB0aGlzW2tleV0gPSBuZXcgS25vYigpKTtcbiAgICB0aGlzLmhhbmRsZWRfY2NzID0gaGFuZGxlZF9jY3M7XG4gICAgdGhpcy5yZWNlaXZlX21pZGlfY2MgPSBwYXJ0aWFsKHJlY2VpdmVfbWlkaV9jYywgdGhpcyk7XG4gICAgdGhpcy5yZWNlaXZlX21pZGlfbm90ZSA9IHBhcnRpYWwocmVjZWl2ZV9taWRpX25vdGUsIHRoaXMpO1xuICAgIHRoaXMuaGFuZGxlZF9ub3RlcyA9IGhhbmRsZWRfbm90ZXM7XG59XG5cbmZ1bmN0aW9uIHJlY2VpdmVfbWlkaV9jYyhrbm9icywgaW5kZXgsIHZhbHVlKSB7XG4gICAgdmFyIGtub2JfbmFtZSA9IGNjVG9Lbm9iTWFwW2luZGV4XTtcbiAgICB2YXIgZGVsdGEgPSB2YWx1ZSA8IDY0ID8gdmFsdWUgOiB2YWx1ZSAtIDEyODtcbiAgICBrbm9ic1trbm9iX25hbWVdLmVtaXQoJ3R1cm5lZCcsIGRlbHRhKTtcbn1cblxuZnVuY3Rpb24gcmVjZWl2ZV9taWRpX25vdGUoa25vYnMsIG5vdGUsIHZlbG9jaXR5KSB7XG4gICAgdmFyIGtub2JfbmFtZSA9IG5vdGVUb0tub2JNYXBbbm90ZV07XG4gICAgdmFyIGV2ZW50X25hbWUgPSB2ZWxvY2l0eSA+IDAgPyAncHJlc3NlZCcgOiAncmVsZWFzZWQnO1xuICAgIGtub2JzW2tub2JfbmFtZV0uZW1pdChldmVudF9uYW1lKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBLbm9icztcbiIsImNvbnN0IGZvcmVhY2ggPSByZXF1aXJlKCdsb2Rhc2guZm9yZWFjaCcpLFxuICAgIHJhbmdlID0gcmVxdWlyZSgnbG9kYXNoLnJhbmdlJyksXG4gICAgb25lX3RvX2VpZ2h0ID0gWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDhdLFxuICAgIG9uZV90b19mb3VyID0gWzEsIDIsIDMsIDRdLFxuICAgIHplcm9fdG9fc2V2ZW4gPSBbMCwgMSwgMiwgMywgNCwgNSwgNiwgN10sXG4gICAgYmxhbmsgPSAzMixcbiAgICBibGFua19saW5lID0gcmFuZ2UoYmxhbmssIDEwMCwgMCksIC8vIDY4IGNoYXJhY3RlciBhcnJheSBmaWxsZWQgd2l0aCAnYmxhbmsgY2hhcmFjdGVyJ1xuICAgIG9mZnNldHMgPSBbMCwgOSwgMTcsIDI2LCAzNCwgNDMsIDUxLCA2MF07XG5cbmZ1bmN0aW9uIExDRFNlZ21lbnQodXBkYXRlKSB7XG4gICAgdGhpcy51cGRhdGUgPSBmdW5jdGlvbih0ZXh0KSB7XG4gICAgICAgIHVwZGF0ZShsY2RfZGF0YSh0ZXh0KSk7XG4gICAgfTtcblxuICAgIHRoaXMuY2xlYXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdXBkYXRlKGxjZF9kYXRhKCcnKSk7XG4gICAgfTtcbn1cblxuZnVuY3Rpb24gbGNkX2RhdGEodGV4dCkge1xuICAgIGNvbnN0IHRleHRfc3RyaW5nID0gU3RyaW5nKHRleHQpO1xuICAgIHJldHVybiB6ZXJvX3RvX3NldmVuLm1hcCgoaW5kZXgpID0+IHtcbiAgICAgICAgcmV0dXJuIHRleHRfc3RyaW5nLmxlbmd0aCA+IGluZGV4ID8gdGV4dF9zdHJpbmcuY2hhckNvZGVBdChpbmRleCkgOiBibGFuaztcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gTENEcyhzZW5kX3N5c2V4KSB7XG4gICAgY29uc3QgbGNkcyA9IHRoaXM7XG5cbiAgICB0aGlzLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGZvcmVhY2goXG4gICAgICAgICAgICBvbmVfdG9fZWlnaHQsXG4gICAgICAgICAgICAoeCkgPT4ge1xuICAgICAgICAgICAgICAgIGxjZHMueFt4XSA9IHsgeToge30gfTtcbiAgICAgICAgICAgICAgICBmb3JlYWNoKFxuICAgICAgICAgICAgICAgICAgICBvbmVfdG9fZm91cixcbiAgICAgICAgICAgICAgICAgICAgKHkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxjZHMueFt4XS55W3ldID0gbmV3IExDRFNlZ21lbnQoKGRpc3BsYXlfZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRfc3lzZXgoWzI4IC0geV0uY29uY2F0KFswLCA5LCBvZmZzZXRzW3ggLSAxXV0pLmNvbmNhdChkaXNwbGF5X2RhdGEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG5cbiAgICAgICAgZm9yZWFjaChvbmVfdG9fZm91ciwgKHJvdykgPT4gc2VuZF9zeXNleChbMjggLSByb3ddLmNvbmNhdChbMCwgNjksIDBdKS5jb25jYXQoYmxhbmtfbGluZSkpKTtcbiAgICB9O1xuXG4gICAgdGhpcy54ID0ge307XG5cbiAgICB0aGlzLmNsZWFyKCk7XG5cbiAgICB0aGlzLnhbOF0ueVs0XS51cGRhdGUoJyBwb3dlcmVkJyk7XG4gICAgdGhpcy54WzhdLnlbM10udXBkYXRlKCcgICAgICBieScpO1xuICAgIHRoaXMueFs4XS55WzJdLnVwZGF0ZSgnICAgcHVzaC0nKTtcbiAgICB0aGlzLnhbOF0ueVsxXS51cGRhdGUoJyB3cmFwcGVyJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gTENEcztcbiIsImNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgcGFydGlhbCA9IHJlcXVpcmUoJ2xvZGFzaC5wYXJ0aWFsJyksXG4gICAgaGFuZGxlZF9ub3RlcyA9IFsxMl07XG5cbmZ1bmN0aW9uIFRvdWNoU3RyaXAoKSB7XG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG4gICAgdGhpcy5yZWNlaXZlX21pZGlfcGl0Y2hfYmVuZCA9IHBhcnRpYWwocmVjZWl2ZV9taWRpX3BpdGNoX2JlbmQsIHRoaXMpO1xuICAgIHRoaXMucmVjZWl2ZV9taWRpX25vdGUgPSBwYXJ0aWFsKHJlY2VpdmVfbWlkaV9ub3RlLCB0aGlzKTtcbiAgICB0aGlzLmhhbmRsZWRfbm90ZXMgPSBoYW5kbGVkX25vdGVzO1xufVxudXRpbC5pbmhlcml0cyhUb3VjaFN0cmlwLCBFdmVudEVtaXR0ZXIpO1xuXG5mdW5jdGlvbiByZWNlaXZlX21pZGlfcGl0Y2hfYmVuZCh0b3VjaHN0cmlwLCBmb3VydGVlbl9iaXRfdmFsdWUpIHtcbiAgICBpZiAoZm91cnRlZW5fYml0X3ZhbHVlID09IDgxOTIpIHJldHVybjtcbiAgICB0b3VjaHN0cmlwLmVtaXQoJ3BpdGNoYmVuZCcsIGZvdXJ0ZWVuX2JpdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHJlY2VpdmVfbWlkaV9ub3RlKHRvdWNoc3RyaXAsIG5vdGUsIHZlbG9jaXR5KSB7XG4gICAgaWYgKHZlbG9jaXR5ID4gMCkge1xuICAgICAgICB0b3VjaHN0cmlwLmVtaXQoJ3ByZXNzZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0b3VjaHN0cmlwLmVtaXQoJ3JlbGVhc2VkJyk7XG4gICAgICAgIHRvdWNoc3RyaXAuZW1pdCgncGl0Y2hiZW5kJywgODE5Mik7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFRvdWNoU3RyaXA7XG4iLCIndXNlIHN0cmljdCdcblxuY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKSxcbiAgICB1bml0eUdhaW4gPSB7IHRvQWJzb2x1dGU6IGZ1bmN0aW9uKCkgeyByZXR1cm4gMSB9IH07XG5cbmZ1bmN0aW9uIFNhbXBsZVBsYXllcihhc3NldFVybCwgYXVkaW9Db250ZXh0LCBvbkxvYWQpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICBsZXQgcGxheWVyID0gdGhpcyxcbiAgICAgICAgX2xvYWRlZCA9IGZhbHNlLFxuICAgICAgICBfYnVmZmVyLFxuICAgICAgICBfdm9pY2VzID0gW10sXG4gICAgICAgIF9wbGF5YmFja1JhdGUgPSAxLFxuICAgICAgICBfZ2Fpbk5vZGUgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuXG4gICAgbGV0IHN0b3BwZWRBY3Rpb24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgX3ZvaWNlcy5zaGlmdCgpO1xuICAgICAgICBpZiAoIXBsYXllci5pc1BsYXlpbmcoKSkgcGxheWVyLmVtaXQoJ3N0b3BwZWQnKTtcbiAgICB9XG5cbiAgICB0aGlzLl9hc3NldFVybCA9IGFzc2V0VXJsO1xuXG4gICAgdGhpcy5jb25uZWN0ID0gX2dhaW5Ob2RlLmNvbm5lY3QuYmluZChfZ2Fpbk5vZGUpO1xuXG4gICAgdGhpcy5kaXNjb25uZWN0ID0gX2dhaW5Ob2RlLmRpc2Nvbm5lY3QuYmluZChfZ2Fpbk5vZGUpO1xuXG4gICAgdGhpcy50b01hc3RlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBwbGF5ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICBwbGF5ZXIuY29ubmVjdChhdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICByZXR1cm4gcGxheWVyO1xuICAgIH1cblxuICAgIHRoaXMuaXNQbGF5aW5nID0gZnVuY3Rpb24oKSB7IHJldHVybiBfdm9pY2VzLmxlbmd0aCA+IDA7IH1cblxuICAgIHRoaXMucGxheSA9IGZ1bmN0aW9uKGdhaW4pIHtcbiAgICAgICAgaWYgKCFfbG9hZGVkKSB7IGNvbnNvbGUubG9nKGFzc2V0VXJsICsgJyBub3QgbG9hZGVkIHlldC4uLicpOyByZXR1cm47IH1cblxuICAgICAgICB2YXIgbm93ID0gdGltZU5vdyhhdWRpb0NvbnRleHQpLFxuICAgICAgICAgICAgc3RhcnRUaW1lID0gbm93LFxuICAgICAgICAgICAgX2dhaW4gPSAoZ2FpbiAmJiAodHlwZW9mIGdhaW4udG9BYnNvbHV0ZSA9PT0gJ2Z1bmN0aW9uJykpID8gZ2FpbiA6IHVuaXR5R2FpbjtcblxuICAgICAgICBpZiAocGxheWVyLmlzUGxheWluZygpKSB7XG4gICAgICAgICAgICBfZ2Fpbk5vZGUuZ2Fpbi5jYW5jZWxTY2hlZHVsZWRWYWx1ZXMobm93KTtcbiAgICAgICAgICAgIGFuY2hvcihfZ2Fpbk5vZGUuZ2Fpbiwgbm93KTtcbiAgICAgICAgICAgIHN0YXJ0VGltZSA9IG5vdyArIDAuMDE7XG4gICAgICAgICAgICBfZ2Fpbk5vZGUuZ2Fpbi5saW5lYXJSYW1wVG9WYWx1ZUF0VGltZSgwLCBzdGFydFRpbWUpO1xuICAgICAgICAgICAgcGxheWVyLmVtaXQoJ3N0b3BwZWQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF9nYWluTm9kZS5nYWluLnNldFZhbHVlQXRUaW1lKDAsIHN0YXJ0VGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc291cmNlID0gYXVkaW9Db250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgICAgICBzb3VyY2UuY29ubmVjdChfZ2Fpbk5vZGUpO1xuXG4gICAgICAgIF9nYWluTm9kZS5nYWluLmxpbmVhclJhbXBUb1ZhbHVlQXRUaW1lKF9nYWluLnRvQWJzb2x1dGUoKSwgc3RhcnRUaW1lKTtcblxuICAgICAgICBzb3VyY2UucGxheWJhY2tSYXRlLnNldFZhbHVlQXRUaW1lKF9wbGF5YmFja1JhdGUsIHN0YXJ0VGltZSk7XG4gICAgICAgIHNvdXJjZS5idWZmZXIgPSBfYnVmZmVyO1xuXG4gICAgICAgIHNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsIHN0b3BwZWRBY3Rpb24pO1xuXG4gICAgICAgIF92b2ljZXMucHVzaChzb3VyY2UpO1xuICAgICAgICBzb3VyY2Uuc3RhcnQoc3RhcnRUaW1lKTtcbiAgICAgICAgcGxheWVyLmVtaXQoJ3N0YXJ0ZWQnLCBfZ2Fpbik7XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVQbGF5YmFja1JhdGUgPSBmdW5jdGlvbihyYXRlKSB7XG4gICAgICAgIF9wbGF5YmFja1JhdGUgPSByYXRlO1xuICAgICAgICB2YXIgbm93ID0gdGltZU5vdyhhdWRpb0NvbnRleHQpO1xuICAgICAgICBfdm9pY2VzLmZvckVhY2goKHNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgc291cmNlLnBsYXliYWNrUmF0ZS5zZXRWYWx1ZUF0VGltZShfcGxheWJhY2tSYXRlLCBub3cpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBsb2FkU2FtcGxlKGFzc2V0VXJsLCBhdWRpb0NvbnRleHQsIChidWZmZXIpID0+IHtcbiAgICAgICAgX2J1ZmZlciA9IGJ1ZmZlcjtcbiAgICAgICAgX2xvYWRlZCA9IHRydWU7XG4gICAgICAgIGlmICh0eXBlb2Ygb25Mb2FkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBvbkxvYWQocGxheWVyKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxudXRpbC5pbmhlcml0cyhTYW1wbGVQbGF5ZXIsIEV2ZW50RW1pdHRlcik7XG5cbmZ1bmN0aW9uIGxvYWRTYW1wbGUoYXNzZXRVcmwsIGF1ZGlvQ29udGV4dCwgZG9uZSkge1xuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgcmVxdWVzdC5vcGVuKCdHRVQnLCBhc3NldFVybCwgdHJ1ZSk7XG4gICAgcmVxdWVzdC5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgIHJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBhdWRpb0NvbnRleHQuZGVjb2RlQXVkaW9EYXRhKHJlcXVlc3QucmVzcG9uc2UsIGRvbmUpO1xuICAgIH1cbiAgICByZXF1ZXN0LnNlbmQoKTtcbn1cblxuZnVuY3Rpb24gYW5jaG9yKGF1ZGlvUGFyYW0sIG5vdykge1xuICAgIGF1ZGlvUGFyYW0uc2V0VmFsdWVBdFRpbWUoYXVkaW9QYXJhbS52YWx1ZSwgbm93KTtcbn1cblxuZnVuY3Rpb24gdGltZU5vdyhhdWRpb0NvbnRleHQpIHtcbiAgICByZXR1cm4gYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFNhbXBsZVBsYXllcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKTtcblxuZnVuY3Rpb24gUmVwZWF0ZXIoaW5UaGVGdXR1cmUsIGluaXRpYWxJbnRlcnZhbCkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuXG4gICAgbGV0IGNyZWF0ZUludGVydmFsID0gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG4gICAgICAgIHJldHVybiAoY2FuZGlkYXRlICYmICh0eXBlb2YgY2FuZGlkYXRlLnRvTXMgPT09ICdmdW5jdGlvbicpKSA/IGNhbmRpZGF0ZSA6IHsgdG9NczogZnVuY3Rpb24oKSB7IHJldHVybiBjYW5kaWRhdGU7IH19O1xuICAgIH07XG5cbiAgICBsZXQgcmVjdXJzaXZlSW5UaGVGdXR1cmUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICByZXR1cm4gaW5UaGVGdXR1cmUoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKF9pc1NjaGVkdWxpbmcpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIF9jYW5jZWwgPSByZWN1cnNpdmVJblRoZUZ1dHVyZShjYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIF9pbnRlcnZhbCk7XG4gICAgfTtcblxuICAgIGxldCBfaXNTY2hlZHVsaW5nID0gZmFsc2UsXG4gICAgICAgIF9pbnRlcnZhbCA9IGNyZWF0ZUludGVydmFsKGluaXRpYWxJbnRlcnZhbCksXG4gICAgICAgIF9jYW5jZWwgPSBub0FjdGlvbixcbiAgICAgICAgcmVwZWF0ZXIgPSB0aGlzO1xuXG4gICAgdGhpcy51cGRhdGVJbnRlcnZhbCA9IGZ1bmN0aW9uIChuZXdJbnRlcnZhbCkge1xuICAgICAgICBfaW50ZXJ2YWwgPSBjcmVhdGVJbnRlcnZhbChuZXdJbnRlcnZhbCk7XG4gICAgICAgIHJlcGVhdGVyLnJlcG9ydEludGVydmFsKCk7XG4gICAgICAgIHJldHVybiByZXBlYXRlcjtcbiAgICB9O1xuXG4gICAgdGhpcy5zdGFydCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChfaXNTY2hlZHVsaW5nKSByZXR1cm47XG4gICAgICAgIF9pc1NjaGVkdWxpbmcgPSB0cnVlO1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICBfY2FuY2VsID0gcmVjdXJzaXZlSW5UaGVGdXR1cmUoY2FsbGJhY2spO1xuICAgIH07XG5cbiAgICB0aGlzLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgX2lzU2NoZWR1bGluZyA9IGZhbHNlO1xuICAgICAgICBfY2FuY2VsKCk7XG4gICAgICAgIF9jYW5jZWwgPSBub0FjdGlvbjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZXBvcnRJbnRlcnZhbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXBlYXRlci5lbWl0KCdpbnRlcnZhbCcsIF9pbnRlcnZhbCk7XG4gICAgfTtcbn1cbnV0aWwuaW5oZXJpdHMoUmVwZWF0ZXIsIEV2ZW50RW1pdHRlcik7XG5cbmZ1bmN0aW9uIFNjaGVkdWxpbmcoY29udGV4dCkge1xuICAgIGxldCBzY2hlZHVsaW5nID0gdGhpcztcblxuICAgIGxldCBpblRoZUZ1dHVyZVRpZ2h0ID0gZnVuY3Rpb24oY2FsbGJhY2ssIHdoZW4pIHtcbiAgICAgICAgbGV0IGxvY2FsQ2FsbGJhY2sgPSBjYWxsYmFjayxcbiAgICAgICAgICAgIHNvdXJjZSA9IGNvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCksXG4gICAgICAgICAgICBub3cgPSBjb250ZXh0LmN1cnJlbnRUaW1lLFxuICAgICAgICAgICAgdGhvdXNhbmR0aCA9IGNvbnRleHQuc2FtcGxlUmF0ZSAvIDEwMDAsXG4gICAgICAgICAgICBzY2hlZHVsZWRfYXQgPSBub3cgKyAod2hlbi50b01zKCkgLyAxMDAwKSAtIDAuMDAxO1xuICAgICAgICAvLyBhIGJ1ZmZlciBsZW5ndGggb2YgMSBzYW1wbGUgZG9lc24ndCB3b3JrIG9uIElPUywgc28gdXNlIDEvMTAwMHRoIG9mIGEgc2Vjb25kXG4gICAgICAgIGxldCBidWZmZXIgPSBjb250ZXh0LmNyZWF0ZUJ1ZmZlcigxLCB0aG91c2FuZHRoLCBjb250ZXh0LnNhbXBsZVJhdGUpO1xuICAgICAgICBzb3VyY2UuYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCAoKSA9PiB7IGxvY2FsQ2FsbGJhY2soKTsgfSk7XG4gICAgICAgIHNvdXJjZS5idWZmZXIgPSBidWZmZXI7XG4gICAgICAgIHNvdXJjZS5jb25uZWN0KGNvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICBzb3VyY2Uuc3RhcnQoc2NoZWR1bGVkX2F0KTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gY2FuY2VsKCkgeyBsb2NhbENhbGxiYWNrID0gbm9BY3Rpb247IH07XG4gICAgfTtcblxuICAgIHRoaXMuaW5UaGVGdXR1cmUgPSBjb250ZXh0ID8gaW5UaGVGdXR1cmVUaWdodCA6IGluVGhlRnV0dXJlTG9vc2U7XG5cbiAgICB0aGlzLlJlcGVhdGVyID0gZnVuY3Rpb24oaW5pdGlhbEludGVydmFsKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVwZWF0ZXIoc2NoZWR1bGluZy5pblRoZUZ1dHVyZSwgaW5pdGlhbEludGVydmFsKTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBpblRoZUZ1dHVyZUxvb3NlKGNhbGxiYWNrLCB3aGVuKSB7XG4gICAgbGV0IGxvY2FsQ2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICBzZXRUaW1lb3V0KCgpID0+IHsgbG9jYWxDYWxsYmFjaygpOyB9LCB3aGVuLnRvTXMoKSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGNhbmNlbCgpIHsgbG9jYWxDYWxsYmFjayA9IG5vQWN0aW9uOyB9O1xufVxuXG5mdW5jdGlvbiBub0FjdGlvbigpIHt9XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY29udGV4dCkgeyByZXR1cm4gbmV3IFNjaGVkdWxpbmcoY29udGV4dCk7IH07XG4iLCIndXNlIHN0cmljdCdcblxuY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKSxcbiAgICBmb3JlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKTtcblxuZnVuY3Rpb24gQlBNKGluaXRpYWwpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICBsZXQgYnBtID0gdGhpcztcblxuICAgIHRoaXMuY3VycmVudCA9IGNsaXAoaW5pdGlhbCkgPyBjbGlwKGluaXRpYWwpIDogMTIwO1xuXG4gICAgdGhpcy5yZXBvcnQgPSBmdW5jdGlvbigpIHsgYnBtLmVtaXQoJ2NoYW5nZWQnLCBicG0pIH1cbiAgICB0aGlzLmNoYW5nZV9ieSA9IGZ1bmN0aW9uKGFtb3VudCkge1xuICAgICAgICBicG0uY3VycmVudCA9IGNsaXAoYnBtLmN1cnJlbnQgKyBhbW91bnQpO1xuICAgICAgICBicG0ucmVwb3J0KCk7XG4gICAgfVxufVxudXRpbC5pbmhlcml0cyhCUE0sIEV2ZW50RW1pdHRlcik7XG5cbmZ1bmN0aW9uIGNsaXAoYnBtKSB7XG4gICAgcmV0dXJuIGJwbSA8IDIwID8gMjAgOiAoYnBtID4gMzAwID8gMzAwIDogYnBtKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBCUE07IiwiJ3VzZSBzdHJpY3QnXG5cbmNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgZm9yZWFjaCA9IHJlcXVpcmUoJ2xvZGFzaC5mb3JlYWNoJyk7XG5cbmZ1bmN0aW9uIEludGVydmFsKGJwbSwgbXVsdGlwbGllciwgdmFsdWUpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICBsZXQgaW50ZXJ2YWwgPSB0aGlzO1xuXG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgIHRoaXMucmVwb3J0ID0gZnVuY3Rpb24oKSB7IGludGVydmFsLmVtaXQoJ2NoYW5nZWQnLCAoNjAgLyBicG0uY3VycmVudCkgKiBtdWx0aXBsaWVyICogMTAwMCk7IH07XG5cbiAgICBicG0ub24oJ2NoYW5nZWQnLCBpbnRlcnZhbC5yZXBvcnQpO1xufVxudXRpbC5pbmhlcml0cyhJbnRlcnZhbCwgRXZlbnRFbWl0dGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgJzRuJzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAxLCBuYW1lID8gbmFtZSA6ICc0bicpIH0sXG4gICAgJzRudCc6IGZ1bmN0aW9uKGJwbSwgbmFtZSkgeyByZXR1cm4gbmV3IEludGVydmFsKGJwbSwgMiAvIDMsIG5hbWUgPyBuYW1lIDogJzRudCcpIH0sXG4gICAgJzhuJzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAwLjUsIG5hbWUgPyBuYW1lIDogJzhuJykgfSxcbiAgICAnOG50JzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAxIC8gMywgbmFtZSA/IG5hbWUgOiAnOG50JykgfSxcbiAgICAnMTZuJzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAwLjI1LCBuYW1lID8gbmFtZSA6ICcxNm4nKSB9LFxuICAgICcxNm50JzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAxIC8gNiwgbmFtZSA/IG5hbWUgOiAnMTZudCcpIH0sXG4gICAgJzMybic6IGZ1bmN0aW9uKGJwbSwgbmFtZSkgeyByZXR1cm4gbmV3IEludGVydmFsKGJwbSwgMC4xMjUsIG5hbWUgPyBuYW1lIDogJzMybicpIH0sXG4gICAgJzMybnQnOiBmdW5jdGlvbihicG0sIG5hbWUpIHsgcmV0dXJuIG5ldyBJbnRlcnZhbChicG0sIDEgLyAxMiwgbmFtZSA/IG5hbWUgOiAnMzJudCcpIH0sXG59OyIsIid1c2Ugc3RyaWN0J1xuY29uc3QgU2FtcGxlUGxheWVyID0gcmVxdWlyZSgnd2FjLnNhbXBsZS1wbGF5ZXInKTtcbi8qKlxuICogQSB3YWMuc2FtcGxlLXBsYXllciB3cmFwcGVyIHRoYXQgYWRkcyBhbiBMUCBmaWx0ZXIgYW5kIHZhcmlhYmxlIHBpdGNoXG4gKi9cbmZ1bmN0aW9uIFBsYXllcihhc3NldFVybCwgYXVkaW9Db250ZXh0LCBvbkxvYWQpIHtcbiAgICBsZXQgc2FtcGxlUGxheWVyID0gbmV3IFNhbXBsZVBsYXllcihhc3NldFVybCwgYXVkaW9Db250ZXh0LCBvbkxvYWQpLFxuICAgICAgICBmaWx0ZXJOb2RlID0gYXVkaW9Db250ZXh0LmNyZWF0ZUJpcXVhZEZpbHRlcigpLFxuICAgICAgICBwaXRjaCA9IDAsXG4gICAgICAgIHBpdGNoTW9kID0gMCxcbiAgICAgICAgcGxheWVyID0gdGhpcztcblxuICAgIGZpbHRlck5vZGUuZnJlcXVlbmN5LnZhbHVlID0gMjAwMDA7XG4gICAgc2FtcGxlUGxheWVyLmNvbm5lY3QoZmlsdGVyTm9kZSk7XG5cbiAgICBsZXQgdXBkYXRlUGl0Y2ggPSBmdW5jdGlvbigpIHsgc2FtcGxlUGxheWVyLnVwZGF0ZVBsYXliYWNrUmF0ZShpbnRlcnZhbFRvUGxheWJhY2tSYXRlKHBpdGNoICsgcGl0Y2hNb2QpKTsgfVxuXG4gICAgdGhpcy5fYXNzZXRVcmwgPSBhc3NldFVybDtcbiAgICB0aGlzLnBsYXkgPSBzYW1wbGVQbGF5ZXIucGxheS5iaW5kKHNhbXBsZVBsYXllcik7XG5cbiAgICB0aGlzLmNvbm5lY3QgPSBmaWx0ZXJOb2RlLmNvbm5lY3QuYmluZChmaWx0ZXJOb2RlKTtcblxuICAgIHRoaXMuZGlzY29ubmVjdCA9IGZpbHRlck5vZGUuZGlzY29ubmVjdC5iaW5kKGZpbHRlck5vZGUpO1xuXG4gICAgdGhpcy50b01hc3RlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBmaWx0ZXJOb2RlLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgZmlsdGVyTm9kZS5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICAgIHJldHVybiBwbGF5ZXI7XG4gICAgfVxuXG4gICAgdGhpcy5pc1BsYXlpbmcgPSBzYW1wbGVQbGF5ZXIuaXNQbGF5aW5nLmJpbmQoc2FtcGxlUGxheWVyKTtcblxuICAgIHRoaXMuY2hhbmdlUGl0Y2hCeUludGVydmFsID0gZnVuY3Rpb24oaW50ZXJ2YWwpIHtcbiAgICAgICAgcGl0Y2ggPSBjbGlwKHBpdGNoICsgaW50ZXJ2YWwsIC0yNCwgMjQpO1xuICAgICAgICBwbGF5ZXIucmVwb3J0UGl0Y2goKTtcbiAgICAgICAgdXBkYXRlUGl0Y2goKTtcbiAgICB9XG5cbiAgICB0aGlzLm1vZHVsYXRlUGl0Y2ggPSBmdW5jdGlvbihpbnRlcnZhbCkge1xuICAgICAgICBwaXRjaE1vZCA9IGNsaXAoaW50ZXJ2YWwsIC0yNCwgMjQpO1xuICAgICAgICB1cGRhdGVQaXRjaCgpO1xuICAgIH1cblxuICAgIHRoaXMuY3V0T2ZmID0gZnVuY3Rpb24oZikge1xuICAgICAgICBmaWx0ZXJOb2RlLmZyZXF1ZW5jeS5zZXRWYWx1ZUF0VGltZShjbGlwKGYsIDMwLCAyMDAwMCksIGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZSk7XG4gICAgICAgIHJldHVybiBwbGF5ZXI7XG4gICAgfVxuXG4gICAgdGhpcy5yZXBvcnRQaXRjaCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBzYW1wbGVQbGF5ZXIuZW1pdCgncGl0Y2gnLCAoKHBpdGNoID49IDApID8gJysnIDogJycpICsgKHBpdGNoKSArICcgc3QnKTtcbiAgICB9XG5cbiAgICB0aGlzLm9uID0gc2FtcGxlUGxheWVyLm9uLmJpbmQoc2FtcGxlUGxheWVyKTtcbn1cblxuZnVuY3Rpb24gY2xpcCh2YWx1ZSwgbWluLCBtYXgpIHtcbiAgICBpZiAodmFsdWUgPCBtaW4pIHJldHVybiBtaW47XG4gICAgcmV0dXJuIHZhbHVlID4gbWF4ID8gbWF4IDogdmFsdWU7XG59XG5cbmZ1bmN0aW9uIGludGVydmFsVG9QbGF5YmFja1JhdGUobWlkaU5vdGVOdW1iZXIpIHtcbiAgICByZXR1cm4gTWF0aC5leHAoLjA1Nzc2MjI2NSAqIChtaWRpTm90ZU51bWJlcikpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYXllcjsiLCIndXNlIHN0cmljdCdcblxuY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKSxcbiAgICBTY2hlZHVsaW5nID0gcmVxdWlyZSgnd2FjLnNjaGVkdWxpbmcnKTtcblxuZnVuY3Rpb24gUmVwZXRhZShyZXBlYXRlciwgaW5pdGlhbF9pbnRlcnZhbCkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIHZhciByZXBldGFlID0gdGhpcztcbiAgICB0aGlzLl9hY3RpdmUgPSBmYWxzZTtcbiAgICB0aGlzLl90aW1lX2NoYW5nZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9iZWluZ19wcmVzc2VkID0gZmFsc2U7XG4gICAgdGhpcy5fY3VycmVudF9pbnRlcnZhbCA9IGluaXRpYWxfaW50ZXJ2YWw7XG5cbiAgICByZXBlYXRlci5vbignaW50ZXJ2YWwnLCAoaW50ZXJ2YWwpID0+IHsgcmVwZXRhZS5lbWl0KCdpbnRlcnZhbE1zJywgaW50ZXJ2YWwpIH0pXG4gICAgcmVwZXRhZS5fY3VycmVudF9pbnRlcnZhbC5vbignY2hhbmdlZCcsIHJlcGVhdGVyLnVwZGF0ZUludGVydmFsKTtcbiAgICByZXBldGFlLl9jdXJyZW50X2ludGVydmFsLnJlcG9ydCgpO1xuXG4gICAgdGhpcy5wcmVzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXBldGFlLl9iZWluZ19wcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLnJlbGVhc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXJ0ZWRfYWN0aXZlID0gcmVwZXRhZS5fYWN0aXZlLFxuICAgICAgICAgICAgdGltZV9jaGFuZ2VkID0gcmVwZXRhZS5fdGltZV9jaGFuZ2VkO1xuXG4gICAgICAgIHJlcGV0YWUuX3RpbWVfY2hhbmdlZCA9IGZhbHNlO1xuICAgICAgICByZXBldGFlLl9iZWluZ19wcmVzc2VkID0gZmFsc2U7XG5cbiAgICAgICAgc3dpdGNoICh0cnVlKSB7XG4gICAgICAgICAgICBjYXNlICghc3RhcnRlZF9hY3RpdmUpOlxuICAgICAgICAgICAgICAgIHJlcGV0YWUuX2FjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmVwZXRhZS5lbWl0KCdvbicpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAoc3RhcnRlZF9hY3RpdmUgJiYgIXRpbWVfY2hhbmdlZCk6XG4gICAgICAgICAgICAgICAgcmVwZXRhZS5fYWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcmVwZXRhZS5lbWl0KCdvZmYnKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuaW50ZXJ2YWwgPSBmdW5jdGlvbihuZXdfaW50ZXJ2YWwpIHtcbiAgICAgICAgaWYgKHJlcGV0YWUuX2JlaW5nX3ByZXNzZWQpIHtcbiAgICAgICAgICAgIHJlcGV0YWUuX3RpbWVfY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICByZXBldGFlLl9jdXJyZW50X2ludGVydmFsLnJlbW92ZUxpc3RlbmVyKCdjaGFuZ2VkJywgcmVwZWF0ZXIudXBkYXRlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgcmVwZXRhZS5fY3VycmVudF9pbnRlcnZhbCA9IG5ld19pbnRlcnZhbDtcbiAgICAgICAgICAgIHJlcGV0YWUuX2N1cnJlbnRfaW50ZXJ2YWwub24oJ2NoYW5nZWQnLCByZXBlYXRlci51cGRhdGVJbnRlcnZhbCk7XG4gICAgICAgICAgICByZXBldGFlLnJlcG9ydF9pbnRlcnZhbCgpO1xuICAgICAgICAgICAgcmVwZXRhZS5fY3VycmVudF9pbnRlcnZhbC5yZXBvcnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc3RhcnQgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXJlcGV0YWUuX2FjdGl2ZSkge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICByZXBlYXRlci5zdGFydChjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wID0gcmVwZWF0ZXIuc3RvcDtcbiAgICB0aGlzLnJlcG9ydF9pbnRlcnZhbCA9IGZ1bmN0aW9uKCkgeyByZXBldGFlLmVtaXQoJ2ludGVydmFsJywgcmVwZXRhZS5fY3VycmVudF9pbnRlcnZhbC52YWx1ZSkgIH07XG59XG51dGlsLmluaGVyaXRzKFJlcGV0YWUsIEV2ZW50RW1pdHRlcik7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY3JlYXRlUmVwZXRhZShpbnRlcnZhbCwgY29udGV4dCkge1xuICAgIGxldCByZXBlYXRlciA9IFNjaGVkdWxpbmcoY29udGV4dCkuUmVwZWF0ZXIoMTAwMCk7IC8vIGluaXRpYWwgaW50ZXJ2YWwgaGVyZSB3aWxsIGJlIGNoYW5nZWQgd2hlbiBSZXBldGFlIGluaXRpYWxpc2VzXG4gICAgcmV0dXJuIG5ldyBSZXBldGFlKHJlcGVhdGVyLCBpbnRlcnZhbCk7XG59OyIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBBdCBsZWFzdCBnaXZlIHNvbWUga2luZCBvZiBjb250ZXh0IHRvIHRoZSB1c2VyXG4gICAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuICgnICsgZXIgKyAnKScpO1xuICAgICAgICBlcnIuY29udGV4dCA9IGVyO1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzKSB7XG4gICAgdmFyIGV2bGlzdGVuZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlcbiAgICAgIHJldHVybiAxO1xuICAgIGVsc2UgaWYgKGV2bGlzdGVuZXIpXG4gICAgICByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsImlmICh0eXBlb2YgT2JqZWN0LmNyZWF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAvLyBpbXBsZW1lbnRhdGlvbiBmcm9tIHN0YW5kYXJkIG5vZGUuanMgJ3V0aWwnIG1vZHVsZVxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9O1xufSBlbHNlIHtcbiAgLy8gb2xkIHNjaG9vbCBzaGltIGZvciBvbGQgYnJvd3NlcnNcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIHZhciBUZW1wQ3RvciA9IGZ1bmN0aW9uICgpIHt9XG4gICAgVGVtcEN0b3IucHJvdG90eXBlID0gc3VwZXJDdG9yLnByb3RvdHlwZVxuICAgIGN0b3IucHJvdG90eXBlID0gbmV3IFRlbXBDdG9yKClcbiAgICBjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGN0b3JcbiAgfVxufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuKGZ1bmN0aW9uICgpIHtcbiAgdHJ5IHtcbiAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNhY2hlZFNldFRpbWVvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaXMgbm90IGRlZmluZWQnKTtcbiAgICB9XG4gIH1cbiAgdHJ5IHtcbiAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBpcyBub3QgZGVmaW5lZCcpO1xuICAgIH1cbiAgfVxufSAoKSlcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IGNhY2hlZFNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNhY2hlZENsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQnVmZmVyKGFyZykge1xuICByZXR1cm4gYXJnICYmIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnXG4gICAgJiYgdHlwZW9mIGFyZy5jb3B5ID09PSAnZnVuY3Rpb24nXG4gICAgJiYgdHlwZW9mIGFyZy5maWxsID09PSAnZnVuY3Rpb24nXG4gICAgJiYgdHlwZW9mIGFyZy5yZWFkVUludDggPT09ICdmdW5jdGlvbic7XG59IiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbnZhciBmb3JtYXRSZWdFeHAgPSAvJVtzZGolXS9nO1xuZXhwb3J0cy5mb3JtYXQgPSBmdW5jdGlvbihmKSB7XG4gIGlmICghaXNTdHJpbmcoZikpIHtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvYmplY3RzLnB1c2goaW5zcGVjdChhcmd1bWVudHNbaV0pKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdHMuam9pbignICcpO1xuICB9XG5cbiAgdmFyIGkgPSAxO1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIGxlbiA9IGFyZ3MubGVuZ3RoO1xuICB2YXIgc3RyID0gU3RyaW5nKGYpLnJlcGxhY2UoZm9ybWF0UmVnRXhwLCBmdW5jdGlvbih4KSB7XG4gICAgaWYgKHggPT09ICclJScpIHJldHVybiAnJSc7XG4gICAgaWYgKGkgPj0gbGVuKSByZXR1cm4geDtcbiAgICBzd2l0Y2ggKHgpIHtcbiAgICAgIGNhc2UgJyVzJzogcmV0dXJuIFN0cmluZyhhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWQnOiByZXR1cm4gTnVtYmVyKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclaic6XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGFyZ3NbaSsrXSk7XG4gICAgICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgICByZXR1cm4gJ1tDaXJjdWxhcl0nO1xuICAgICAgICB9XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4geDtcbiAgICB9XG4gIH0pO1xuICBmb3IgKHZhciB4ID0gYXJnc1tpXTsgaSA8IGxlbjsgeCA9IGFyZ3NbKytpXSkge1xuICAgIGlmIChpc051bGwoeCkgfHwgIWlzT2JqZWN0KHgpKSB7XG4gICAgICBzdHIgKz0gJyAnICsgeDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICcgJyArIGluc3BlY3QoeCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzdHI7XG59O1xuXG5cbi8vIE1hcmsgdGhhdCBhIG1ldGhvZCBzaG91bGQgbm90IGJlIHVzZWQuXG4vLyBSZXR1cm5zIGEgbW9kaWZpZWQgZnVuY3Rpb24gd2hpY2ggd2FybnMgb25jZSBieSBkZWZhdWx0LlxuLy8gSWYgLS1uby1kZXByZWNhdGlvbiBpcyBzZXQsIHRoZW4gaXQgaXMgYSBuby1vcC5cbmV4cG9ydHMuZGVwcmVjYXRlID0gZnVuY3Rpb24oZm4sIG1zZykge1xuICAvLyBBbGxvdyBmb3IgZGVwcmVjYXRpbmcgdGhpbmdzIGluIHRoZSBwcm9jZXNzIG9mIHN0YXJ0aW5nIHVwLlxuICBpZiAoaXNVbmRlZmluZWQoZ2xvYmFsLnByb2Nlc3MpKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGV4cG9ydHMuZGVwcmVjYXRlKGZuLCBtc2cpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfVxuXG4gIGlmIChwcm9jZXNzLm5vRGVwcmVjYXRpb24gPT09IHRydWUpIHtcbiAgICByZXR1cm4gZm47XG4gIH1cblxuICB2YXIgd2FybmVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIGRlcHJlY2F0ZWQoKSB7XG4gICAgaWYgKCF3YXJuZWQpIHtcbiAgICAgIGlmIChwcm9jZXNzLnRocm93RGVwcmVjYXRpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgICB9IGVsc2UgaWYgKHByb2Nlc3MudHJhY2VEZXByZWNhdGlvbikge1xuICAgICAgICBjb25zb2xlLnRyYWNlKG1zZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKG1zZyk7XG4gICAgICB9XG4gICAgICB3YXJuZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBkZXByZWNhdGVkO1xufTtcblxuXG52YXIgZGVidWdzID0ge307XG52YXIgZGVidWdFbnZpcm9uO1xuZXhwb3J0cy5kZWJ1Z2xvZyA9IGZ1bmN0aW9uKHNldCkge1xuICBpZiAoaXNVbmRlZmluZWQoZGVidWdFbnZpcm9uKSlcbiAgICBkZWJ1Z0Vudmlyb24gPSBwcm9jZXNzLmVudi5OT0RFX0RFQlVHIHx8ICcnO1xuICBzZXQgPSBzZXQudG9VcHBlckNhc2UoKTtcbiAgaWYgKCFkZWJ1Z3Nbc2V0XSkge1xuICAgIGlmIChuZXcgUmVnRXhwKCdcXFxcYicgKyBzZXQgKyAnXFxcXGInLCAnaScpLnRlc3QoZGVidWdFbnZpcm9uKSkge1xuICAgICAgdmFyIHBpZCA9IHByb2Nlc3MucGlkO1xuICAgICAgZGVidWdzW3NldF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG1zZyA9IGV4cG9ydHMuZm9ybWF0LmFwcGx5KGV4cG9ydHMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJyVzICVkOiAlcycsIHNldCwgcGlkLCBtc2cpO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVidWdzW3NldF0gPSBmdW5jdGlvbigpIHt9O1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGVidWdzW3NldF07XG59O1xuXG5cbi8qKlxuICogRWNob3MgdGhlIHZhbHVlIG9mIGEgdmFsdWUuIFRyeXMgdG8gcHJpbnQgdGhlIHZhbHVlIG91dFxuICogaW4gdGhlIGJlc3Qgd2F5IHBvc3NpYmxlIGdpdmVuIHRoZSBkaWZmZXJlbnQgdHlwZXMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iaiBUaGUgb2JqZWN0IHRvIHByaW50IG91dC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0IHRoYXQgYWx0ZXJzIHRoZSBvdXRwdXQuXG4gKi9cbi8qIGxlZ2FjeTogb2JqLCBzaG93SGlkZGVuLCBkZXB0aCwgY29sb3JzKi9cbmZ1bmN0aW9uIGluc3BlY3Qob2JqLCBvcHRzKSB7XG4gIC8vIGRlZmF1bHQgb3B0aW9uc1xuICB2YXIgY3R4ID0ge1xuICAgIHNlZW46IFtdLFxuICAgIHN0eWxpemU6IHN0eWxpemVOb0NvbG9yXG4gIH07XG4gIC8vIGxlZ2FjeS4uLlxuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAzKSBjdHguZGVwdGggPSBhcmd1bWVudHNbMl07XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDQpIGN0eC5jb2xvcnMgPSBhcmd1bWVudHNbM107XG4gIGlmIChpc0Jvb2xlYW4ob3B0cykpIHtcbiAgICAvLyBsZWdhY3kuLi5cbiAgICBjdHguc2hvd0hpZGRlbiA9IG9wdHM7XG4gIH0gZWxzZSBpZiAob3B0cykge1xuICAgIC8vIGdvdCBhbiBcIm9wdGlvbnNcIiBvYmplY3RcbiAgICBleHBvcnRzLl9leHRlbmQoY3R4LCBvcHRzKTtcbiAgfVxuICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gIGlmIChpc1VuZGVmaW5lZChjdHguc2hvd0hpZGRlbikpIGN0eC5zaG93SGlkZGVuID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguZGVwdGgpKSBjdHguZGVwdGggPSAyO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmNvbG9ycykpIGN0eC5jb2xvcnMgPSBmYWxzZTtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jdXN0b21JbnNwZWN0KSkgY3R4LmN1c3RvbUluc3BlY3QgPSB0cnVlO1xuICBpZiAoY3R4LmNvbG9ycykgY3R4LnN0eWxpemUgPSBzdHlsaXplV2l0aENvbG9yO1xuICByZXR1cm4gZm9ybWF0VmFsdWUoY3R4LCBvYmosIGN0eC5kZXB0aCk7XG59XG5leHBvcnRzLmluc3BlY3QgPSBpbnNwZWN0O1xuXG5cbi8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQU5TSV9lc2NhcGVfY29kZSNncmFwaGljc1xuaW5zcGVjdC5jb2xvcnMgPSB7XG4gICdib2xkJyA6IFsxLCAyMl0sXG4gICdpdGFsaWMnIDogWzMsIDIzXSxcbiAgJ3VuZGVybGluZScgOiBbNCwgMjRdLFxuICAnaW52ZXJzZScgOiBbNywgMjddLFxuICAnd2hpdGUnIDogWzM3LCAzOV0sXG4gICdncmV5JyA6IFs5MCwgMzldLFxuICAnYmxhY2snIDogWzMwLCAzOV0sXG4gICdibHVlJyA6IFszNCwgMzldLFxuICAnY3lhbicgOiBbMzYsIDM5XSxcbiAgJ2dyZWVuJyA6IFszMiwgMzldLFxuICAnbWFnZW50YScgOiBbMzUsIDM5XSxcbiAgJ3JlZCcgOiBbMzEsIDM5XSxcbiAgJ3llbGxvdycgOiBbMzMsIDM5XVxufTtcblxuLy8gRG9uJ3QgdXNlICdibHVlJyBub3QgdmlzaWJsZSBvbiBjbWQuZXhlXG5pbnNwZWN0LnN0eWxlcyA9IHtcbiAgJ3NwZWNpYWwnOiAnY3lhbicsXG4gICdudW1iZXInOiAneWVsbG93JyxcbiAgJ2Jvb2xlYW4nOiAneWVsbG93JyxcbiAgJ3VuZGVmaW5lZCc6ICdncmV5JyxcbiAgJ251bGwnOiAnYm9sZCcsXG4gICdzdHJpbmcnOiAnZ3JlZW4nLFxuICAnZGF0ZSc6ICdtYWdlbnRhJyxcbiAgLy8gXCJuYW1lXCI6IGludGVudGlvbmFsbHkgbm90IHN0eWxpbmdcbiAgJ3JlZ2V4cCc6ICdyZWQnXG59O1xuXG5cbmZ1bmN0aW9uIHN0eWxpemVXaXRoQ29sb3Ioc3RyLCBzdHlsZVR5cGUpIHtcbiAgdmFyIHN0eWxlID0gaW5zcGVjdC5zdHlsZXNbc3R5bGVUeXBlXTtcblxuICBpZiAoc3R5bGUpIHtcbiAgICByZXR1cm4gJ1xcdTAwMWJbJyArIGluc3BlY3QuY29sb3JzW3N0eWxlXVswXSArICdtJyArIHN0ciArXG4gICAgICAgICAgICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMV0gKyAnbSc7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxufVxuXG5cbmZ1bmN0aW9uIHN0eWxpemVOb0NvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHJldHVybiBzdHI7XG59XG5cblxuZnVuY3Rpb24gYXJyYXlUb0hhc2goYXJyYXkpIHtcbiAgdmFyIGhhc2ggPSB7fTtcblxuICBhcnJheS5mb3JFYWNoKGZ1bmN0aW9uKHZhbCwgaWR4KSB7XG4gICAgaGFzaFt2YWxdID0gdHJ1ZTtcbiAgfSk7XG5cbiAgcmV0dXJuIGhhc2g7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0VmFsdWUoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzKSB7XG4gIC8vIFByb3ZpZGUgYSBob29rIGZvciB1c2VyLXNwZWNpZmllZCBpbnNwZWN0IGZ1bmN0aW9ucy5cbiAgLy8gQ2hlY2sgdGhhdCB2YWx1ZSBpcyBhbiBvYmplY3Qgd2l0aCBhbiBpbnNwZWN0IGZ1bmN0aW9uIG9uIGl0XG4gIGlmIChjdHguY3VzdG9tSW5zcGVjdCAmJlxuICAgICAgdmFsdWUgJiZcbiAgICAgIGlzRnVuY3Rpb24odmFsdWUuaW5zcGVjdCkgJiZcbiAgICAgIC8vIEZpbHRlciBvdXQgdGhlIHV0aWwgbW9kdWxlLCBpdCdzIGluc3BlY3QgZnVuY3Rpb24gaXMgc3BlY2lhbFxuICAgICAgdmFsdWUuaW5zcGVjdCAhPT0gZXhwb3J0cy5pbnNwZWN0ICYmXG4gICAgICAvLyBBbHNvIGZpbHRlciBvdXQgYW55IHByb3RvdHlwZSBvYmplY3RzIHVzaW5nIHRoZSBjaXJjdWxhciBjaGVjay5cbiAgICAgICEodmFsdWUuY29uc3RydWN0b3IgJiYgdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlID09PSB2YWx1ZSkpIHtcbiAgICB2YXIgcmV0ID0gdmFsdWUuaW5zcGVjdChyZWN1cnNlVGltZXMsIGN0eCk7XG4gICAgaWYgKCFpc1N0cmluZyhyZXQpKSB7XG4gICAgICByZXQgPSBmb3JtYXRWYWx1ZShjdHgsIHJldCwgcmVjdXJzZVRpbWVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8vIFByaW1pdGl2ZSB0eXBlcyBjYW5ub3QgaGF2ZSBwcm9wZXJ0aWVzXG4gIHZhciBwcmltaXRpdmUgPSBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSk7XG4gIGlmIChwcmltaXRpdmUpIHtcbiAgICByZXR1cm4gcHJpbWl0aXZlO1xuICB9XG5cbiAgLy8gTG9vayB1cCB0aGUga2V5cyBvZiB0aGUgb2JqZWN0LlxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlKTtcbiAgdmFyIHZpc2libGVLZXlzID0gYXJyYXlUb0hhc2goa2V5cyk7XG5cbiAgaWYgKGN0eC5zaG93SGlkZGVuKSB7XG4gICAga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHZhbHVlKTtcbiAgfVxuXG4gIC8vIElFIGRvZXNuJ3QgbWFrZSBlcnJvciBmaWVsZHMgbm9uLWVudW1lcmFibGVcbiAgLy8gaHR0cDovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L2llL2R3dzUyc2J0KHY9dnMuOTQpLmFzcHhcbiAgaWYgKGlzRXJyb3IodmFsdWUpXG4gICAgICAmJiAoa2V5cy5pbmRleE9mKCdtZXNzYWdlJykgPj0gMCB8fCBrZXlzLmluZGV4T2YoJ2Rlc2NyaXB0aW9uJykgPj0gMCkpIHtcbiAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgLy8gU29tZSB0eXBlIG9mIG9iamVjdCB3aXRob3V0IHByb3BlcnRpZXMgY2FuIGJlIHNob3J0Y3V0dGVkLlxuICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgIHZhciBuYW1lID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tGdW5jdGlvbicgKyBuYW1lICsgJ10nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH1cbiAgICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKERhdGUucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAnZGF0ZScpO1xuICAgIH1cbiAgICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIGJhc2UgPSAnJywgYXJyYXkgPSBmYWxzZSwgYnJhY2VzID0gWyd7JywgJ30nXTtcblxuICAvLyBNYWtlIEFycmF5IHNheSB0aGF0IHRoZXkgYXJlIEFycmF5XG4gIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgIGFycmF5ID0gdHJ1ZTtcbiAgICBicmFjZXMgPSBbJ1snLCAnXSddO1xuICB9XG5cbiAgLy8gTWFrZSBmdW5jdGlvbnMgc2F5IHRoYXQgdGhleSBhcmUgZnVuY3Rpb25zXG4gIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgIHZhciBuID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgYmFzZSA9ICcgW0Z1bmN0aW9uJyArIG4gKyAnXSc7XG4gIH1cblxuICAvLyBNYWtlIFJlZ0V4cHMgc2F5IHRoYXQgdGhleSBhcmUgUmVnRXhwc1xuICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGRhdGVzIHdpdGggcHJvcGVydGllcyBmaXJzdCBzYXkgdGhlIGRhdGVcbiAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgRGF0ZS5wcm90b3R5cGUudG9VVENTdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGVycm9yIHdpdGggbWVzc2FnZSBmaXJzdCBzYXkgdGhlIGVycm9yXG4gIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICBpZiAoa2V5cy5sZW5ndGggPT09IDAgJiYgKCFhcnJheSB8fCB2YWx1ZS5sZW5ndGggPT0gMCkpIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArIGJyYWNlc1sxXTtcbiAgfVxuXG4gIGlmIChyZWN1cnNlVGltZXMgPCAwKSB7XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbT2JqZWN0XScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG5cbiAgY3R4LnNlZW4ucHVzaCh2YWx1ZSk7XG5cbiAgdmFyIG91dHB1dDtcbiAgaWYgKGFycmF5KSB7XG4gICAgb3V0cHV0ID0gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cyk7XG4gIH0gZWxzZSB7XG4gICAgb3V0cHV0ID0ga2V5cy5tYXAoZnVuY3Rpb24oa2V5KSB7XG4gICAgICByZXR1cm4gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSk7XG4gICAgfSk7XG4gIH1cblxuICBjdHguc2Vlbi5wb3AoKTtcblxuICByZXR1cm4gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKSB7XG4gIGlmIChpc1VuZGVmaW5lZCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCd1bmRlZmluZWQnLCAndW5kZWZpbmVkJyk7XG4gIGlmIChpc1N0cmluZyh2YWx1ZSkpIHtcbiAgICB2YXIgc2ltcGxlID0gJ1xcJycgKyBKU09OLnN0cmluZ2lmeSh2YWx1ZSkucmVwbGFjZSgvXlwifFwiJC9nLCAnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJykgKyAnXFwnJztcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoc2ltcGxlLCAnc3RyaW5nJyk7XG4gIH1cbiAgaWYgKGlzTnVtYmVyKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ251bWJlcicpO1xuICBpZiAoaXNCb29sZWFuKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ2Jvb2xlYW4nKTtcbiAgLy8gRm9yIHNvbWUgcmVhc29uIHR5cGVvZiBudWxsIGlzIFwib2JqZWN0XCIsIHNvIHNwZWNpYWwgY2FzZSBoZXJlLlxuICBpZiAoaXNOdWxsKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ251bGwnLCAnbnVsbCcpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEVycm9yKHZhbHVlKSB7XG4gIHJldHVybiAnWycgKyBFcnJvci5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgKyAnXSc7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cykge1xuICB2YXIgb3V0cHV0ID0gW107XG4gIGZvciAodmFyIGkgPSAwLCBsID0gdmFsdWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgaWYgKGhhc093blByb3BlcnR5KHZhbHVlLCBTdHJpbmcoaSkpKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIFN0cmluZyhpKSwgdHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQucHVzaCgnJyk7XG4gICAgfVxuICB9XG4gIGtleXMuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICBpZiAoIWtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAga2V5LCB0cnVlKSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KSB7XG4gIHZhciBuYW1lLCBzdHIsIGRlc2M7XG4gIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHZhbHVlLCBrZXkpIHx8IHsgdmFsdWU6IHZhbHVlW2tleV0gfTtcbiAgaWYgKGRlc2MuZ2V0KSB7XG4gICAgaWYgKGRlc2Muc2V0KSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlci9TZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKGRlc2Muc2V0KSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAoIWhhc093blByb3BlcnR5KHZpc2libGVLZXlzLCBrZXkpKSB7XG4gICAgbmFtZSA9ICdbJyArIGtleSArICddJztcbiAgfVxuICBpZiAoIXN0cikge1xuICAgIGlmIChjdHguc2Vlbi5pbmRleE9mKGRlc2MudmFsdWUpIDwgMCkge1xuICAgICAgaWYgKGlzTnVsbChyZWN1cnNlVGltZXMpKSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgZGVzYy52YWx1ZSwgbnVsbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIHJlY3Vyc2VUaW1lcyAtIDEpO1xuICAgICAgfVxuICAgICAgaWYgKHN0ci5pbmRleE9mKCdcXG4nKSA+IC0xKSB7XG4gICAgICAgIGlmIChhcnJheSkge1xuICAgICAgICAgIHN0ciA9IHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKS5zdWJzdHIoMik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyID0gJ1xcbicgKyBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbQ2lyY3VsYXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKGlzVW5kZWZpbmVkKG5hbWUpKSB7XG4gICAgaWYgKGFycmF5ICYmIGtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIG5hbWUgPSBKU09OLnN0cmluZ2lmeSgnJyArIGtleSk7XG4gICAgaWYgKG5hbWUubWF0Y2goL15cIihbYS16QS1aX11bYS16QS1aXzAtOV0qKVwiJC8pKSB7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHIoMSwgbmFtZS5sZW5ndGggLSAyKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnbmFtZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lID0gbmFtZS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKF5cInxcIiQpL2csIFwiJ1wiKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnc3RyaW5nJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWUgKyAnOiAnICsgc3RyO1xufVxuXG5cbmZ1bmN0aW9uIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKSB7XG4gIHZhciBudW1MaW5lc0VzdCA9IDA7XG4gIHZhciBsZW5ndGggPSBvdXRwdXQucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cikge1xuICAgIG51bUxpbmVzRXN0Kys7XG4gICAgaWYgKGN1ci5pbmRleE9mKCdcXG4nKSA+PSAwKSBudW1MaW5lc0VzdCsrO1xuICAgIHJldHVybiBwcmV2ICsgY3VyLnJlcGxhY2UoL1xcdTAwMWJcXFtcXGRcXGQ/bS9nLCAnJykubGVuZ3RoICsgMTtcbiAgfSwgMCk7XG5cbiAgaWYgKGxlbmd0aCA+IDYwKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArXG4gICAgICAgICAgIChiYXNlID09PSAnJyA/ICcnIDogYmFzZSArICdcXG4gJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBvdXRwdXQuam9pbignLFxcbiAgJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBicmFjZXNbMV07XG4gIH1cblxuICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArICcgJyArIG91dHB1dC5qb2luKCcsICcpICsgJyAnICsgYnJhY2VzWzFdO1xufVxuXG5cbi8vIE5PVEU6IFRoZXNlIHR5cGUgY2hlY2tpbmcgZnVuY3Rpb25zIGludGVudGlvbmFsbHkgZG9uJ3QgdXNlIGBpbnN0YW5jZW9mYFxuLy8gYmVjYXVzZSBpdCBpcyBmcmFnaWxlIGFuZCBjYW4gYmUgZWFzaWx5IGZha2VkIHdpdGggYE9iamVjdC5jcmVhdGUoKWAuXG5mdW5jdGlvbiBpc0FycmF5KGFyKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KGFyKTtcbn1cbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5cbmZ1bmN0aW9uIGlzQm9vbGVhbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJztcbn1cbmV4cG9ydHMuaXNCb29sZWFuID0gaXNCb29sZWFuO1xuXG5mdW5jdGlvbiBpc051bGwoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbCA9IGlzTnVsbDtcblxuZnVuY3Rpb24gaXNOdWxsT3JVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsT3JVbmRlZmluZWQgPSBpc051bGxPclVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cbmV4cG9ydHMuaXNOdW1iZXIgPSBpc051bWJlcjtcblxuZnVuY3Rpb24gaXNTdHJpbmcoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3RyaW5nJztcbn1cbmV4cG9ydHMuaXNTdHJpbmcgPSBpc1N0cmluZztcblxuZnVuY3Rpb24gaXNTeW1ib2woYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3ltYm9sJztcbn1cbmV4cG9ydHMuaXNTeW1ib2wgPSBpc1N5bWJvbDtcblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbmV4cG9ydHMuaXNVbmRlZmluZWQgPSBpc1VuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNSZWdFeHAocmUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KHJlKSAmJiBvYmplY3RUb1N0cmluZyhyZSkgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufVxuZXhwb3J0cy5pc1JlZ0V4cCA9IGlzUmVnRXhwO1xuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcblxuZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGQpICYmIG9iamVjdFRvU3RyaW5nKGQpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5leHBvcnRzLmlzRGF0ZSA9IGlzRGF0ZTtcblxuZnVuY3Rpb24gaXNFcnJvcihlKSB7XG4gIHJldHVybiBpc09iamVjdChlKSAmJlxuICAgICAgKG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nIHx8IGUgaW5zdGFuY2VvZiBFcnJvcik7XG59XG5leHBvcnRzLmlzRXJyb3IgPSBpc0Vycm9yO1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcgfHwgIC8vIEVTNiBzeW1ib2xcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICd1bmRlZmluZWQnO1xufVxuZXhwb3J0cy5pc1ByaW1pdGl2ZSA9IGlzUHJpbWl0aXZlO1xuXG5leHBvcnRzLmlzQnVmZmVyID0gcmVxdWlyZSgnLi9zdXBwb3J0L2lzQnVmZmVyJyk7XG5cbmZ1bmN0aW9uIG9iamVjdFRvU3RyaW5nKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn1cblxuXG5mdW5jdGlvbiBwYWQobikge1xuICByZXR1cm4gbiA8IDEwID8gJzAnICsgbi50b1N0cmluZygxMCkgOiBuLnRvU3RyaW5nKDEwKTtcbn1cblxuXG52YXIgbW9udGhzID0gWydKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsXG4gICAgICAgICAgICAgICdPY3QnLCAnTm92JywgJ0RlYyddO1xuXG4vLyAyNiBGZWIgMTY6MTk6MzRcbmZ1bmN0aW9uIHRpbWVzdGFtcCgpIHtcbiAgdmFyIGQgPSBuZXcgRGF0ZSgpO1xuICB2YXIgdGltZSA9IFtwYWQoZC5nZXRIb3VycygpKSxcbiAgICAgICAgICAgICAgcGFkKGQuZ2V0TWludXRlcygpKSxcbiAgICAgICAgICAgICAgcGFkKGQuZ2V0U2Vjb25kcygpKV0uam9pbignOicpO1xuICByZXR1cm4gW2QuZ2V0RGF0ZSgpLCBtb250aHNbZC5nZXRNb250aCgpXSwgdGltZV0uam9pbignICcpO1xufVxuXG5cbi8vIGxvZyBpcyBqdXN0IGEgdGhpbiB3cmFwcGVyIHRvIGNvbnNvbGUubG9nIHRoYXQgcHJlcGVuZHMgYSB0aW1lc3RhbXBcbmV4cG9ydHMubG9nID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCclcyAtICVzJywgdGltZXN0YW1wKCksIGV4cG9ydHMuZm9ybWF0LmFwcGx5KGV4cG9ydHMsIGFyZ3VtZW50cykpO1xufTtcblxuXG4vKipcbiAqIEluaGVyaXQgdGhlIHByb3RvdHlwZSBtZXRob2RzIGZyb20gb25lIGNvbnN0cnVjdG9yIGludG8gYW5vdGhlci5cbiAqXG4gKiBUaGUgRnVuY3Rpb24ucHJvdG90eXBlLmluaGVyaXRzIGZyb20gbGFuZy5qcyByZXdyaXR0ZW4gYXMgYSBzdGFuZGFsb25lXG4gKiBmdW5jdGlvbiAobm90IG9uIEZ1bmN0aW9uLnByb3RvdHlwZSkuIE5PVEU6IElmIHRoaXMgZmlsZSBpcyB0byBiZSBsb2FkZWRcbiAqIGR1cmluZyBib290c3RyYXBwaW5nIHRoaXMgZnVuY3Rpb24gbmVlZHMgdG8gYmUgcmV3cml0dGVuIHVzaW5nIHNvbWUgbmF0aXZlXG4gKiBmdW5jdGlvbnMgYXMgcHJvdG90eXBlIHNldHVwIHVzaW5nIG5vcm1hbCBKYXZhU2NyaXB0IGRvZXMgbm90IHdvcmsgYXNcbiAqIGV4cGVjdGVkIGR1cmluZyBib290c3RyYXBwaW5nIChzZWUgbWlycm9yLmpzIGluIHIxMTQ5MDMpLlxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGN0b3IgQ29uc3RydWN0b3IgZnVuY3Rpb24gd2hpY2ggbmVlZHMgdG8gaW5oZXJpdCB0aGVcbiAqICAgICBwcm90b3R5cGUuXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBzdXBlckN0b3IgQ29uc3RydWN0b3IgZnVuY3Rpb24gdG8gaW5oZXJpdCBwcm90b3R5cGUgZnJvbS5cbiAqL1xuZXhwb3J0cy5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG5cbmV4cG9ydHMuX2V4dGVuZCA9IGZ1bmN0aW9uKG9yaWdpbiwgYWRkKSB7XG4gIC8vIERvbid0IGRvIGFueXRoaW5nIGlmIGFkZCBpc24ndCBhbiBvYmplY3RcbiAgaWYgKCFhZGQgfHwgIWlzT2JqZWN0KGFkZCkpIHJldHVybiBvcmlnaW47XG5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhhZGQpO1xuICB2YXIgaSA9IGtleXMubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgb3JpZ2luW2tleXNbaV1dID0gYWRkW2tleXNbaV1dO1xuICB9XG4gIHJldHVybiBvcmlnaW47XG59O1xuXG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuIl19
