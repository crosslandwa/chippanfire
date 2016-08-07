(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var Push = require('push-wrapper'),
    foreach = require('lodash.foreach'),
    partial = require('lodash.partial'),
    Player = require('./src/player.js'),
    context = window.AudioContext ? new window.AudioContext() : new window.webkitAudioContext(),
    Repetae = require('./src/repetae.js'),
    Repeater = require('./src/repeater.js'),
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
            repetae = new Repetae(Repeater.create_scheduled_by_audio_context(context), intervals['1/4']);

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

},{"./src/bpm.js":24,"./src/interval.js":25,"./src/player.js":26,"./src/repeater.js":27,"./src/repetae.js":28,"lodash.foreach":9,"lodash.partial":13,"push-wrapper":16}],2:[function(require,module,exports){
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

},{"events":29,"lodash.foreach":9,"util":33}],25:[function(require,module,exports){
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

},{"events":29,"lodash.foreach":9,"util":33}],26:[function(require,module,exports){
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
        filterNode.frequency.value = clip(f, 30, 20000);
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

},{"wac.sample-player":23}],27:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util');
/*
Repeatedly calls the passed callback at the specified interval until told to stop
*/
function Repeater(setTimeout, initial_interval) {
    EventEmitter.call(this);
    var repeater = this;
    this._is_scheduling = false;
    this._interval = initial_interval > 20 ? initial_interval : 500; // ms

    this.interval = function (amount_ms) {
        repeater._interval = amount_ms > 20 ? amount_ms : 20; // 20ms min interval
        repeater.report_interval();
    };

    this.start = function (callback) {
        if (repeater._is_scheduling) return;
        repeater._is_scheduling = true;
        callback();
        this._recursiveSetTimeout(callback);
    };

    this._recursiveSetTimeout = function (callback) {
        var _this = this;

        setTimeout(function () {
            if (repeater._is_scheduling) {
                callback();
                _this._recursiveSetTimeout(callback);
            }
        }, repeater._interval);
    };

    this._call_and_reschedule = function (callback) {
        if (repeater._is_scheduling) {
            callback();
            scheduled_execution(function () {
                return repeater._call_and_reschedule(callback);
            }, repeater._interval);
        };
    };

    this.stop = function () {
        repeater._is_scheduling = false;
    };

    this.report_interval = function () {
        repeater.emit('interval', repeater._interval);
    };
}
util.inherits(Repeater, EventEmitter);

function AudioSetTimeout(context) {
    this.setTimeout = function (callback, time_ms) {
        var source = context.createBufferSource(),
            now = context.currentTime,
            thousandth = context.sampleRate / 1000,
            scheduled_at = now + time_ms / 1000 - 0.001;
        // a buffer length of 1 sample doesn't work on IOS, so use 1/1000th of a second
        var buffer = context.createBuffer(1, thousandth, context.sampleRate);
        source.addEventListener('ended', callback);
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(scheduled_at);
    };
}

// Adaptor function used to bind to web Audio API and utilise its audio-rate scheduling
Repeater.create_scheduled_by_audio_context = function (context, initial_interval) {
    return new Repeater(new AudioSetTimeout(context).setTimeout, initial_interval);
};

module.exports = Repeater;

},{"events":29,"util":33}],28:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    Repeater = require('./repeater.js');

function Repetae(repeater, initial_interval) {
    EventEmitter.call(this);
    var repetae = this;
    this._active = false;
    this._time_changed = false;
    this._being_pressed = false;
    this._current_interval = initial_interval;

    repetae._current_interval.on('changed', repeater.interval);
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
            repetae._current_interval.removeListener('changed', repeater.interval);
            repetae._current_interval = new_interval;
            repetae._current_interval.on('changed', repeater.interval);
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

module.exports = Repetae;

},{"./repeater.js":27,"events":29,"util":33}],29:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL25wbS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImFwcC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX2FycmF5ZWFjaC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX2Jhc2VlYWNoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5fYmluZGNhbGxiYWNrL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5fY3JlYXRld3JhcHBlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX2dldG5hdGl2ZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX3JlcGxhY2Vob2xkZXJzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5fcm9vdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guZm9yZWFjaC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guaXNhcmd1bWVudHMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmlzYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmtleXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLnBhcnRpYWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLnJhbmdlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5yZXN0cGFyYW0vaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHVzaC13cmFwcGVyL3B1c2guanMiLCJub2RlX21vZHVsZXMvcHVzaC13cmFwcGVyL3NyYy9idXR0b25zLmpzIiwibm9kZV9tb2R1bGVzL3B1c2gtd3JhcHBlci9zcmMvY29udHJvbC1idXR0b25zLmpzIiwibm9kZV9tb2R1bGVzL3B1c2gtd3JhcHBlci9zcmMvZ3JpZC5qcyIsIm5vZGVfbW9kdWxlcy9wdXNoLXdyYXBwZXIvc3JjL2tub2JzLmpzIiwibm9kZV9tb2R1bGVzL3B1c2gtd3JhcHBlci9zcmMvbGNkcy5qcyIsIm5vZGVfbW9kdWxlcy9wdXNoLXdyYXBwZXIvc3JjL3RvdWNoc3RyaXAuanMiLCJub2RlX21vZHVsZXMvd2FjLnNhbXBsZS1wbGF5ZXIvU2FtcGxlUGxheWVyLmpzIiwic3JjL2JwbS5qcyIsInNyYy9pbnRlcnZhbC5qcyIsInNyYy9wbGF5ZXIuanMiLCJzcmMvcmVwZWF0ZXIuanMiLCJzcmMvcmVwZXRhZS5qcyIsIi4uLy4uL25wbS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCIuLi8uLi9ucG0vbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwiLi4vLi4vbnBtL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwiLi4vLi4vbnBtL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvdXRpbC9zdXBwb3J0L2lzQnVmZmVyQnJvd3Nlci5qcyIsIi4uLy4uL25wbS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOztBQUNBLElBQU0sT0FBTyxRQUFRLGNBQVIsQ0FBYjtBQUFBLElBQ0ksVUFBVSxRQUFRLGdCQUFSLENBRGQ7QUFBQSxJQUVJLFVBQVUsUUFBUSxnQkFBUixDQUZkO0FBQUEsSUFHSSxTQUFTLFFBQVEsaUJBQVIsQ0FIYjtBQUFBLElBSUksVUFBVSxPQUFPLFlBQVAsR0FBc0IsSUFBSSxPQUFPLFlBQVgsRUFBdEIsR0FBa0QsSUFBSSxPQUFPLGtCQUFYLEVBSmhFO0FBQUEsSUFLSSxVQUFVLFFBQVEsa0JBQVIsQ0FMZDtBQUFBLElBTUksV0FBVyxRQUFRLG1CQUFSLENBTmY7QUFBQSxJQU9JLE1B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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbnFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnXG5jb25zdCBQdXNoID0gcmVxdWlyZSgncHVzaC13cmFwcGVyJyksXG4gICAgZm9yZWFjaCA9IHJlcXVpcmUoJ2xvZGFzaC5mb3JlYWNoJyksXG4gICAgcGFydGlhbCA9IHJlcXVpcmUoJ2xvZGFzaC5wYXJ0aWFsJyksXG4gICAgUGxheWVyID0gcmVxdWlyZSgnLi9zcmMvcGxheWVyLmpzJyksXG4gICAgY29udGV4dCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgPyBuZXcgd2luZG93LkF1ZGlvQ29udGV4dCgpIDogbmV3IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQoKSxcbiAgICBSZXBldGFlID0gcmVxdWlyZSgnLi9zcmMvcmVwZXRhZS5qcycpLFxuICAgIFJlcGVhdGVyID0gcmVxdWlyZSgnLi9zcmMvcmVwZWF0ZXIuanMnKSxcbiAgICBCUE0gPSByZXF1aXJlKCcuL3NyYy9icG0uanMnKSxcbiAgICBicG0gPSBuZXcgQlBNKDEyMCksXG4gICAgSW50ZXJ2YWwgPSByZXF1aXJlKCcuL3NyYy9pbnRlcnZhbC5qcycpLFxuICAgIGludGVydmFscyA9IHtcbiAgICAgICAgJzEvNCc6IEludGVydmFsWyc0biddKGJwbSwgJzEvNCcpLFxuICAgICAgICAnMS80dCc6IEludGVydmFsWyc0bnQnXShicG0sICcxLzR0JyksXG4gICAgICAgICcxLzgnOiBJbnRlcnZhbFsnOG4nXShicG0sICcxLzgnKSxcbiAgICAgICAgJzEvOHQnOiBJbnRlcnZhbFsnOG50J10oYnBtLCAnMS84dCcpLFxuICAgICAgICAnMS8xNic6IEludGVydmFsWycxNm4nXShicG0sICcxLzE2JyksXG4gICAgICAgICcxLzE2dCc6IEludGVydmFsWycxNm50J10oYnBtLCAnMS8xNnQnKSxcbiAgICAgICAgJzEvMzInOiBJbnRlcnZhbFsnMzJuJ10oYnBtLCAnMS8zMicpLFxuICAgICAgICAnMS8zMnQnOiBJbnRlcnZhbFsnMzJudCddKGJwbSwgJzEvMzJ0JyksXG4gICAgfSxcbiAgICBzYW1wbGVzID0gW1xuICAgICAgICAnYXNzZXRzL2F1ZGlvL0JvbnVzX0tpY2syNy5tcDMnLFxuICAgICAgICAnYXNzZXRzL2F1ZGlvL3NuYXJlX3R1cm5ib290Lm1wMycsXG4gICAgICAgICdhc3NldHMvYXVkaW8vSGFuZENsYXAubXAzJyxcbiAgICAgICAgJ2Fzc2V0cy9hdWRpby9CZWF0MDdfSGF0Lm1wMycsXG4gICAgICAgICdhc3NldHMvYXVkaW8vSEhfS0lUMDlfMTAwX1RNQi5tcDMnLFxuICAgICAgICAnYXNzZXRzL2F1ZGlvL2NsaW5nZmlsbS5tcDMnLFxuICAgICAgICAnYXNzZXRzL2F1ZGlvL3RhbmctMS5tcDMnLFxuICAgICAgICAnYXNzZXRzL2F1ZGlvL0Nhc3NldHRlODA4X1RvbTAxLm1wMydcbiAgICBdLFxuICAgIGZpbHRlcl9mcmVxdWVuY2llcyA9IFswLCAxMDAsIDIwMCwgNDAwLCA4MDAsIDIwMDAsIDYwMDAsIDEwMDAwLCAyMDAwMF07XG5cbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgKCkgPT4ge1xuICAgIGlmIChuYXZpZ2F0b3IucmVxdWVzdE1JRElBY2Nlc3MpIHtcbiAgICAgICAgbmF2aWdhdG9yLnJlcXVlc3RNSURJQWNjZXNzKHsgc3lzZXg6IHRydWUgfSlcbiAgICAgICAgICAgIC50aGVuKFB1c2guY3JlYXRlX2JvdW5kX3RvX3dlYl9taWRpX2FwaSlcbiAgICAgICAgICAgIC50aGVuKG9mZl93ZV9nbylcbiAgICB9IGVsc2Uge1xuICAgICAgICBQcm9taXNlLnJlc29sdmUobmV3IFB1c2goeyBzZW5kOiAoYnl0ZXMpID0+IHsgfSB9KSkudGhlbihvZmZfd2VfZ28pLnRoZW4oc2hvd19ub19taWRpX3dhcm5pbmcpO1xuICAgIH1cbn0pO1xuXG5mdW5jdGlvbiBzaG93X25vX21pZGlfd2FybmluZygpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIm5vLW1pZGktd2FybmluZ1wiKS5zdHlsZS5kaXNwbGF5ID0gJyc7XG59XG5cbmZ1bmN0aW9uIG9mZl93ZV9nbyhib3VuZF9wdXNoKSB7XG4gICAgY29uc3QgYnV0dG9ucyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3B1c2gtd3JhcHBlci1idXR0b24nKSxcbiAgICAgICAgcGxheWVycyA9IGNyZWF0ZV9wbGF5ZXJzKCksXG4gICAgICAgIHB1c2ggPSBib3VuZF9wdXNoO1xuXG4gICAgcHVzaC5sY2QuY2xlYXIoKTtcblxuICAgIGZvcmVhY2gocGxheWVycywgKHBsYXllciwgaSkgPT4ge1xuICAgICAgICB2YXIgY29sdW1uX251bWJlciA9IGkgKyAxLFxuICAgICAgICAgICAgZnVsbF9wYXRoX3NhbXBsZV9uYW1lID0gc2FtcGxlc1tpXS5zcGxpdCgnLicpWzBdLFxuICAgICAgICAgICAgc2FtcGxlX25hbWUgPSBmdWxsX3BhdGhfc2FtcGxlX25hbWUuc3BsaXQoJy8nKS5wb3AoKSxcbiAgICAgICAgICAgIHJlcGV0YWUgPSBuZXcgUmVwZXRhZShSZXBlYXRlci5jcmVhdGVfc2NoZWR1bGVkX2J5X2F1ZGlvX2NvbnRleHQoY29udGV4dCksIGludGVydmFsc1snMS80J10pO1xuXG4gICAgICAgIHB1c2guZ3JpZC54W2NvbHVtbl9udW1iZXJdLnNlbGVjdC5vbigncHJlc3NlZCcsIHJlcGV0YWUucHJlc3MpO1xuICAgICAgICBwdXNoLmdyaWQueFtjb2x1bW5fbnVtYmVyXS5zZWxlY3Qub24oJ3JlbGVhc2VkJywgcmVwZXRhZS5yZWxlYXNlKTtcblxuICAgICAgICBwdXNoLmdyaWQueFtjb2x1bW5fbnVtYmVyXS5zZWxlY3QubGVkX29uKCk7XG4gICAgICAgIHJlcGV0YWUub24oJ29uJywgcGFydGlhbChwdXNoLmdyaWQueFtjb2x1bW5fbnVtYmVyXS5zZWxlY3QubGVkX3JnYiwgMCwgMCwgMjU1KSk7XG4gICAgICAgIHJlcGV0YWUub24oJ29mZicsIHB1c2guZ3JpZC54W2NvbHVtbl9udW1iZXJdLnNlbGVjdC5sZWRfb24pO1xuICAgICAgICByZXBldGFlLm9uKCdpbnRlcnZhbCcsIHB1c2gubGNkLnhbY29sdW1uX251bWJlcl0ueVsxXS51cGRhdGUpO1xuXG4gICAgICAgIHJlcGV0YWUucmVwb3J0X2ludGVydmFsKCk7XG5cbiAgICAgICAgZm9yZWFjaChpbnRlcnZhbHMsIChpbnRlcnZhbCwgYnV0dG9uX25hbWUpID0+IHtcbiAgICAgICAgICAgIHB1c2guYnV0dG9uW2J1dHRvbl9uYW1lXS5vbigncHJlc3NlZCcsIHBhcnRpYWwocmVwZXRhZS5pbnRlcnZhbCwgaW50ZXJ2YWwpKVxuICAgICAgICB9KTtcblxuICAgICAgICB0dXJuX29mZl9jb2x1bW4ocHVzaCwgY29sdW1uX251bWJlcik7XG4gICAgICAgIHB1c2gubGNkLnhbY29sdW1uX251bWJlcl0ueVsyXS51cGRhdGUoc2FtcGxlX25hbWUubGVuZ3RoID4gOCA/IHNhbXBsZV9uYW1lLnN1YnN0cihzYW1wbGVfbmFtZS5sZW5ndGggLSA4KSA6IHNhbXBsZV9uYW1lKTtcbiAgICAgICAgcGxheWVyLm9uKCdzdGFydGVkJywgcGFydGlhbCh0dXJuX2J1dHRvbl9kaXNwbGF5X29uLCBidXR0b25zW2ldKSk7XG4gICAgICAgIHBsYXllci5vbignc3RvcHBlZCcsIHBhcnRpYWwodHVybl9idXR0b25fZGlzcGxheV9vZmYsIGJ1dHRvbnNbaV0pKTtcbiAgICAgICAgcGxheWVyLm9uKCdzdGFydGVkJywgcGFydGlhbCh0dXJuX29uX2NvbHVtbiwgcHVzaCwgY29sdW1uX251bWJlcikpO1xuICAgICAgICBwbGF5ZXIub24oJ3N0b3BwZWQnLCBwYXJ0aWFsKHR1cm5fb2ZmX2NvbHVtbiwgcHVzaCwgY29sdW1uX251bWJlcikpO1xuXG4gICAgICAgIHBsYXllci5vbigncGl0Y2gnLCBwdXNoLmxjZC54W2NvbHVtbl9udW1iZXJdLnlbNF0udXBkYXRlKTtcbiAgICAgICAgcHVzaC5jaGFubmVsW2NvbHVtbl9udW1iZXJdLmtub2Iub24oJ3R1cm5lZCcsIHBsYXllci5jaGFuZ2VQaXRjaEJ5SW50ZXJ2YWwpO1xuICAgICAgICBwbGF5ZXIucmVwb3J0UGl0Y2goKTtcblxuICAgICAgICBidXR0b25zW2ldLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsICgpID0+IHsgcGxheWVyLmN1dE9mZihmaWx0ZXJfZnJlcXVlbmNpZXNbOF0pLnBsYXkobWlkaUdhaW4oMTEwKSkgfSk7XG4gICAgICAgIGJpbmRfY29sdW1uX3RvX3BsYXllcihwdXNoLCBwbGF5ZXIsIGNvbHVtbl9udW1iZXIsIHJlcGV0YWUpO1xuICAgIH0pO1xuXG4gICAgZm9yZWFjaChpbnRlcnZhbHMsIChpbnRlcnZhbCwgYnV0dG9uX25hbWUpID0+IHtcbiAgICAgICAgcHVzaC5idXR0b25bYnV0dG9uX25hbWVdLmxlZF9kaW0oKTtcbiAgICB9KTtcblxuICAgIGJpbmRfcGl0Y2hiZW5kKHB1c2gsIHBsYXllcnMpO1xuXG4gICAgYmluZFF3ZXJ0eXVpVG9QbGF5YmFjayhwbGF5ZXJzKTtcbiAgICBiaW5kX3RlbXBvX2tub2JfdG9fYnBtKHB1c2gsIGJwbSk7XG4gICAgYnBtLnJlcG9ydCgpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVfcGxheWVycygpIHtcbiAgICB2YXIgcGxheWVycyA9IFtdO1xuICAgIGZvciAodmFyICBpID0gMDsgaSA8IHNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcGxheWVyc1tpXSA9IG5ldyBQbGF5ZXIoc2FtcGxlc1tpXSwgY29udGV4dCkudG9NYXN0ZXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIHBsYXllcnM7XG59XG5cbmZ1bmN0aW9uIGJpbmRfY29sdW1uX3RvX3BsYXllcihwdXNoLCBwbGF5ZXIsIHgsIHJlcGV0YWUpIHtcbiAgICBsZXQgbXV0YWJsZV92ZWxvY2l0eSA9IDEyNyxcbiAgICAgICAgbXV0YWJsZV9mcmVxdWVuY3kgPSBmaWx0ZXJfZnJlcXVlbmNpZXNbOF0sXG4gICAgICAgIHByZXNzZWRfcGFkc19pbl9jb2wgPSAwO1xuXG4gICAgbGV0IHBsYXliYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHBsYXllci5jdXRPZmYobXV0YWJsZV9mcmVxdWVuY3kpLnBsYXkobWlkaUdhaW4obXV0YWJsZV92ZWxvY2l0eSkpO1xuICAgIH1cblxuICAgIGZvcmVhY2goWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDhdLCAoeSkgPT4ge1xuICAgICAgICBjb25zdCBncmlkX2J1dHRvbiA9IHB1c2guZ3JpZC54W3hdLnlbeV07XG5cbiAgICAgICAgZ3JpZF9idXR0b24ub24oJ3ByZXNzZWQnLCAodmVsb2NpdHkpID0+IHtcbiAgICAgICAgICAgIG11dGFibGVfdmVsb2NpdHkgPSB2ZWxvY2l0eTtcbiAgICAgICAgICAgIG11dGFibGVfZnJlcXVlbmN5ID0gZmlsdGVyX2ZyZXF1ZW5jaWVzW3ldO1xuICAgICAgICAgICAgaWYgKCsrcHJlc3NlZF9wYWRzX2luX2NvbCA9PSAxKSByZXBldGFlLnN0YXJ0KHBsYXliYWNrKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGdyaWRfYnV0dG9uLm9uKCdhZnRlcnRvdWNoJywgKHByZXNzdXJlKSA9PiB7IGlmIChwcmVzc3VyZSA+IDApIG11dGFibGVfdmVsb2NpdHkgPSBwcmVzc3VyZSB9KTtcbiAgICAgICAgZ3JpZF9idXR0b24ub24oJ3JlbGVhc2VkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKC0tcHJlc3NlZF9wYWRzX2luX2NvbCA9PSAwKSByZXBldGFlLnN0b3AoKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGJpbmRRd2VydHl1aVRvUGxheWJhY2socGxheWVycykge1xuICAgIGxldCBsb29rdXAgPSB7MTEzOiAwLCAxMTk6IDEsIDEwMTogMiwgMTE0OiAzLCAxMTY6IDQsIDEyMTogNSwgMTE3OiA2LCAxMDU6IDd9O1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5cHJlc3NcIiwgKGV2ZW50KSA9PiB7XG4gICAgICAgIGlmIChldmVudC5jaGFyQ29kZSBpbiBsb29rdXApIHtcbiAgICAgICAgICAgIHBsYXllcnNbbG9va3VwW2V2ZW50LmNoYXJDb2RlXV0uY3V0T2ZmKGZpbHRlcl9mcmVxdWVuY2llc1s4XSkucGxheShtaWRpR2FpbigxMTApKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBtaWRpR2Fpbih2ZWxvY2l0eSkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHZlbG9jaXR5OiBmdW5jdGlvbigpIHsgcmV0dXJuIHZlbG9jaXR5IH0sXG4gICAgICAgIHRvQWJzb2x1dGU6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHZlbG9jaXR5IC8gMTI3O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0dXJuX29uX2NvbHVtbihwdXNoLCB4LCBnYWluKSB7XG4gICAgZm9yZWFjaChbMSwgMiwgMywgNCwgNSwgNiwgNywgOF0sICh5KSA9PiB7XG4gICAgICAgIGlmICgoKGdhaW4udmVsb2NpdHkoKSArIDE1KSAvIDE2KSA+PSB5KSB7XG4gICAgICAgICAgICBwdXNoLmdyaWQueFt4XS55W3ldLmxlZF9vbihnYWluLnZlbG9jaXR5KCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHVzaC5ncmlkLnhbeF0ueVt5XS5sZWRfb2ZmKCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gdHVybl9vZmZfY29sdW1uKHB1c2gsIHgpIHtcbiAgICBmb3JlYWNoKFsyLCAzLCA0LCA1LCA2LCA3LCA4XSwgKHkpID0+IHtcbiAgICAgICAgcHVzaC5ncmlkLnhbeF0ueVt5XS5sZWRfb2ZmKCk7XG4gICAgfSk7XG4gICAgcHVzaC5ncmlkLnhbeF0ueVsxXS5sZWRfb24oKTtcbn1cblxuZnVuY3Rpb24gYmluZF9waXRjaGJlbmQocHVzaCwgcGxheWVycykge1xuICAgIHB1c2gudG91Y2hzdHJpcC5vbigncGl0Y2hiZW5kJywgKHBiKSA9PiB7XG4gICAgICAgIHZhciByYXRlID0gc2NhbGUocGIsIDAsIDE2Mzg0LCAtMTIsIDEyKTtcbiAgICAgICAgZm9yZWFjaChwbGF5ZXJzLCAocGxheWVyKSA9PiBwbGF5ZXIubW9kdWxhdGVQaXRjaChyYXRlKSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGJpbmRfdGVtcG9fa25vYl90b19icG0ocHVzaCwgYnBtKSB7XG4gICAgcHVzaC5rbm9iWyd0ZW1wbyddLm9uKCd0dXJuZWQnLCBicG0uY2hhbmdlX2J5KTtcbiAgICBicG0ub24oJ2NoYW5nZWQnLCBicG0gPT4gcHVzaC5sY2QueFsxXS55WzNdLnVwZGF0ZSgnYnBtPSAnICsgYnBtLmN1cnJlbnQpKTtcbn1cblxuZnVuY3Rpb24gdHVybl9idXR0b25fZGlzcGxheV9vbih1aV9idG4pIHtcbiAgICB1aV9idG4uY2xhc3NMaXN0LmFkZCgnYWN0aXZlJyk7XG59XG5cbmZ1bmN0aW9uIHR1cm5fYnV0dG9uX2Rpc3BsYXlfb2ZmKHVpX2J0bikge1xuICAgIHVpX2J0bi5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKTtcbn1cblxuZnVuY3Rpb24gc2NhbGUoaW5wdXQsIG1pbkluLCBtYXhJbiwgbWluT3V0LCBtYXhPdXQpIHtcbiAgICByZXR1cm4gKChtYXhPdXQgLSBtaW5PdXQpICogKChpbnB1dCAtIG1pbkluKSAvIChtYXhJbiAtIG1pbkluKSkpICsgbWluT3V0O1xufSIsIi8qKlxuICogbG9kYXNoIDMuMC4wIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS43LjAgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKlxuICogQSBzcGVjaWFsaXplZCB2ZXJzaW9uIG9mIGBfLmZvckVhY2hgIGZvciBhcnJheXMgd2l0aG91dCBzdXBwb3J0IGZvciBjYWxsYmFja1xuICogc2hvcnRoYW5kcyBvciBgdGhpc2AgYmluZGluZy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGl0ZXJhdGVlIFRoZSBmdW5jdGlvbiBpbnZva2VkIHBlciBpdGVyYXRpb24uXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYGFycmF5YC5cbiAqL1xuZnVuY3Rpb24gYXJyYXlFYWNoKGFycmF5LCBpdGVyYXRlZSkge1xuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcblxuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIGlmIChpdGVyYXRlZShhcnJheVtpbmRleF0sIGluZGV4LCBhcnJheSkgPT09IGZhbHNlKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGFycmF5O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFycmF5RWFjaDtcbiIsIi8qKlxuICogbG9kYXNoIDMuMC40IChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIga2V5cyA9IHJlcXVpcmUoJ2xvZGFzaC5rZXlzJyk7XG5cbi8qKlxuICogVXNlZCBhcyB0aGUgW21heGltdW0gbGVuZ3RoXShodHRwczovL3Blb3BsZS5tb3ppbGxhLm9yZy9+am9yZW5kb3JmZi9lczYtZHJhZnQuaHRtbCNzZWMtbnVtYmVyLm1heF9zYWZlX2ludGVnZXIpXG4gKiBvZiBhbiBhcnJheS1saWtlIHZhbHVlLlxuICovXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTE7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8uZm9yRWFjaGAgd2l0aG91dCBzdXBwb3J0IGZvciBjYWxsYmFja1xuICogc2hvcnRoYW5kcyBhbmQgYHRoaXNgIGJpbmRpbmcuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBpdGVyYXRlZSBUaGUgZnVuY3Rpb24gaW52b2tlZCBwZXIgaXRlcmF0aW9uLlxuICogQHJldHVybnMge0FycmF5fE9iamVjdHxzdHJpbmd9IFJldHVybnMgYGNvbGxlY3Rpb25gLlxuICovXG52YXIgYmFzZUVhY2ggPSBjcmVhdGVCYXNlRWFjaChiYXNlRm9yT3duKTtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgYmFzZUZvckluYCBhbmQgYGJhc2VGb3JPd25gIHdoaWNoIGl0ZXJhdGVzXG4gKiBvdmVyIGBvYmplY3RgIHByb3BlcnRpZXMgcmV0dXJuZWQgYnkgYGtleXNGdW5jYCBpbnZva2luZyBgaXRlcmF0ZWVgIGZvclxuICogZWFjaCBwcm9wZXJ0eS4gSXRlcmF0ZWUgZnVuY3Rpb25zIG1heSBleGl0IGl0ZXJhdGlvbiBlYXJseSBieSBleHBsaWNpdGx5XG4gKiByZXR1cm5pbmcgYGZhbHNlYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGl0ZXJhdGUgb3Zlci5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGl0ZXJhdGVlIFRoZSBmdW5jdGlvbiBpbnZva2VkIHBlciBpdGVyYXRpb24uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBrZXlzRnVuYyBUaGUgZnVuY3Rpb24gdG8gZ2V0IHRoZSBrZXlzIG9mIGBvYmplY3RgLlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAqL1xudmFyIGJhc2VGb3IgPSBjcmVhdGVCYXNlRm9yKCk7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8uZm9yT3duYCB3aXRob3V0IHN1cHBvcnQgZm9yIGNhbGxiYWNrXG4gKiBzaG9ydGhhbmRzIGFuZCBgdGhpc2AgYmluZGluZy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGl0ZXJhdGUgb3Zlci5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGl0ZXJhdGVlIFRoZSBmdW5jdGlvbiBpbnZva2VkIHBlciBpdGVyYXRpb24uXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICovXG5mdW5jdGlvbiBiYXNlRm9yT3duKG9iamVjdCwgaXRlcmF0ZWUpIHtcbiAgcmV0dXJuIGJhc2VGb3Iob2JqZWN0LCBpdGVyYXRlZSwga2V5cyk7XG59XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8ucHJvcGVydHlgIHdpdGhvdXQgc3VwcG9ydCBmb3IgZGVlcCBwYXRocy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBwcm9wZXJ0eSB0byBnZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gYmFzZVByb3BlcnR5KGtleSkge1xuICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgcmV0dXJuIG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogb2JqZWN0W2tleV07XG4gIH07XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBiYXNlRWFjaGAgb3IgYGJhc2VFYWNoUmlnaHRgIGZ1bmN0aW9uLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBlYWNoRnVuYyBUaGUgZnVuY3Rpb24gdG8gaXRlcmF0ZSBvdmVyIGEgY29sbGVjdGlvbi5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW2Zyb21SaWdodF0gU3BlY2lmeSBpdGVyYXRpbmcgZnJvbSByaWdodCB0byBsZWZ0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgYmFzZSBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQmFzZUVhY2goZWFjaEZ1bmMsIGZyb21SaWdodCkge1xuICByZXR1cm4gZnVuY3Rpb24oY29sbGVjdGlvbiwgaXRlcmF0ZWUpIHtcbiAgICB2YXIgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGdldExlbmd0aChjb2xsZWN0aW9uKSA6IDA7XG4gICAgaWYgKCFpc0xlbmd0aChsZW5ndGgpKSB7XG4gICAgICByZXR1cm4gZWFjaEZ1bmMoY29sbGVjdGlvbiwgaXRlcmF0ZWUpO1xuICAgIH1cbiAgICB2YXIgaW5kZXggPSBmcm9tUmlnaHQgPyBsZW5ndGggOiAtMSxcbiAgICAgICAgaXRlcmFibGUgPSB0b09iamVjdChjb2xsZWN0aW9uKTtcblxuICAgIHdoaWxlICgoZnJvbVJpZ2h0ID8gaW5kZXgtLSA6ICsraW5kZXggPCBsZW5ndGgpKSB7XG4gICAgICBpZiAoaXRlcmF0ZWUoaXRlcmFibGVbaW5kZXhdLCBpbmRleCwgaXRlcmFibGUpID09PSBmYWxzZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvbGxlY3Rpb247XG4gIH07XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGJhc2UgZnVuY3Rpb24gZm9yIGBfLmZvckluYCBvciBgXy5mb3JJblJpZ2h0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtib29sZWFufSBbZnJvbVJpZ2h0XSBTcGVjaWZ5IGl0ZXJhdGluZyBmcm9tIHJpZ2h0IHRvIGxlZnQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBiYXNlIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVCYXNlRm9yKGZyb21SaWdodCkge1xuICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0LCBpdGVyYXRlZSwga2V5c0Z1bmMpIHtcbiAgICB2YXIgaXRlcmFibGUgPSB0b09iamVjdChvYmplY3QpLFxuICAgICAgICBwcm9wcyA9IGtleXNGdW5jKG9iamVjdCksXG4gICAgICAgIGxlbmd0aCA9IHByb3BzLmxlbmd0aCxcbiAgICAgICAgaW5kZXggPSBmcm9tUmlnaHQgPyBsZW5ndGggOiAtMTtcblxuICAgIHdoaWxlICgoZnJvbVJpZ2h0ID8gaW5kZXgtLSA6ICsraW5kZXggPCBsZW5ndGgpKSB7XG4gICAgICB2YXIga2V5ID0gcHJvcHNbaW5kZXhdO1xuICAgICAgaWYgKGl0ZXJhdGVlKGl0ZXJhYmxlW2tleV0sIGtleSwgaXRlcmFibGUpID09PSBmYWxzZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBcImxlbmd0aFwiIHByb3BlcnR5IHZhbHVlIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gYXZvaWQgYSBbSklUIGJ1Z10oaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE0Mjc5MilcbiAqIHRoYXQgYWZmZWN0cyBTYWZhcmkgb24gYXQgbGVhc3QgaU9TIDguMS04LjMgQVJNNjQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBcImxlbmd0aFwiIHZhbHVlLlxuICovXG52YXIgZ2V0TGVuZ3RoID0gYmFzZVByb3BlcnR5KCdsZW5ndGgnKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgbGVuZ3RoLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGJhc2VkIG9uIFtgVG9MZW5ndGhgXShodHRwczovL3Blb3BsZS5tb3ppbGxhLm9yZy9+am9yZW5kb3JmZi9lczYtZHJhZnQuaHRtbCNzZWMtdG9sZW5ndGgpLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgbGVuZ3RoLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzTGVuZ3RoKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgJiYgdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8PSBNQVhfU0FGRV9JTlRFR0VSO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGB2YWx1ZWAgdG8gYW4gb2JqZWN0IGlmIGl0J3Mgbm90IG9uZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcHJvY2Vzcy5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIG9iamVjdC5cbiAqL1xuZnVuY3Rpb24gdG9PYmplY3QodmFsdWUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KHZhbHVlKSA/IHZhbHVlIDogT2JqZWN0KHZhbHVlKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdCgxKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIC8vIEF2b2lkIGEgVjggSklUIGJ1ZyBpbiBDaHJvbWUgMTktMjAuXG4gIC8vIFNlZSBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MjI5MSBmb3IgbW9yZSBkZXRhaWxzLlxuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBiYXNlRWFjaDtcbiIsIi8qKlxuICogbG9kYXNoIDMuMC4xIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKlxuICogQSBzcGVjaWFsaXplZCB2ZXJzaW9uIG9mIGBiYXNlQ2FsbGJhY2tgIHdoaWNoIG9ubHkgc3VwcG9ydHMgYHRoaXNgIGJpbmRpbmdcbiAqIGFuZCBzcGVjaWZ5aW5nIHRoZSBudW1iZXIgb2YgYXJndW1lbnRzIHRvIHByb3ZpZGUgdG8gYGZ1bmNgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBiaW5kLlxuICogQHBhcmFtIHsqfSB0aGlzQXJnIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXG4gKiBAcGFyYW0ge251bWJlcn0gW2FyZ0NvdW50XSBUaGUgbnVtYmVyIG9mIGFyZ3VtZW50cyB0byBwcm92aWRlIHRvIGBmdW5jYC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgY2FsbGJhY2suXG4gKi9cbmZ1bmN0aW9uIGJpbmRDYWxsYmFjayhmdW5jLCB0aGlzQXJnLCBhcmdDb3VudCkge1xuICBpZiAodHlwZW9mIGZ1bmMgIT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBpZGVudGl0eTtcbiAgfVxuICBpZiAodGhpc0FyZyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGZ1bmM7XG4gIH1cbiAgc3dpdGNoIChhcmdDb3VudCkge1xuICAgIGNhc2UgMTogcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIHZhbHVlKTtcbiAgICB9O1xuICAgIGNhc2UgMzogcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgIH07XG4gICAgY2FzZSA0OiByZXR1cm4gZnVuY3Rpb24oYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCBhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICB9O1xuICAgIGNhc2UgNTogcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBvdGhlciwga2V5LCBvYmplY3QsIHNvdXJjZSkge1xuICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCB2YWx1ZSwgb3RoZXIsIGtleSwgb2JqZWN0LCBzb3VyY2UpO1xuICAgIH07XG4gIH1cbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3VtZW50cyk7XG4gIH07XG59XG5cbi8qKlxuICogVGhpcyBtZXRob2QgcmV0dXJucyB0aGUgZmlyc3QgYXJndW1lbnQgcHJvdmlkZWQgdG8gaXQuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBVdGlsaXR5XG4gKiBAcGFyYW0geyp9IHZhbHVlIEFueSB2YWx1ZS5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIGB2YWx1ZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIHZhciBvYmplY3QgPSB7ICd1c2VyJzogJ2ZyZWQnIH07XG4gKlxuICogXy5pZGVudGl0eShvYmplY3QpID09PSBvYmplY3Q7XG4gKiAvLyA9PiB0cnVlXG4gKi9cbmZ1bmN0aW9uIGlkZW50aXR5KHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBiaW5kQ2FsbGJhY2s7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjIuMCAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIgcm9vdCA9IHJlcXVpcmUoJ2xvZGFzaC5fcm9vdCcpO1xuXG4vKiogVXNlZCB0byBjb21wb3NlIGJpdG1hc2tzIGZvciB3cmFwcGVyIG1ldGFkYXRhLiAqL1xudmFyIEJJTkRfRkxBRyA9IDEsXG4gICAgQklORF9LRVlfRkxBRyA9IDIsXG4gICAgQ1VSUllfQk9VTkRfRkxBRyA9IDQsXG4gICAgQ1VSUllfRkxBRyA9IDgsXG4gICAgQ1VSUllfUklHSFRfRkxBRyA9IDE2LFxuICAgIFBBUlRJQUxfRkxBRyA9IDMyLFxuICAgIFBBUlRJQUxfUklHSFRfRkxBRyA9IDY0LFxuICAgIEFSWV9GTEFHID0gMTI4LFxuICAgIEZMSVBfRkxBRyA9IDUxMjtcblxuLyoqIFVzZWQgYXMgdGhlIGBUeXBlRXJyb3JgIG1lc3NhZ2UgZm9yIFwiRnVuY3Rpb25zXCIgbWV0aG9kcy4gKi9cbnZhciBGVU5DX0VSUk9SX1RFWFQgPSAnRXhwZWN0ZWQgYSBmdW5jdGlvbic7XG5cbi8qKiBVc2VkIGFzIHJlZmVyZW5jZXMgZm9yIHZhcmlvdXMgYE51bWJlcmAgY29uc3RhbnRzLiAqL1xudmFyIElORklOSVRZID0gMSAvIDAsXG4gICAgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTEsXG4gICAgTUFYX0lOVEVHRVIgPSAxLjc5NzY5MzEzNDg2MjMxNTdlKzMwOCxcbiAgICBOQU4gPSAwIC8gMDtcblxuLyoqIFVzZWQgYXMgdGhlIGludGVybmFsIGFyZ3VtZW50IHBsYWNlaG9sZGVyLiAqL1xudmFyIFBMQUNFSE9MREVSID0gJ19fbG9kYXNoX3BsYWNlaG9sZGVyX18nO1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgZnVuY1RhZyA9ICdbb2JqZWN0IEZ1bmN0aW9uXScsXG4gICAgZ2VuVGFnID0gJ1tvYmplY3QgR2VuZXJhdG9yRnVuY3Rpb25dJztcblxuLyoqIFVzZWQgdG8gbWF0Y2ggbGVhZGluZyBhbmQgdHJhaWxpbmcgd2hpdGVzcGFjZS4gKi9cbnZhciByZVRyaW0gPSAvXlxccyt8XFxzKyQvZztcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGJhZCBzaWduZWQgaGV4YWRlY2ltYWwgc3RyaW5nIHZhbHVlcy4gKi9cbnZhciByZUlzQmFkSGV4ID0gL15bLStdMHhbMC05YS1mXSskL2k7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBiaW5hcnkgc3RyaW5nIHZhbHVlcy4gKi9cbnZhciByZUlzQmluYXJ5ID0gL14wYlswMV0rJC9pO1xuXG4vKiogVXNlZCB0byBkZXRlY3Qgb2N0YWwgc3RyaW5nIHZhbHVlcy4gKi9cbnZhciByZUlzT2N0YWwgPSAvXjBvWzAtN10rJC9pO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgdW5zaWduZWQgaW50ZWdlciB2YWx1ZXMuICovXG52YXIgcmVJc1VpbnQgPSAvXig/OjB8WzEtOV1cXGQqKSQvO1xuXG4vKiogQnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMgd2l0aG91dCBhIGRlcGVuZGVuY3kgb24gYHJvb3RgLiAqL1xudmFyIGZyZWVQYXJzZUludCA9IHBhcnNlSW50O1xuXG4vKipcbiAqIEEgZmFzdGVyIGFsdGVybmF0aXZlIHRvIGBGdW5jdGlvbiNhcHBseWAsIHRoaXMgZnVuY3Rpb24gaW52b2tlcyBgZnVuY2BcbiAqIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIGB0aGlzQXJnYCBhbmQgdGhlIGFyZ3VtZW50cyBvZiBgYXJnc2AuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGludm9rZS5cbiAqIEBwYXJhbSB7Kn0gdGhpc0FyZyBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICogQHBhcmFtIHsuLi4qfSBhcmdzIFRoZSBhcmd1bWVudHMgdG8gaW52b2tlIGBmdW5jYCB3aXRoLlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIHJlc3VsdCBvZiBgZnVuY2AuXG4gKi9cbmZ1bmN0aW9uIGFwcGx5KGZ1bmMsIHRoaXNBcmcsIGFyZ3MpIHtcbiAgdmFyIGxlbmd0aCA9IGFyZ3MubGVuZ3RoO1xuICBzd2l0Y2ggKGxlbmd0aCkge1xuICAgIGNhc2UgMDogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnKTtcbiAgICBjYXNlIDE6IHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgYXJnc1swXSk7XG4gICAgY2FzZSAyOiByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIGFyZ3NbMF0sIGFyZ3NbMV0pO1xuICAgIGNhc2UgMzogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCBhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdKTtcbiAgfVxuICByZXR1cm4gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgaW5kZXguXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHBhcmFtIHtudW1iZXJ9IFtsZW5ndGg9TUFYX1NBRkVfSU5URUdFUl0gVGhlIHVwcGVyIGJvdW5kcyBvZiBhIHZhbGlkIGluZGV4LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBpbmRleCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0luZGV4KHZhbHVlLCBsZW5ndGgpIHtcbiAgdmFsdWUgPSAodHlwZW9mIHZhbHVlID09ICdudW1iZXInIHx8IHJlSXNVaW50LnRlc3QodmFsdWUpKSA/ICt2YWx1ZSA6IC0xO1xuICBsZW5ndGggPSBsZW5ndGggPT0gbnVsbCA/IE1BWF9TQUZFX0lOVEVHRVIgOiBsZW5ndGg7XG4gIHJldHVybiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDwgbGVuZ3RoO1xufVxuXG4vKipcbiAqIFJlcGxhY2VzIGFsbCBgcGxhY2Vob2xkZXJgIGVsZW1lbnRzIGluIGBhcnJheWAgd2l0aCBhbiBpbnRlcm5hbCBwbGFjZWhvbGRlclxuICogYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgdGhlaXIgaW5kZXhlcy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIG1vZGlmeS5cbiAqIEBwYXJhbSB7Kn0gcGxhY2Vob2xkZXIgVGhlIHBsYWNlaG9sZGVyIHRvIHJlcGxhY2UuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIG5ldyBhcnJheSBvZiBwbGFjZWhvbGRlciBpbmRleGVzLlxuICovXG5mdW5jdGlvbiByZXBsYWNlSG9sZGVycyhhcnJheSwgcGxhY2Vob2xkZXIpIHtcbiAgdmFyIGluZGV4ID0gLTEsXG4gICAgICBsZW5ndGggPSBhcnJheS5sZW5ndGgsXG4gICAgICByZXNJbmRleCA9IC0xLFxuICAgICAgcmVzdWx0ID0gW107XG5cbiAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICBpZiAoYXJyYXlbaW5kZXhdID09PSBwbGFjZWhvbGRlcikge1xuICAgICAgYXJyYXlbaW5kZXhdID0gUExBQ0VIT0xERVI7XG4gICAgICByZXN1bHRbKytyZXNJbmRleF0gPSBpbmRleDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyogQnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMgZm9yIHRob3NlIHdpdGggdGhlIHNhbWUgbmFtZSBhcyBvdGhlciBgbG9kYXNoYCBtZXRob2RzLiAqL1xudmFyIG5hdGl2ZU1heCA9IE1hdGgubWF4LFxuICAgIG5hdGl2ZU1pbiA9IE1hdGgubWluO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmNyZWF0ZWAgd2l0aG91dCBzdXBwb3J0IGZvciBhc3NpZ25pbmdcbiAqIHByb3BlcnRpZXMgdG8gdGhlIGNyZWF0ZWQgb2JqZWN0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gcHJvdG90eXBlIFRoZSBvYmplY3QgdG8gaW5oZXJpdCBmcm9tLlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgbmV3IG9iamVjdC5cbiAqL1xudmFyIGJhc2VDcmVhdGUgPSAoZnVuY3Rpb24oKSB7XG4gIGZ1bmN0aW9uIG9iamVjdCgpIHt9XG4gIHJldHVybiBmdW5jdGlvbihwcm90b3R5cGUpIHtcbiAgICBpZiAoaXNPYmplY3QocHJvdG90eXBlKSkge1xuICAgICAgb2JqZWN0LnByb3RvdHlwZSA9IHByb3RvdHlwZTtcbiAgICAgIHZhciByZXN1bHQgPSBuZXcgb2JqZWN0O1xuICAgICAgb2JqZWN0LnByb3RvdHlwZSA9IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdCB8fCB7fTtcbiAgfTtcbn0oKSk7XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSB0aGF0IGlzIHRoZSBjb21wb3NpdGlvbiBvZiBwYXJ0aWFsbHkgYXBwbGllZCBhcmd1bWVudHMsXG4gKiBwbGFjZWhvbGRlcnMsIGFuZCBwcm92aWRlZCBhcmd1bWVudHMgaW50byBhIHNpbmdsZSBhcnJheSBvZiBhcmd1bWVudHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBhcmdzIFRoZSBwcm92aWRlZCBhcmd1bWVudHMuXG4gKiBAcGFyYW0ge0FycmF5fSBwYXJ0aWFscyBUaGUgYXJndW1lbnRzIHRvIHByZXBlbmQgdG8gdGhvc2UgcHJvdmlkZWQuXG4gKiBAcGFyYW0ge0FycmF5fSBob2xkZXJzIFRoZSBgcGFydGlhbHNgIHBsYWNlaG9sZGVyIGluZGV4ZXMuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIG5ldyBhcnJheSBvZiBjb21wb3NlZCBhcmd1bWVudHMuXG4gKi9cbmZ1bmN0aW9uIGNvbXBvc2VBcmdzKGFyZ3MsIHBhcnRpYWxzLCBob2xkZXJzKSB7XG4gIHZhciBob2xkZXJzTGVuZ3RoID0gaG9sZGVycy5sZW5ndGgsXG4gICAgICBhcmdzSW5kZXggPSAtMSxcbiAgICAgIGFyZ3NMZW5ndGggPSBuYXRpdmVNYXgoYXJncy5sZW5ndGggLSBob2xkZXJzTGVuZ3RoLCAwKSxcbiAgICAgIGxlZnRJbmRleCA9IC0xLFxuICAgICAgbGVmdExlbmd0aCA9IHBhcnRpYWxzLmxlbmd0aCxcbiAgICAgIHJlc3VsdCA9IEFycmF5KGxlZnRMZW5ndGggKyBhcmdzTGVuZ3RoKTtcblxuICB3aGlsZSAoKytsZWZ0SW5kZXggPCBsZWZ0TGVuZ3RoKSB7XG4gICAgcmVzdWx0W2xlZnRJbmRleF0gPSBwYXJ0aWFsc1tsZWZ0SW5kZXhdO1xuICB9XG4gIHdoaWxlICgrK2FyZ3NJbmRleCA8IGhvbGRlcnNMZW5ndGgpIHtcbiAgICByZXN1bHRbaG9sZGVyc1thcmdzSW5kZXhdXSA9IGFyZ3NbYXJnc0luZGV4XTtcbiAgfVxuICB3aGlsZSAoYXJnc0xlbmd0aC0tKSB7XG4gICAgcmVzdWx0W2xlZnRJbmRleCsrXSA9IGFyZ3NbYXJnc0luZGV4KytdO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBpcyBsaWtlIGBjb21wb3NlQXJnc2AgZXhjZXB0IHRoYXQgdGhlIGFyZ3VtZW50cyBjb21wb3NpdGlvblxuICogaXMgdGFpbG9yZWQgZm9yIGBfLnBhcnRpYWxSaWdodGAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBhcmdzIFRoZSBwcm92aWRlZCBhcmd1bWVudHMuXG4gKiBAcGFyYW0ge0FycmF5fSBwYXJ0aWFscyBUaGUgYXJndW1lbnRzIHRvIGFwcGVuZCB0byB0aG9zZSBwcm92aWRlZC5cbiAqIEBwYXJhbSB7QXJyYXl9IGhvbGRlcnMgVGhlIGBwYXJ0aWFsc2AgcGxhY2Vob2xkZXIgaW5kZXhlcy5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgbmV3IGFycmF5IG9mIGNvbXBvc2VkIGFyZ3VtZW50cy5cbiAqL1xuZnVuY3Rpb24gY29tcG9zZUFyZ3NSaWdodChhcmdzLCBwYXJ0aWFscywgaG9sZGVycykge1xuICB2YXIgaG9sZGVyc0luZGV4ID0gLTEsXG4gICAgICBob2xkZXJzTGVuZ3RoID0gaG9sZGVycy5sZW5ndGgsXG4gICAgICBhcmdzSW5kZXggPSAtMSxcbiAgICAgIGFyZ3NMZW5ndGggPSBuYXRpdmVNYXgoYXJncy5sZW5ndGggLSBob2xkZXJzTGVuZ3RoLCAwKSxcbiAgICAgIHJpZ2h0SW5kZXggPSAtMSxcbiAgICAgIHJpZ2h0TGVuZ3RoID0gcGFydGlhbHMubGVuZ3RoLFxuICAgICAgcmVzdWx0ID0gQXJyYXkoYXJnc0xlbmd0aCArIHJpZ2h0TGVuZ3RoKTtcblxuICB3aGlsZSAoKythcmdzSW5kZXggPCBhcmdzTGVuZ3RoKSB7XG4gICAgcmVzdWx0W2FyZ3NJbmRleF0gPSBhcmdzW2FyZ3NJbmRleF07XG4gIH1cbiAgdmFyIG9mZnNldCA9IGFyZ3NJbmRleDtcbiAgd2hpbGUgKCsrcmlnaHRJbmRleCA8IHJpZ2h0TGVuZ3RoKSB7XG4gICAgcmVzdWx0W29mZnNldCArIHJpZ2h0SW5kZXhdID0gcGFydGlhbHNbcmlnaHRJbmRleF07XG4gIH1cbiAgd2hpbGUgKCsraG9sZGVyc0luZGV4IDwgaG9sZGVyc0xlbmd0aCkge1xuICAgIHJlc3VsdFtvZmZzZXQgKyBob2xkZXJzW2hvbGRlcnNJbmRleF1dID0gYXJnc1thcmdzSW5kZXgrK107XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBDb3BpZXMgdGhlIHZhbHVlcyBvZiBgc291cmNlYCB0byBgYXJyYXlgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0FycmF5fSBzb3VyY2UgVGhlIGFycmF5IHRvIGNvcHkgdmFsdWVzIGZyb20uXG4gKiBAcGFyYW0ge0FycmF5fSBbYXJyYXk9W11dIFRoZSBhcnJheSB0byBjb3B5IHZhbHVlcyB0by5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBgYXJyYXlgLlxuICovXG5mdW5jdGlvbiBjb3B5QXJyYXkoc291cmNlLCBhcnJheSkge1xuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIGxlbmd0aCA9IHNvdXJjZS5sZW5ndGg7XG5cbiAgYXJyYXkgfHwgKGFycmF5ID0gQXJyYXkobGVuZ3RoKSk7XG4gIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgYXJyYXlbaW5kZXhdID0gc291cmNlW2luZGV4XTtcbiAgfVxuICByZXR1cm4gYXJyYXk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgd3JhcHMgYGZ1bmNgIHRvIGludm9rZSBpdCB3aXRoIHRoZSBvcHRpb25hbCBgdGhpc2BcbiAqIGJpbmRpbmcgb2YgYHRoaXNBcmdgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byB3cmFwLlxuICogQHBhcmFtIHtudW1iZXJ9IGJpdG1hc2sgVGhlIGJpdG1hc2sgb2Ygd3JhcHBlciBmbGFncy4gU2VlIGBjcmVhdGVXcmFwcGVyYCBmb3IgbW9yZSBkZXRhaWxzLlxuICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHdyYXBwZWQgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUJhc2VXcmFwcGVyKGZ1bmMsIGJpdG1hc2ssIHRoaXNBcmcpIHtcbiAgdmFyIGlzQmluZCA9IGJpdG1hc2sgJiBCSU5EX0ZMQUcsXG4gICAgICBDdG9yID0gY3JlYXRlQ3RvcldyYXBwZXIoZnVuYyk7XG5cbiAgZnVuY3Rpb24gd3JhcHBlcigpIHtcbiAgICB2YXIgZm4gPSAodGhpcyAmJiB0aGlzICE9PSByb290ICYmIHRoaXMgaW5zdGFuY2VvZiB3cmFwcGVyKSA/IEN0b3IgOiBmdW5jO1xuICAgIHJldHVybiBmbi5hcHBseShpc0JpbmQgPyB0aGlzQXJnIDogdGhpcywgYXJndW1lbnRzKTtcbiAgfVxuICByZXR1cm4gd3JhcHBlcjtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBwcm9kdWNlcyBhbiBpbnN0YW5jZSBvZiBgQ3RvcmAgcmVnYXJkbGVzcyBvZlxuICogd2hldGhlciBpdCB3YXMgaW52b2tlZCBhcyBwYXJ0IG9mIGEgYG5ld2AgZXhwcmVzc2lvbiBvciBieSBgY2FsbGAgb3IgYGFwcGx5YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gQ3RvciBUaGUgY29uc3RydWN0b3IgdG8gd3JhcC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHdyYXBwZWQgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUN0b3JXcmFwcGVyKEN0b3IpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIC8vIFVzZSBhIGBzd2l0Y2hgIHN0YXRlbWVudCB0byB3b3JrIHdpdGggY2xhc3MgY29uc3RydWN0b3JzLlxuICAgIC8vIFNlZSBodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1lY21hc2NyaXB0LWZ1bmN0aW9uLW9iamVjdHMtY2FsbC10aGlzYXJndW1lbnQtYXJndW1lbnRzbGlzdFxuICAgIC8vIGZvciBtb3JlIGRldGFpbHMuXG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgY2FzZSAwOiByZXR1cm4gbmV3IEN0b3I7XG4gICAgICBjYXNlIDE6IHJldHVybiBuZXcgQ3RvcihhcmdzWzBdKTtcbiAgICAgIGNhc2UgMjogcmV0dXJuIG5ldyBDdG9yKGFyZ3NbMF0sIGFyZ3NbMV0pO1xuICAgICAgY2FzZSAzOiByZXR1cm4gbmV3IEN0b3IoYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSk7XG4gICAgICBjYXNlIDQ6IHJldHVybiBuZXcgQ3RvcihhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdLCBhcmdzWzNdKTtcbiAgICAgIGNhc2UgNTogcmV0dXJuIG5ldyBDdG9yKGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0sIGFyZ3NbM10sIGFyZ3NbNF0pO1xuICAgICAgY2FzZSA2OiByZXR1cm4gbmV3IEN0b3IoYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSwgYXJnc1szXSwgYXJnc1s0XSwgYXJnc1s1XSk7XG4gICAgICBjYXNlIDc6IHJldHVybiBuZXcgQ3RvcihhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdLCBhcmdzWzNdLCBhcmdzWzRdLCBhcmdzWzVdLCBhcmdzWzZdKTtcbiAgICB9XG4gICAgdmFyIHRoaXNCaW5kaW5nID0gYmFzZUNyZWF0ZShDdG9yLnByb3RvdHlwZSksXG4gICAgICAgIHJlc3VsdCA9IEN0b3IuYXBwbHkodGhpc0JpbmRpbmcsIGFyZ3MpO1xuXG4gICAgLy8gTWltaWMgdGhlIGNvbnN0cnVjdG9yJ3MgYHJldHVybmAgYmVoYXZpb3IuXG4gICAgLy8gU2VlIGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDEzLjIuMiBmb3IgbW9yZSBkZXRhaWxzLlxuICAgIHJldHVybiBpc09iamVjdChyZXN1bHQpID8gcmVzdWx0IDogdGhpc0JpbmRpbmc7XG4gIH07XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgd3JhcHMgYGZ1bmNgIHRvIGVuYWJsZSBjdXJyeWluZy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gd3JhcC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBiaXRtYXNrIFRoZSBiaXRtYXNrIG9mIHdyYXBwZXIgZmxhZ3MuIFNlZSBgY3JlYXRlV3JhcHBlcmAgZm9yIG1vcmUgZGV0YWlscy5cbiAqIEBwYXJhbSB7bnVtYmVyfSBhcml0eSBUaGUgYXJpdHkgb2YgYGZ1bmNgLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgd3JhcHBlZCBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ3VycnlXcmFwcGVyKGZ1bmMsIGJpdG1hc2ssIGFyaXR5KSB7XG4gIHZhciBDdG9yID0gY3JlYXRlQ3RvcldyYXBwZXIoZnVuYyk7XG5cbiAgZnVuY3Rpb24gd3JhcHBlcigpIHtcbiAgICB2YXIgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCxcbiAgICAgICAgaW5kZXggPSBsZW5ndGgsXG4gICAgICAgIGFyZ3MgPSBBcnJheShsZW5ndGgpLFxuICAgICAgICBmbiA9ICh0aGlzICYmIHRoaXMgIT09IHJvb3QgJiYgdGhpcyBpbnN0YW5jZW9mIHdyYXBwZXIpID8gQ3RvciA6IGZ1bmMsXG4gICAgICAgIHBsYWNlaG9sZGVyID0gd3JhcHBlci5wbGFjZWhvbGRlcjtcblxuICAgIHdoaWxlIChpbmRleC0tKSB7XG4gICAgICBhcmdzW2luZGV4XSA9IGFyZ3VtZW50c1tpbmRleF07XG4gICAgfVxuICAgIHZhciBob2xkZXJzID0gKGxlbmd0aCA8IDMgJiYgYXJnc1swXSAhPT0gcGxhY2Vob2xkZXIgJiYgYXJnc1tsZW5ndGggLSAxXSAhPT0gcGxhY2Vob2xkZXIpXG4gICAgICA/IFtdXG4gICAgICA6IHJlcGxhY2VIb2xkZXJzKGFyZ3MsIHBsYWNlaG9sZGVyKTtcblxuICAgIGxlbmd0aCAtPSBob2xkZXJzLmxlbmd0aDtcbiAgICByZXR1cm4gbGVuZ3RoIDwgYXJpdHlcbiAgICAgID8gY3JlYXRlUmVjdXJyeVdyYXBwZXIoZnVuYywgYml0bWFzaywgY3JlYXRlSHlicmlkV3JhcHBlciwgcGxhY2Vob2xkZXIsIHVuZGVmaW5lZCwgYXJncywgaG9sZGVycywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGFyaXR5IC0gbGVuZ3RoKVxuICAgICAgOiBhcHBseShmbiwgdGhpcywgYXJncyk7XG4gIH1cbiAgcmV0dXJuIHdyYXBwZXI7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgd3JhcHMgYGZ1bmNgIHRvIGludm9rZSBpdCB3aXRoIG9wdGlvbmFsIGB0aGlzYFxuICogYmluZGluZyBvZiBgdGhpc0FyZ2AsIHBhcnRpYWwgYXBwbGljYXRpb24sIGFuZCBjdXJyeWluZy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbnxzdHJpbmd9IGZ1bmMgVGhlIGZ1bmN0aW9uIG9yIG1ldGhvZCBuYW1lIHRvIHdyYXAuXG4gKiBAcGFyYW0ge251bWJlcn0gYml0bWFzayBUaGUgYml0bWFzayBvZiB3cmFwcGVyIGZsYWdzLiBTZWUgYGNyZWF0ZVdyYXBwZXJgIGZvciBtb3JlIGRldGFpbHMuXG4gKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICogQHBhcmFtIHtBcnJheX0gW3BhcnRpYWxzXSBUaGUgYXJndW1lbnRzIHRvIHByZXBlbmQgdG8gdGhvc2UgcHJvdmlkZWQgdG8gdGhlIG5ldyBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7QXJyYXl9IFtob2xkZXJzXSBUaGUgYHBhcnRpYWxzYCBwbGFjZWhvbGRlciBpbmRleGVzLlxuICogQHBhcmFtIHtBcnJheX0gW3BhcnRpYWxzUmlnaHRdIFRoZSBhcmd1bWVudHMgdG8gYXBwZW5kIHRvIHRob3NlIHByb3ZpZGVkIHRvIHRoZSBuZXcgZnVuY3Rpb24uXG4gKiBAcGFyYW0ge0FycmF5fSBbaG9sZGVyc1JpZ2h0XSBUaGUgYHBhcnRpYWxzUmlnaHRgIHBsYWNlaG9sZGVyIGluZGV4ZXMuXG4gKiBAcGFyYW0ge0FycmF5fSBbYXJnUG9zXSBUaGUgYXJndW1lbnQgcG9zaXRpb25zIG9mIHRoZSBuZXcgZnVuY3Rpb24uXG4gKiBAcGFyYW0ge251bWJlcn0gW2FyeV0gVGhlIGFyaXR5IGNhcCBvZiBgZnVuY2AuXG4gKiBAcGFyYW0ge251bWJlcn0gW2FyaXR5XSBUaGUgYXJpdHkgb2YgYGZ1bmNgLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgd3JhcHBlZCBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlSHlicmlkV3JhcHBlcihmdW5jLCBiaXRtYXNrLCB0aGlzQXJnLCBwYXJ0aWFscywgaG9sZGVycywgcGFydGlhbHNSaWdodCwgaG9sZGVyc1JpZ2h0LCBhcmdQb3MsIGFyeSwgYXJpdHkpIHtcbiAgdmFyIGlzQXJ5ID0gYml0bWFzayAmIEFSWV9GTEFHLFxuICAgICAgaXNCaW5kID0gYml0bWFzayAmIEJJTkRfRkxBRyxcbiAgICAgIGlzQmluZEtleSA9IGJpdG1hc2sgJiBCSU5EX0tFWV9GTEFHLFxuICAgICAgaXNDdXJyeSA9IGJpdG1hc2sgJiBDVVJSWV9GTEFHLFxuICAgICAgaXNDdXJyeVJpZ2h0ID0gYml0bWFzayAmIENVUlJZX1JJR0hUX0ZMQUcsXG4gICAgICBpc0ZsaXAgPSBiaXRtYXNrICYgRkxJUF9GTEFHLFxuICAgICAgQ3RvciA9IGlzQmluZEtleSA/IHVuZGVmaW5lZCA6IGNyZWF0ZUN0b3JXcmFwcGVyKGZ1bmMpO1xuXG4gIGZ1bmN0aW9uIHdyYXBwZXIoKSB7XG4gICAgdmFyIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG4gICAgICAgIGluZGV4ID0gbGVuZ3RoLFxuICAgICAgICBhcmdzID0gQXJyYXkobGVuZ3RoKTtcblxuICAgIHdoaWxlIChpbmRleC0tKSB7XG4gICAgICBhcmdzW2luZGV4XSA9IGFyZ3VtZW50c1tpbmRleF07XG4gICAgfVxuICAgIGlmIChwYXJ0aWFscykge1xuICAgICAgYXJncyA9IGNvbXBvc2VBcmdzKGFyZ3MsIHBhcnRpYWxzLCBob2xkZXJzKTtcbiAgICB9XG4gICAgaWYgKHBhcnRpYWxzUmlnaHQpIHtcbiAgICAgIGFyZ3MgPSBjb21wb3NlQXJnc1JpZ2h0KGFyZ3MsIHBhcnRpYWxzUmlnaHQsIGhvbGRlcnNSaWdodCk7XG4gICAgfVxuICAgIGlmIChpc0N1cnJ5IHx8IGlzQ3VycnlSaWdodCkge1xuICAgICAgdmFyIHBsYWNlaG9sZGVyID0gd3JhcHBlci5wbGFjZWhvbGRlcixcbiAgICAgICAgICBhcmdzSG9sZGVycyA9IHJlcGxhY2VIb2xkZXJzKGFyZ3MsIHBsYWNlaG9sZGVyKTtcblxuICAgICAgbGVuZ3RoIC09IGFyZ3NIb2xkZXJzLmxlbmd0aDtcbiAgICAgIGlmIChsZW5ndGggPCBhcml0eSkge1xuICAgICAgICByZXR1cm4gY3JlYXRlUmVjdXJyeVdyYXBwZXIoZnVuYywgYml0bWFzaywgY3JlYXRlSHlicmlkV3JhcHBlciwgcGxhY2Vob2xkZXIsIHRoaXNBcmcsIGFyZ3MsIGFyZ3NIb2xkZXJzLCBhcmdQb3MsIGFyeSwgYXJpdHkgLSBsZW5ndGgpO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgdGhpc0JpbmRpbmcgPSBpc0JpbmQgPyB0aGlzQXJnIDogdGhpcyxcbiAgICAgICAgZm4gPSBpc0JpbmRLZXkgPyB0aGlzQmluZGluZ1tmdW5jXSA6IGZ1bmM7XG5cbiAgICBpZiAoYXJnUG9zKSB7XG4gICAgICBhcmdzID0gcmVvcmRlcihhcmdzLCBhcmdQb3MpO1xuICAgIH0gZWxzZSBpZiAoaXNGbGlwICYmIGFyZ3MubGVuZ3RoID4gMSkge1xuICAgICAgYXJncy5yZXZlcnNlKCk7XG4gICAgfVxuICAgIGlmIChpc0FyeSAmJiBhcnkgPCBhcmdzLmxlbmd0aCkge1xuICAgICAgYXJncy5sZW5ndGggPSBhcnk7XG4gICAgfVxuICAgIGlmICh0aGlzICYmIHRoaXMgIT09IHJvb3QgJiYgdGhpcyBpbnN0YW5jZW9mIHdyYXBwZXIpIHtcbiAgICAgIGZuID0gQ3RvciB8fCBjcmVhdGVDdG9yV3JhcHBlcihmbik7XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzQmluZGluZywgYXJncyk7XG4gIH1cbiAgcmV0dXJuIHdyYXBwZXI7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgd3JhcHMgYGZ1bmNgIHRvIGludm9rZSBpdCB3aXRoIHRoZSBvcHRpb25hbCBgdGhpc2BcbiAqIGJpbmRpbmcgb2YgYHRoaXNBcmdgIGFuZCB0aGUgYHBhcnRpYWxzYCBwcmVwZW5kZWQgdG8gdGhvc2UgcHJvdmlkZWQgdG9cbiAqIHRoZSB3cmFwcGVyLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byB3cmFwLlxuICogQHBhcmFtIHtudW1iZXJ9IGJpdG1hc2sgVGhlIGJpdG1hc2sgb2Ygd3JhcHBlciBmbGFncy4gU2VlIGBjcmVhdGVXcmFwcGVyYCBmb3IgbW9yZSBkZXRhaWxzLlxuICogQHBhcmFtIHsqfSB0aGlzQXJnIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXG4gKiBAcGFyYW0ge0FycmF5fSBwYXJ0aWFscyBUaGUgYXJndW1lbnRzIHRvIHByZXBlbmQgdG8gdGhvc2UgcHJvdmlkZWQgdG8gdGhlIG5ldyBmdW5jdGlvbi5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHdyYXBwZWQgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVBhcnRpYWxXcmFwcGVyKGZ1bmMsIGJpdG1hc2ssIHRoaXNBcmcsIHBhcnRpYWxzKSB7XG4gIHZhciBpc0JpbmQgPSBiaXRtYXNrICYgQklORF9GTEFHLFxuICAgICAgQ3RvciA9IGNyZWF0ZUN0b3JXcmFwcGVyKGZ1bmMpO1xuXG4gIGZ1bmN0aW9uIHdyYXBwZXIoKSB7XG4gICAgdmFyIGFyZ3NJbmRleCA9IC0xLFxuICAgICAgICBhcmdzTGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCxcbiAgICAgICAgbGVmdEluZGV4ID0gLTEsXG4gICAgICAgIGxlZnRMZW5ndGggPSBwYXJ0aWFscy5sZW5ndGgsXG4gICAgICAgIGFyZ3MgPSBBcnJheShsZWZ0TGVuZ3RoICsgYXJnc0xlbmd0aCksXG4gICAgICAgIGZuID0gKHRoaXMgJiYgdGhpcyAhPT0gcm9vdCAmJiB0aGlzIGluc3RhbmNlb2Ygd3JhcHBlcikgPyBDdG9yIDogZnVuYztcblxuICAgIHdoaWxlICgrK2xlZnRJbmRleCA8IGxlZnRMZW5ndGgpIHtcbiAgICAgIGFyZ3NbbGVmdEluZGV4XSA9IHBhcnRpYWxzW2xlZnRJbmRleF07XG4gICAgfVxuICAgIHdoaWxlIChhcmdzTGVuZ3RoLS0pIHtcbiAgICAgIGFyZ3NbbGVmdEluZGV4KytdID0gYXJndW1lbnRzWysrYXJnc0luZGV4XTtcbiAgICB9XG4gICAgcmV0dXJuIGFwcGx5KGZuLCBpc0JpbmQgPyB0aGlzQXJnIDogdGhpcywgYXJncyk7XG4gIH1cbiAgcmV0dXJuIHdyYXBwZXI7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgd3JhcHMgYGZ1bmNgIHRvIGNvbnRpbnVlIGN1cnJ5aW5nLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byB3cmFwLlxuICogQHBhcmFtIHtudW1iZXJ9IGJpdG1hc2sgVGhlIGJpdG1hc2sgb2Ygd3JhcHBlciBmbGFncy4gU2VlIGBjcmVhdGVXcmFwcGVyYCBmb3IgbW9yZSBkZXRhaWxzLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gd3JhcEZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYGZ1bmNgIHdyYXBwZXIuXG4gKiBAcGFyYW0geyp9IHBsYWNlaG9sZGVyIFRoZSBwbGFjZWhvbGRlciB0byByZXBsYWNlLlxuICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7QXJyYXl9IFtwYXJ0aWFsc10gVGhlIGFyZ3VtZW50cyB0byBwcmVwZW5kIHRvIHRob3NlIHByb3ZpZGVkIHRvIHRoZSBuZXcgZnVuY3Rpb24uXG4gKiBAcGFyYW0ge0FycmF5fSBbaG9sZGVyc10gVGhlIGBwYXJ0aWFsc2AgcGxhY2Vob2xkZXIgaW5kZXhlcy5cbiAqIEBwYXJhbSB7QXJyYXl9IFthcmdQb3NdIFRoZSBhcmd1bWVudCBwb3NpdGlvbnMgb2YgdGhlIG5ldyBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbYXJ5XSBUaGUgYXJpdHkgY2FwIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbYXJpdHldIFRoZSBhcml0eSBvZiBgZnVuY2AuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyB3cmFwcGVkIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVSZWN1cnJ5V3JhcHBlcihmdW5jLCBiaXRtYXNrLCB3cmFwRnVuYywgcGxhY2Vob2xkZXIsIHRoaXNBcmcsIHBhcnRpYWxzLCBob2xkZXJzLCBhcmdQb3MsIGFyeSwgYXJpdHkpIHtcbiAgdmFyIGlzQ3VycnkgPSBiaXRtYXNrICYgQ1VSUllfRkxBRyxcbiAgICAgIG5ld0FyZ1BvcyA9IGFyZ1BvcyA/IGNvcHlBcnJheShhcmdQb3MpIDogdW5kZWZpbmVkLFxuICAgICAgbmV3c0hvbGRlcnMgPSBpc0N1cnJ5ID8gaG9sZGVycyA6IHVuZGVmaW5lZCxcbiAgICAgIG5ld0hvbGRlcnNSaWdodCA9IGlzQ3VycnkgPyB1bmRlZmluZWQgOiBob2xkZXJzLFxuICAgICAgbmV3UGFydGlhbHMgPSBpc0N1cnJ5ID8gcGFydGlhbHMgOiB1bmRlZmluZWQsXG4gICAgICBuZXdQYXJ0aWFsc1JpZ2h0ID0gaXNDdXJyeSA/IHVuZGVmaW5lZCA6IHBhcnRpYWxzO1xuXG4gIGJpdG1hc2sgfD0gKGlzQ3VycnkgPyBQQVJUSUFMX0ZMQUcgOiBQQVJUSUFMX1JJR0hUX0ZMQUcpO1xuICBiaXRtYXNrICY9IH4oaXNDdXJyeSA/IFBBUlRJQUxfUklHSFRfRkxBRyA6IFBBUlRJQUxfRkxBRyk7XG5cbiAgaWYgKCEoYml0bWFzayAmIENVUlJZX0JPVU5EX0ZMQUcpKSB7XG4gICAgYml0bWFzayAmPSB+KEJJTkRfRkxBRyB8IEJJTkRfS0VZX0ZMQUcpO1xuICB9XG4gIHZhciByZXN1bHQgPSB3cmFwRnVuYyhmdW5jLCBiaXRtYXNrLCB0aGlzQXJnLCBuZXdQYXJ0aWFscywgbmV3c0hvbGRlcnMsIG5ld1BhcnRpYWxzUmlnaHQsIG5ld0hvbGRlcnNSaWdodCwgbmV3QXJnUG9zLCBhcnksIGFyaXR5KTtcblxuICByZXN1bHQucGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBlaXRoZXIgY3VycmllcyBvciBpbnZva2VzIGBmdW5jYCB3aXRoIG9wdGlvbmFsXG4gKiBgdGhpc2AgYmluZGluZyBhbmQgcGFydGlhbGx5IGFwcGxpZWQgYXJndW1lbnRzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufHN0cmluZ30gZnVuYyBUaGUgZnVuY3Rpb24gb3IgbWV0aG9kIG5hbWUgdG8gd3JhcC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBiaXRtYXNrIFRoZSBiaXRtYXNrIG9mIHdyYXBwZXIgZmxhZ3MuXG4gKiAgVGhlIGJpdG1hc2sgbWF5IGJlIGNvbXBvc2VkIG9mIHRoZSBmb2xsb3dpbmcgZmxhZ3M6XG4gKiAgICAgMSAtIGBfLmJpbmRgXG4gKiAgICAgMiAtIGBfLmJpbmRLZXlgXG4gKiAgICAgNCAtIGBfLmN1cnJ5YCBvciBgXy5jdXJyeVJpZ2h0YCBvZiBhIGJvdW5kIGZ1bmN0aW9uXG4gKiAgICAgOCAtIGBfLmN1cnJ5YFxuICogICAgMTYgLSBgXy5jdXJyeVJpZ2h0YFxuICogICAgMzIgLSBgXy5wYXJ0aWFsYFxuICogICAgNjQgLSBgXy5wYXJ0aWFsUmlnaHRgXG4gKiAgIDEyOCAtIGBfLnJlYXJnYFxuICogICAyNTYgLSBgXy5hcnlgXG4gKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICogQHBhcmFtIHtBcnJheX0gW3BhcnRpYWxzXSBUaGUgYXJndW1lbnRzIHRvIGJlIHBhcnRpYWxseSBhcHBsaWVkLlxuICogQHBhcmFtIHtBcnJheX0gW2hvbGRlcnNdIFRoZSBgcGFydGlhbHNgIHBsYWNlaG9sZGVyIGluZGV4ZXMuXG4gKiBAcGFyYW0ge0FycmF5fSBbYXJnUG9zXSBUaGUgYXJndW1lbnQgcG9zaXRpb25zIG9mIHRoZSBuZXcgZnVuY3Rpb24uXG4gKiBAcGFyYW0ge251bWJlcn0gW2FyeV0gVGhlIGFyaXR5IGNhcCBvZiBgZnVuY2AuXG4gKiBAcGFyYW0ge251bWJlcn0gW2FyaXR5XSBUaGUgYXJpdHkgb2YgYGZ1bmNgLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgd3JhcHBlZCBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlV3JhcHBlcihmdW5jLCBiaXRtYXNrLCB0aGlzQXJnLCBwYXJ0aWFscywgaG9sZGVycywgYXJnUG9zLCBhcnksIGFyaXR5KSB7XG4gIHZhciBpc0JpbmRLZXkgPSBiaXRtYXNrICYgQklORF9LRVlfRkxBRztcbiAgaWYgKCFpc0JpbmRLZXkgJiYgdHlwZW9mIGZ1bmMgIT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoRlVOQ19FUlJPUl9URVhUKTtcbiAgfVxuICB2YXIgbGVuZ3RoID0gcGFydGlhbHMgPyBwYXJ0aWFscy5sZW5ndGggOiAwO1xuICBpZiAoIWxlbmd0aCkge1xuICAgIGJpdG1hc2sgJj0gfihQQVJUSUFMX0ZMQUcgfCBQQVJUSUFMX1JJR0hUX0ZMQUcpO1xuICAgIHBhcnRpYWxzID0gaG9sZGVycyA9IHVuZGVmaW5lZDtcbiAgfVxuICBhcnkgPSBhcnkgPT09IHVuZGVmaW5lZCA/IGFyeSA6IG5hdGl2ZU1heCh0b0ludGVnZXIoYXJ5KSwgMCk7XG4gIGFyaXR5ID0gYXJpdHkgPT09IHVuZGVmaW5lZCA/IGFyaXR5IDogdG9JbnRlZ2VyKGFyaXR5KTtcbiAgbGVuZ3RoIC09IGhvbGRlcnMgPyBob2xkZXJzLmxlbmd0aCA6IDA7XG5cbiAgaWYgKGJpdG1hc2sgJiBQQVJUSUFMX1JJR0hUX0ZMQUcpIHtcbiAgICB2YXIgcGFydGlhbHNSaWdodCA9IHBhcnRpYWxzLFxuICAgICAgICBob2xkZXJzUmlnaHQgPSBob2xkZXJzO1xuXG4gICAgcGFydGlhbHMgPSBob2xkZXJzID0gdW5kZWZpbmVkO1xuICB9XG4gIHZhciBuZXdEYXRhID0gW2Z1bmMsIGJpdG1hc2ssIHRoaXNBcmcsIHBhcnRpYWxzLCBob2xkZXJzLCBwYXJ0aWFsc1JpZ2h0LCBob2xkZXJzUmlnaHQsIGFyZ1BvcywgYXJ5LCBhcml0eV07XG5cbiAgZnVuYyA9IG5ld0RhdGFbMF07XG4gIGJpdG1hc2sgPSBuZXdEYXRhWzFdO1xuICB0aGlzQXJnID0gbmV3RGF0YVsyXTtcbiAgcGFydGlhbHMgPSBuZXdEYXRhWzNdO1xuICBob2xkZXJzID0gbmV3RGF0YVs0XTtcbiAgYXJpdHkgPSBuZXdEYXRhWzldID0gbmV3RGF0YVs5XSA9PSBudWxsXG4gICAgPyAoaXNCaW5kS2V5ID8gMCA6IGZ1bmMubGVuZ3RoKVxuICAgIDogbmF0aXZlTWF4KG5ld0RhdGFbOV0gLSBsZW5ndGgsIDApO1xuXG4gIGlmICghYXJpdHkgJiYgYml0bWFzayAmIChDVVJSWV9GTEFHIHwgQ1VSUllfUklHSFRfRkxBRykpIHtcbiAgICBiaXRtYXNrICY9IH4oQ1VSUllfRkxBRyB8IENVUlJZX1JJR0hUX0ZMQUcpO1xuICB9XG4gIGlmICghYml0bWFzayB8fCBiaXRtYXNrID09IEJJTkRfRkxBRykge1xuICAgIHZhciByZXN1bHQgPSBjcmVhdGVCYXNlV3JhcHBlcihmdW5jLCBiaXRtYXNrLCB0aGlzQXJnKTtcbiAgfSBlbHNlIGlmIChiaXRtYXNrID09IENVUlJZX0ZMQUcgfHwgYml0bWFzayA9PSBDVVJSWV9SSUdIVF9GTEFHKSB7XG4gICAgcmVzdWx0ID0gY3JlYXRlQ3VycnlXcmFwcGVyKGZ1bmMsIGJpdG1hc2ssIGFyaXR5KTtcbiAgfSBlbHNlIGlmICgoYml0bWFzayA9PSBQQVJUSUFMX0ZMQUcgfHwgYml0bWFzayA9PSAoQklORF9GTEFHIHwgUEFSVElBTF9GTEFHKSkgJiYgIWhvbGRlcnMubGVuZ3RoKSB7XG4gICAgcmVzdWx0ID0gY3JlYXRlUGFydGlhbFdyYXBwZXIoZnVuYywgYml0bWFzaywgdGhpc0FyZywgcGFydGlhbHMpO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdCA9IGNyZWF0ZUh5YnJpZFdyYXBwZXIuYXBwbHkodW5kZWZpbmVkLCBuZXdEYXRhKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFJlb3JkZXIgYGFycmF5YCBhY2NvcmRpbmcgdG8gdGhlIHNwZWNpZmllZCBpbmRleGVzIHdoZXJlIHRoZSBlbGVtZW50IGF0XG4gKiB0aGUgZmlyc3QgaW5kZXggaXMgYXNzaWduZWQgYXMgdGhlIGZpcnN0IGVsZW1lbnQsIHRoZSBlbGVtZW50IGF0XG4gKiB0aGUgc2Vjb25kIGluZGV4IGlzIGFzc2lnbmVkIGFzIHRoZSBzZWNvbmQgZWxlbWVudCwgYW5kIHNvIG9uLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcmVvcmRlci5cbiAqIEBwYXJhbSB7QXJyYXl9IGluZGV4ZXMgVGhlIGFycmFuZ2VkIGFycmF5IGluZGV4ZXMuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYGFycmF5YC5cbiAqL1xuZnVuY3Rpb24gcmVvcmRlcihhcnJheSwgaW5kZXhlcykge1xuICB2YXIgYXJyTGVuZ3RoID0gYXJyYXkubGVuZ3RoLFxuICAgICAgbGVuZ3RoID0gbmF0aXZlTWluKGluZGV4ZXMubGVuZ3RoLCBhcnJMZW5ndGgpLFxuICAgICAgb2xkQXJyYXkgPSBjb3B5QXJyYXkoYXJyYXkpO1xuXG4gIHdoaWxlIChsZW5ndGgtLSkge1xuICAgIHZhciBpbmRleCA9IGluZGV4ZXNbbGVuZ3RoXTtcbiAgICBhcnJheVtsZW5ndGhdID0gaXNJbmRleChpbmRleCwgYXJyTGVuZ3RoKSA/IG9sZEFycmF5W2luZGV4XSA6IHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gYXJyYXk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIFNhZmFyaSA4IHdoaWNoIHJldHVybnMgJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGNvbnN0cnVjdG9ycywgYW5kXG4gIC8vIFBoYW50b21KUyAxLjkgd2hpY2ggcmV0dXJucyAnZnVuY3Rpb24nIGZvciBgTm9kZUxpc3RgIGluc3RhbmNlcy5cbiAgdmFyIHRhZyA9IGlzT2JqZWN0KHZhbHVlKSA/IG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpIDogJyc7XG4gIHJldHVybiB0YWcgPT0gZnVuY1RhZyB8fCB0YWcgPT0gZ2VuVGFnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KF8ubm9vcCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGB2YWx1ZWAgdG8gYW4gaW50ZWdlci5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyBsb29zZWx5IGJhc2VkIG9uIFtgVG9JbnRlZ2VyYF0oaHR0cDovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXRvaW50ZWdlcikuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjb252ZXJ0LlxuICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgY29udmVydGVkIGludGVnZXIuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8udG9JbnRlZ2VyKDMpO1xuICogLy8gPT4gM1xuICpcbiAqIF8udG9JbnRlZ2VyKE51bWJlci5NSU5fVkFMVUUpO1xuICogLy8gPT4gMFxuICpcbiAqIF8udG9JbnRlZ2VyKEluZmluaXR5KTtcbiAqIC8vID0+IDEuNzk3NjkzMTM0ODYyMzE1N2UrMzA4XG4gKlxuICogXy50b0ludGVnZXIoJzMnKTtcbiAqIC8vID0+IDNcbiAqL1xuZnVuY3Rpb24gdG9JbnRlZ2VyKHZhbHVlKSB7XG4gIGlmICghdmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IDAgPyB2YWx1ZSA6IDA7XG4gIH1cbiAgdmFsdWUgPSB0b051bWJlcih2YWx1ZSk7XG4gIGlmICh2YWx1ZSA9PT0gSU5GSU5JVFkgfHwgdmFsdWUgPT09IC1JTkZJTklUWSkge1xuICAgIHZhciBzaWduID0gKHZhbHVlIDwgMCA/IC0xIDogMSk7XG4gICAgcmV0dXJuIHNpZ24gKiBNQVhfSU5URUdFUjtcbiAgfVxuICB2YXIgcmVtYWluZGVyID0gdmFsdWUgJSAxO1xuICByZXR1cm4gdmFsdWUgPT09IHZhbHVlID8gKHJlbWFpbmRlciA/IHZhbHVlIC0gcmVtYWluZGVyIDogdmFsdWUpIDogMDtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBgdmFsdWVgIHRvIGEgbnVtYmVyLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcHJvY2Vzcy5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG51bWJlci5cbiAqIEBleGFtcGxlXG4gKlxuICogXy50b051bWJlcigzKTtcbiAqIC8vID0+IDNcbiAqXG4gKiBfLnRvTnVtYmVyKE51bWJlci5NSU5fVkFMVUUpO1xuICogLy8gPT4gNWUtMzI0XG4gKlxuICogXy50b051bWJlcihJbmZpbml0eSk7XG4gKiAvLyA9PiBJbmZpbml0eVxuICpcbiAqIF8udG9OdW1iZXIoJzMnKTtcbiAqIC8vID0+IDNcbiAqL1xuZnVuY3Rpb24gdG9OdW1iZXIodmFsdWUpIHtcbiAgaWYgKGlzT2JqZWN0KHZhbHVlKSkge1xuICAgIHZhciBvdGhlciA9IGlzRnVuY3Rpb24odmFsdWUudmFsdWVPZikgPyB2YWx1ZS52YWx1ZU9mKCkgOiB2YWx1ZTtcbiAgICB2YWx1ZSA9IGlzT2JqZWN0KG90aGVyKSA/IChvdGhlciArICcnKSA6IG90aGVyO1xuICB9XG4gIGlmICh0eXBlb2YgdmFsdWUgIT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IDAgPyB2YWx1ZSA6ICt2YWx1ZTtcbiAgfVxuICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UocmVUcmltLCAnJyk7XG4gIHZhciBpc0JpbmFyeSA9IHJlSXNCaW5hcnkudGVzdCh2YWx1ZSk7XG4gIHJldHVybiAoaXNCaW5hcnkgfHwgcmVJc09jdGFsLnRlc3QodmFsdWUpKVxuICAgID8gZnJlZVBhcnNlSW50KHZhbHVlLnNsaWNlKDIpLCBpc0JpbmFyeSA/IDIgOiA4KVxuICAgIDogKHJlSXNCYWRIZXgudGVzdCh2YWx1ZSkgPyBOQU4gOiArdmFsdWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVdyYXBwZXI7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjkuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgZnVuY1RhZyA9ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBob3N0IGNvbnN0cnVjdG9ycyAoU2FmYXJpID4gNSkuICovXG52YXIgcmVJc0hvc3RDdG9yID0gL15cXFtvYmplY3QgLis/Q29uc3RydWN0b3JcXF0kLztcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG4vKiogVXNlZCBmb3IgbmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgZGVjb21waWxlZCBzb3VyY2Ugb2YgZnVuY3Rpb25zLiAqL1xudmFyIGZuVG9TdHJpbmcgPSBGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9ialRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBpZiBhIG1ldGhvZCBpcyBuYXRpdmUuICovXG52YXIgcmVJc05hdGl2ZSA9IFJlZ0V4cCgnXicgK1xuICBmblRvU3RyaW5nLmNhbGwoaGFzT3duUHJvcGVydHkpLnJlcGxhY2UoL1tcXFxcXiQuKis/KClbXFxde318XS9nLCAnXFxcXCQmJylcbiAgLnJlcGxhY2UoL2hhc093blByb3BlcnR5fChmdW5jdGlvbikuKj8oPz1cXFxcXFwoKXwgZm9yIC4rPyg/PVxcXFxcXF0pL2csICckMS4qPycpICsgJyQnXG4pO1xuXG4vKipcbiAqIEdldHMgdGhlIG5hdGl2ZSBmdW5jdGlvbiBhdCBga2V5YCBvZiBgb2JqZWN0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBtZXRob2QgdG8gZ2V0LlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIGZ1bmN0aW9uIGlmIGl0J3MgbmF0aXZlLCBlbHNlIGB1bmRlZmluZWRgLlxuICovXG5mdW5jdGlvbiBnZXROYXRpdmUob2JqZWN0LCBrZXkpIHtcbiAgdmFyIHZhbHVlID0gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgcmV0dXJuIGlzTmF0aXZlKHZhbHVlKSA/IHZhbHVlIDogdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgRnVuY3Rpb25gIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0Z1bmN0aW9uKF8pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNGdW5jdGlvbigvYWJjLyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gIC8vIFRoZSB1c2Ugb2YgYE9iamVjdCN0b1N0cmluZ2AgYXZvaWRzIGlzc3VlcyB3aXRoIHRoZSBgdHlwZW9mYCBvcGVyYXRvclxuICAvLyBpbiBvbGRlciB2ZXJzaW9ucyBvZiBDaHJvbWUgYW5kIFNhZmFyaSB3aGljaCByZXR1cm4gJ2Z1bmN0aW9uJyBmb3IgcmVnZXhlc1xuICAvLyBhbmQgU2FmYXJpIDggZXF1aXZhbGVudHMgd2hpY2ggcmV0dXJuICdvYmplY3QnIGZvciB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMuXG4gIHJldHVybiBpc09iamVjdCh2YWx1ZSkgJiYgb2JqVG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gZnVuY1RhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdCgxKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIC8vIEF2b2lkIGEgVjggSklUIGJ1ZyBpbiBDaHJvbWUgMTktMjAuXG4gIC8vIFNlZSBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MjI5MSBmb3IgbW9yZSBkZXRhaWxzLlxuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIG5hdGl2ZSBmdW5jdGlvbi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBuYXRpdmUgZnVuY3Rpb24sIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc05hdGl2ZShBcnJheS5wcm90b3R5cGUucHVzaCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc05hdGl2ZShfKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzTmF0aXZlKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgIHJldHVybiByZUlzTmF0aXZlLnRlc3QoZm5Ub1N0cmluZy5jYWxsKHZhbHVlKSk7XG4gIH1cbiAgcmV0dXJuIGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgcmVJc0hvc3RDdG9yLnRlc3QodmFsdWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldE5hdGl2ZTtcbiIsIi8qKlxuICogbG9kYXNoIDMuMC4wIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS43LjAgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBVc2VkIGFzIHRoZSBpbnRlcm5hbCBhcmd1bWVudCBwbGFjZWhvbGRlci4gKi9cbnZhciBQTEFDRUhPTERFUiA9ICdfX2xvZGFzaF9wbGFjZWhvbGRlcl9fJztcblxuLyoqXG4gKiBSZXBsYWNlcyBhbGwgYHBsYWNlaG9sZGVyYCBlbGVtZW50cyBpbiBgYXJyYXlgIHdpdGggYW4gaW50ZXJuYWwgcGxhY2Vob2xkZXJcbiAqIGFuZCByZXR1cm5zIGFuIGFycmF5IG9mIHRoZWlyIGluZGV4ZXMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBtb2RpZnkuXG4gKiBAcGFyYW0geyp9IHBsYWNlaG9sZGVyIFRoZSBwbGFjZWhvbGRlciB0byByZXBsYWNlLlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBuZXcgYXJyYXkgb2YgcGxhY2Vob2xkZXIgaW5kZXhlcy5cbiAqL1xuZnVuY3Rpb24gcmVwbGFjZUhvbGRlcnMoYXJyYXksIHBsYWNlaG9sZGVyKSB7XG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgbGVuZ3RoID0gYXJyYXkubGVuZ3RoLFxuICAgICAgcmVzSW5kZXggPSAtMSxcbiAgICAgIHJlc3VsdCA9IFtdO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgaWYgKGFycmF5W2luZGV4XSA9PT0gcGxhY2Vob2xkZXIpIHtcbiAgICAgIGFycmF5W2luZGV4XSA9IFBMQUNFSE9MREVSO1xuICAgICAgcmVzdWx0WysrcmVzSW5kZXhdID0gaW5kZXg7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmVwbGFjZUhvbGRlcnM7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBVc2VkIHRvIGRldGVybWluZSBpZiB2YWx1ZXMgYXJlIG9mIHRoZSBsYW5ndWFnZSB0eXBlIGBPYmplY3RgLiAqL1xudmFyIG9iamVjdFR5cGVzID0ge1xuICAnZnVuY3Rpb24nOiB0cnVlLFxuICAnb2JqZWN0JzogdHJ1ZVxufTtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBleHBvcnRzYC4gKi9cbnZhciBmcmVlRXhwb3J0cyA9IChvYmplY3RUeXBlc1t0eXBlb2YgZXhwb3J0c10gJiYgZXhwb3J0cyAmJiAhZXhwb3J0cy5ub2RlVHlwZSlcbiAgPyBleHBvcnRzXG4gIDogdW5kZWZpbmVkO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYG1vZHVsZWAuICovXG52YXIgZnJlZU1vZHVsZSA9IChvYmplY3RUeXBlc1t0eXBlb2YgbW9kdWxlXSAmJiBtb2R1bGUgJiYgIW1vZHVsZS5ub2RlVHlwZSlcbiAgPyBtb2R1bGVcbiAgOiB1bmRlZmluZWQ7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZ2xvYmFsYCBmcm9tIE5vZGUuanMuICovXG52YXIgZnJlZUdsb2JhbCA9IGNoZWNrR2xvYmFsKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUgJiYgdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWwpO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHNlbGZgLiAqL1xudmFyIGZyZWVTZWxmID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHNlbGZdICYmIHNlbGYpO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHdpbmRvd2AuICovXG52YXIgZnJlZVdpbmRvdyA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB3aW5kb3ddICYmIHdpbmRvdyk7XG5cbi8qKiBEZXRlY3QgYHRoaXNgIGFzIHRoZSBnbG9iYWwgb2JqZWN0LiAqL1xudmFyIHRoaXNHbG9iYWwgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2YgdGhpc10gJiYgdGhpcyk7XG5cbi8qKlxuICogVXNlZCBhcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdC5cbiAqXG4gKiBUaGUgYHRoaXNgIHZhbHVlIGlzIHVzZWQgaWYgaXQncyB0aGUgZ2xvYmFsIG9iamVjdCB0byBhdm9pZCBHcmVhc2Vtb25rZXknc1xuICogcmVzdHJpY3RlZCBgd2luZG93YCBvYmplY3QsIG90aGVyd2lzZSB0aGUgYHdpbmRvd2Agb2JqZWN0IGlzIHVzZWQuXG4gKi9cbnZhciByb290ID0gZnJlZUdsb2JhbCB8fFxuICAoKGZyZWVXaW5kb3cgIT09ICh0aGlzR2xvYmFsICYmIHRoaXNHbG9iYWwud2luZG93KSkgJiYgZnJlZVdpbmRvdykgfHxcbiAgICBmcmVlU2VsZiB8fCB0aGlzR2xvYmFsIHx8IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBnbG9iYWwgb2JqZWN0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtudWxsfE9iamVjdH0gUmV0dXJucyBgdmFsdWVgIGlmIGl0J3MgYSBnbG9iYWwgb2JqZWN0LCBlbHNlIGBudWxsYC5cbiAqL1xuZnVuY3Rpb24gY2hlY2tHbG9iYWwodmFsdWUpIHtcbiAgcmV0dXJuICh2YWx1ZSAmJiB2YWx1ZS5PYmplY3QgPT09IE9iamVjdCkgPyB2YWx1ZSA6IG51bGw7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcm9vdDtcbiIsIi8qKlxuICogbG9kYXNoIDMuMC4zIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIgYXJyYXlFYWNoID0gcmVxdWlyZSgnbG9kYXNoLl9hcnJheWVhY2gnKSxcbiAgICBiYXNlRWFjaCA9IHJlcXVpcmUoJ2xvZGFzaC5fYmFzZWVhY2gnKSxcbiAgICBiaW5kQ2FsbGJhY2sgPSByZXF1aXJlKCdsb2Rhc2guX2JpbmRjYWxsYmFjaycpLFxuICAgIGlzQXJyYXkgPSByZXF1aXJlKCdsb2Rhc2guaXNhcnJheScpO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiBmb3IgYF8uZm9yRWFjaGAgb3IgYF8uZm9yRWFjaFJpZ2h0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gYXJyYXlGdW5jIFRoZSBmdW5jdGlvbiB0byBpdGVyYXRlIG92ZXIgYW4gYXJyYXkuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBlYWNoRnVuYyBUaGUgZnVuY3Rpb24gdG8gaXRlcmF0ZSBvdmVyIGEgY29sbGVjdGlvbi5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGVhY2ggZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUZvckVhY2goYXJyYXlGdW5jLCBlYWNoRnVuYykge1xuICByZXR1cm4gZnVuY3Rpb24oY29sbGVjdGlvbiwgaXRlcmF0ZWUsIHRoaXNBcmcpIHtcbiAgICByZXR1cm4gKHR5cGVvZiBpdGVyYXRlZSA9PSAnZnVuY3Rpb24nICYmIHRoaXNBcmcgPT09IHVuZGVmaW5lZCAmJiBpc0FycmF5KGNvbGxlY3Rpb24pKVxuICAgICAgPyBhcnJheUZ1bmMoY29sbGVjdGlvbiwgaXRlcmF0ZWUpXG4gICAgICA6IGVhY2hGdW5jKGNvbGxlY3Rpb24sIGJpbmRDYWxsYmFjayhpdGVyYXRlZSwgdGhpc0FyZywgMykpO1xuICB9O1xufVxuXG4vKipcbiAqIEl0ZXJhdGVzIG92ZXIgZWxlbWVudHMgb2YgYGNvbGxlY3Rpb25gIGludm9raW5nIGBpdGVyYXRlZWAgZm9yIGVhY2ggZWxlbWVudC5cbiAqIFRoZSBgaXRlcmF0ZWVgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czpcbiAqICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS4gSXRlcmF0ZWUgZnVuY3Rpb25zIG1heSBleGl0IGl0ZXJhdGlvbiBlYXJseVxuICogYnkgZXhwbGljaXRseSByZXR1cm5pbmcgYGZhbHNlYC5cbiAqXG4gKiAqKk5vdGU6KiogQXMgd2l0aCBvdGhlciBcIkNvbGxlY3Rpb25zXCIgbWV0aG9kcywgb2JqZWN0cyB3aXRoIGEgXCJsZW5ndGhcIiBwcm9wZXJ0eVxuICogYXJlIGl0ZXJhdGVkIGxpa2UgYXJyYXlzLiBUbyBhdm9pZCB0aGlzIGJlaGF2aW9yIGBfLmZvckluYCBvciBgXy5mb3JPd25gXG4gKiBtYXkgYmUgdXNlZCBmb3Igb2JqZWN0IGl0ZXJhdGlvbi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGFsaWFzIGVhY2hcbiAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uXG4gKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2l0ZXJhdGVlPV8uaWRlbnRpdHldIFRoZSBmdW5jdGlvbiBpbnZva2VkIHBlciBpdGVyYXRpb24uXG4gKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGl0ZXJhdGVlYC5cbiAqIEByZXR1cm5zIHtBcnJheXxPYmplY3R8c3RyaW5nfSBSZXR1cm5zIGBjb2xsZWN0aW9uYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXyhbMSwgMl0pLmZvckVhY2goZnVuY3Rpb24obikge1xuICogICBjb25zb2xlLmxvZyhuKTtcbiAqIH0pLnZhbHVlKCk7XG4gKiAvLyA9PiBsb2dzIGVhY2ggdmFsdWUgZnJvbSBsZWZ0IHRvIHJpZ2h0IGFuZCByZXR1cm5zIHRoZSBhcnJheVxuICpcbiAqIF8uZm9yRWFjaCh7ICdhJzogMSwgJ2InOiAyIH0sIGZ1bmN0aW9uKG4sIGtleSkge1xuICogICBjb25zb2xlLmxvZyhuLCBrZXkpO1xuICogfSk7XG4gKiAvLyA9PiBsb2dzIGVhY2ggdmFsdWUta2V5IHBhaXIgYW5kIHJldHVybnMgdGhlIG9iamVjdCAoaXRlcmF0aW9uIG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICovXG52YXIgZm9yRWFjaCA9IGNyZWF0ZUZvckVhY2goYXJyYXlFYWNoLCBiYXNlRWFjaCk7XG5cbm1vZHVsZS5leHBvcnRzID0gZm9yRWFjaDtcbiIsIi8qKlxuICogbG9kYXNoIDMuMC44IChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE2IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTYgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqIFVzZWQgYXMgcmVmZXJlbmNlcyBmb3IgdmFyaW91cyBgTnVtYmVyYCBjb25zdGFudHMuICovXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTE7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBhcmdzVGFnID0gJ1tvYmplY3QgQXJndW1lbnRzXScsXG4gICAgZnVuY1RhZyA9ICdbb2JqZWN0IEZ1bmN0aW9uXScsXG4gICAgZ2VuVGFnID0gJ1tvYmplY3QgR2VuZXJhdG9yRnVuY3Rpb25dJztcblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgcHJvcGVydHlJc0VudW1lcmFibGUgPSBvYmplY3RQcm90by5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5wcm9wZXJ0eWAgd2l0aG91dCBzdXBwb3J0IGZvciBkZWVwIHBhdGhzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHByb3BlcnR5IHRvIGdldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBiYXNlUHJvcGVydHkoa2V5KSB7XG4gIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgfTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBcImxlbmd0aFwiIHByb3BlcnR5IHZhbHVlIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gYXZvaWQgYSBbSklUIGJ1Z10oaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE0Mjc5MilcbiAqIHRoYXQgYWZmZWN0cyBTYWZhcmkgb24gYXQgbGVhc3QgaU9TIDguMS04LjMgQVJNNjQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBcImxlbmd0aFwiIHZhbHVlLlxuICovXG52YXIgZ2V0TGVuZ3RoID0gYmFzZVByb3BlcnR5KCdsZW5ndGgnKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBsaWtlbHkgYW4gYGFyZ3VtZW50c2Agb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzQXJndW1lbnRzKGZ1bmN0aW9uKCkgeyByZXR1cm4gYXJndW1lbnRzOyB9KCkpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcmd1bWVudHMoWzEsIDIsIDNdKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJndW1lbnRzKHZhbHVlKSB7XG4gIC8vIFNhZmFyaSA4LjEgaW5jb3JyZWN0bHkgbWFrZXMgYGFyZ3VtZW50cy5jYWxsZWVgIGVudW1lcmFibGUgaW4gc3RyaWN0IG1vZGUuXG4gIHJldHVybiBpc0FycmF5TGlrZU9iamVjdCh2YWx1ZSkgJiYgaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgJ2NhbGxlZScpICYmXG4gICAgKCFwcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHZhbHVlLCAnY2FsbGVlJykgfHwgb2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gYXJnc1RhZyk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZS4gQSB2YWx1ZSBpcyBjb25zaWRlcmVkIGFycmF5LWxpa2UgaWYgaXQnc1xuICogbm90IGEgZnVuY3Rpb24gYW5kIGhhcyBhIGB2YWx1ZS5sZW5ndGhgIHRoYXQncyBhbiBpbnRlZ2VyIGdyZWF0ZXIgdGhhbiBvclxuICogZXF1YWwgdG8gYDBgIGFuZCBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gYE51bWJlci5NQVhfU0FGRV9JTlRFR0VSYC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZSwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZShkb2N1bWVudC5ib2R5LmNoaWxkcmVuKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKCdhYmMnKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiBpc0xlbmd0aChnZXRMZW5ndGgodmFsdWUpKSAmJiAhaXNGdW5jdGlvbih2YWx1ZSk7XG59XG5cbi8qKlxuICogVGhpcyBtZXRob2QgaXMgbGlrZSBgXy5pc0FycmF5TGlrZWAgZXhjZXB0IHRoYXQgaXQgYWxzbyBjaGVja3MgaWYgYHZhbHVlYFxuICogaXMgYW4gb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBhcnJheS1saWtlIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZU9iamVjdChkb2N1bWVudC5ib2R5LmNoaWxkcmVuKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlT2JqZWN0KCdhYmMnKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0FycmF5TGlrZU9iamVjdChfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcnJheUxpa2VPYmplY3QodmFsdWUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgaXNBcnJheUxpa2UodmFsdWUpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgRnVuY3Rpb25gIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0Z1bmN0aW9uKF8pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNGdW5jdGlvbigvYWJjLyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gIC8vIFRoZSB1c2Ugb2YgYE9iamVjdCN0b1N0cmluZ2AgYXZvaWRzIGlzc3VlcyB3aXRoIHRoZSBgdHlwZW9mYCBvcGVyYXRvclxuICAvLyBpbiBTYWZhcmkgOCB3aGljaCByZXR1cm5zICdvYmplY3QnIGZvciB0eXBlZCBhcnJheSBhbmQgd2VhayBtYXAgY29uc3RydWN0b3JzLFxuICAvLyBhbmQgUGhhbnRvbUpTIDEuOSB3aGljaCByZXR1cm5zICdmdW5jdGlvbicgZm9yIGBOb2RlTGlzdGAgaW5zdGFuY2VzLlxuICB2YXIgdGFnID0gaXNPYmplY3QodmFsdWUpID8gb2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSkgOiAnJztcbiAgcmV0dXJuIHRhZyA9PSBmdW5jVGFnIHx8IHRhZyA9PSBnZW5UYWc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGxlbmd0aC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyBsb29zZWx5IGJhc2VkIG9uIFtgVG9MZW5ndGhgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgbGVuZ3RoLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNMZW5ndGgoMyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0xlbmd0aChOdW1iZXIuTUlOX1ZBTFVFKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0xlbmd0aChJbmZpbml0eSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNMZW5ndGgoJzMnKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzTGVuZ3RoKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgJiZcbiAgICB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDw9IE1BWF9TQUZFX0lOVEVHRVI7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoXy5ub29wKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KG51bGwpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuIEEgdmFsdWUgaXMgb2JqZWN0LWxpa2UgaWYgaXQncyBub3QgYG51bGxgXG4gKiBhbmQgaGFzIGEgYHR5cGVvZmAgcmVzdWx0IG9mIFwib2JqZWN0XCIuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKG51bGwpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3RMaWtlKHZhbHVlKSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FyZ3VtZW50cztcbiIsIi8qKlxuICogbG9kYXNoIDMuMC40IChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBhcnJheVRhZyA9ICdbb2JqZWN0IEFycmF5XScsXG4gICAgZnVuY1RhZyA9ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBob3N0IGNvbnN0cnVjdG9ycyAoU2FmYXJpID4gNSkuICovXG52YXIgcmVJc0hvc3RDdG9yID0gL15cXFtvYmplY3QgLis/Q29uc3RydWN0b3JcXF0kLztcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG4vKiogVXNlZCBmb3IgbmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgZGVjb21waWxlZCBzb3VyY2Ugb2YgZnVuY3Rpb25zLiAqL1xudmFyIGZuVG9TdHJpbmcgPSBGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9ialRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBpZiBhIG1ldGhvZCBpcyBuYXRpdmUuICovXG52YXIgcmVJc05hdGl2ZSA9IFJlZ0V4cCgnXicgK1xuICBmblRvU3RyaW5nLmNhbGwoaGFzT3duUHJvcGVydHkpLnJlcGxhY2UoL1tcXFxcXiQuKis/KClbXFxde318XS9nLCAnXFxcXCQmJylcbiAgLnJlcGxhY2UoL2hhc093blByb3BlcnR5fChmdW5jdGlvbikuKj8oPz1cXFxcXFwoKXwgZm9yIC4rPyg/PVxcXFxcXF0pL2csICckMS4qPycpICsgJyQnXG4pO1xuXG4vKiBOYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMgZm9yIHRob3NlIHdpdGggdGhlIHNhbWUgbmFtZSBhcyBvdGhlciBgbG9kYXNoYCBtZXRob2RzLiAqL1xudmFyIG5hdGl2ZUlzQXJyYXkgPSBnZXROYXRpdmUoQXJyYXksICdpc0FycmF5Jyk7XG5cbi8qKlxuICogVXNlZCBhcyB0aGUgW21heGltdW0gbGVuZ3RoXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1udW1iZXIubWF4X3NhZmVfaW50ZWdlcilcbiAqIG9mIGFuIGFycmF5LWxpa2UgdmFsdWUuXG4gKi9cbnZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcblxuLyoqXG4gKiBHZXRzIHRoZSBuYXRpdmUgZnVuY3Rpb24gYXQgYGtleWAgb2YgYG9iamVjdGAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgbWV0aG9kIHRvIGdldC5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBmdW5jdGlvbiBpZiBpdCdzIG5hdGl2ZSwgZWxzZSBgdW5kZWZpbmVkYC5cbiAqL1xuZnVuY3Rpb24gZ2V0TmF0aXZlKG9iamVjdCwga2V5KSB7XG4gIHZhciB2YWx1ZSA9IG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogb2JqZWN0W2tleV07XG4gIHJldHVybiBpc05hdGl2ZSh2YWx1ZSkgPyB2YWx1ZSA6IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgbGVuZ3RoLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGJhc2VkIG9uIFtgVG9MZW5ndGhgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDw9IE1BWF9TQUZFX0lOVEVHRVI7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhbiBgQXJyYXlgIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FycmF5KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5KGZ1bmN0aW9uKCkgeyByZXR1cm4gYXJndW1lbnRzOyB9KCkpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xudmFyIGlzQXJyYXkgPSBuYXRpdmVJc0FycmF5IHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmIGlzTGVuZ3RoKHZhbHVlLmxlbmd0aCkgJiYgb2JqVG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gYXJyYXlUYWc7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgRnVuY3Rpb25gIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0Z1bmN0aW9uKF8pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNGdW5jdGlvbigvYWJjLyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gIC8vIFRoZSB1c2Ugb2YgYE9iamVjdCN0b1N0cmluZ2AgYXZvaWRzIGlzc3VlcyB3aXRoIHRoZSBgdHlwZW9mYCBvcGVyYXRvclxuICAvLyBpbiBvbGRlciB2ZXJzaW9ucyBvZiBDaHJvbWUgYW5kIFNhZmFyaSB3aGljaCByZXR1cm4gJ2Z1bmN0aW9uJyBmb3IgcmVnZXhlc1xuICAvLyBhbmQgU2FmYXJpIDggZXF1aXZhbGVudHMgd2hpY2ggcmV0dXJuICdvYmplY3QnIGZvciB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMuXG4gIHJldHVybiBpc09iamVjdCh2YWx1ZSkgJiYgb2JqVG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gZnVuY1RhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdCgxKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIC8vIEF2b2lkIGEgVjggSklUIGJ1ZyBpbiBDaHJvbWUgMTktMjAuXG4gIC8vIFNlZSBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MjI5MSBmb3IgbW9yZSBkZXRhaWxzLlxuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIG5hdGl2ZSBmdW5jdGlvbi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBuYXRpdmUgZnVuY3Rpb24sIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc05hdGl2ZShBcnJheS5wcm90b3R5cGUucHVzaCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc05hdGl2ZShfKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzTmF0aXZlKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgIHJldHVybiByZUlzTmF0aXZlLnRlc3QoZm5Ub1N0cmluZy5jYWxsKHZhbHVlKSk7XG4gIH1cbiAgcmV0dXJuIGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgcmVJc0hvc3RDdG9yLnRlc3QodmFsdWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJyYXk7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjEuMiAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xudmFyIGdldE5hdGl2ZSA9IHJlcXVpcmUoJ2xvZGFzaC5fZ2V0bmF0aXZlJyksXG4gICAgaXNBcmd1bWVudHMgPSByZXF1aXJlKCdsb2Rhc2guaXNhcmd1bWVudHMnKSxcbiAgICBpc0FycmF5ID0gcmVxdWlyZSgnbG9kYXNoLmlzYXJyYXknKTtcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IHVuc2lnbmVkIGludGVnZXIgdmFsdWVzLiAqL1xudmFyIHJlSXNVaW50ID0gL15cXGQrJC87XG5cbi8qKiBVc2VkIGZvciBuYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byBjaGVjayBvYmplY3RzIGZvciBvd24gcHJvcGVydGllcy4gKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5O1xuXG4vKiBOYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMgZm9yIHRob3NlIHdpdGggdGhlIHNhbWUgbmFtZSBhcyBvdGhlciBgbG9kYXNoYCBtZXRob2RzLiAqL1xudmFyIG5hdGl2ZUtleXMgPSBnZXROYXRpdmUoT2JqZWN0LCAna2V5cycpO1xuXG4vKipcbiAqIFVzZWQgYXMgdGhlIFttYXhpbXVtIGxlbmd0aF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtbnVtYmVyLm1heF9zYWZlX2ludGVnZXIpXG4gKiBvZiBhbiBhcnJheS1saWtlIHZhbHVlLlxuICovXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTE7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8ucHJvcGVydHlgIHdpdGhvdXQgc3VwcG9ydCBmb3IgZGVlcCBwYXRocy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBwcm9wZXJ0eSB0byBnZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gYmFzZVByb3BlcnR5KGtleSkge1xuICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgcmV0dXJuIG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogb2JqZWN0W2tleV07XG4gIH07XG59XG5cbi8qKlxuICogR2V0cyB0aGUgXCJsZW5ndGhcIiBwcm9wZXJ0eSB2YWx1ZSBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyB1c2VkIHRvIGF2b2lkIGEgW0pJVCBidWddKGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNDI3OTIpXG4gKiB0aGF0IGFmZmVjdHMgU2FmYXJpIG9uIGF0IGxlYXN0IGlPUyA4LjEtOC4zIEFSTTY0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgXCJsZW5ndGhcIiB2YWx1ZS5cbiAqL1xudmFyIGdldExlbmd0aCA9IGJhc2VQcm9wZXJ0eSgnbGVuZ3RoJyk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlMaWtlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPSBudWxsICYmIGlzTGVuZ3RoKGdldExlbmd0aCh2YWx1ZSkpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBpbmRleC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcGFyYW0ge251bWJlcn0gW2xlbmd0aD1NQVhfU0FGRV9JTlRFR0VSXSBUaGUgdXBwZXIgYm91bmRzIG9mIGEgdmFsaWQgaW5kZXguXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGluZGV4LCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzSW5kZXgodmFsdWUsIGxlbmd0aCkge1xuICB2YWx1ZSA9ICh0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgfHwgcmVJc1VpbnQudGVzdCh2YWx1ZSkpID8gK3ZhbHVlIDogLTE7XG4gIGxlbmd0aCA9IGxlbmd0aCA9PSBudWxsID8gTUFYX1NBRkVfSU5URUdFUiA6IGxlbmd0aDtcbiAgcmV0dXJuIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPCBsZW5ndGg7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGxlbmd0aC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyBiYXNlZCBvbiBbYFRvTGVuZ3RoYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtdG9sZW5ndGgpLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgbGVuZ3RoLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzTGVuZ3RoKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgJiYgdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8PSBNQVhfU0FGRV9JTlRFR0VSO1xufVxuXG4vKipcbiAqIEEgZmFsbGJhY2sgaW1wbGVtZW50YXRpb24gb2YgYE9iamVjdC5rZXlzYCB3aGljaCBjcmVhdGVzIGFuIGFycmF5IG9mIHRoZVxuICogb3duIGVudW1lcmFibGUgcHJvcGVydHkgbmFtZXMgb2YgYG9iamVjdGAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgYXJyYXkgb2YgcHJvcGVydHkgbmFtZXMuXG4gKi9cbmZ1bmN0aW9uIHNoaW1LZXlzKG9iamVjdCkge1xuICB2YXIgcHJvcHMgPSBrZXlzSW4ob2JqZWN0KSxcbiAgICAgIHByb3BzTGVuZ3RoID0gcHJvcHMubGVuZ3RoLFxuICAgICAgbGVuZ3RoID0gcHJvcHNMZW5ndGggJiYgb2JqZWN0Lmxlbmd0aDtcblxuICB2YXIgYWxsb3dJbmRleGVzID0gISFsZW5ndGggJiYgaXNMZW5ndGgobGVuZ3RoKSAmJlxuICAgIChpc0FycmF5KG9iamVjdCkgfHwgaXNBcmd1bWVudHMob2JqZWN0KSk7XG5cbiAgdmFyIGluZGV4ID0gLTEsXG4gICAgICByZXN1bHQgPSBbXTtcblxuICB3aGlsZSAoKytpbmRleCA8IHByb3BzTGVuZ3RoKSB7XG4gICAgdmFyIGtleSA9IHByb3BzW2luZGV4XTtcbiAgICBpZiAoKGFsbG93SW5kZXhlcyAmJiBpc0luZGV4KGtleSwgbGVuZ3RoKSkgfHwgaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIGtleSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoMSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICAvLyBBdm9pZCBhIFY4IEpJVCBidWcgaW4gQ2hyb21lIDE5LTIwLlxuICAvLyBTZWUgaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTIyOTEgZm9yIG1vcmUgZGV0YWlscy5cbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiB0aGUgb3duIGVudW1lcmFibGUgcHJvcGVydHkgbmFtZXMgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIE5vbi1vYmplY3QgdmFsdWVzIGFyZSBjb2VyY2VkIHRvIG9iamVjdHMuIFNlZSB0aGVcbiAqIFtFUyBzcGVjXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3Qua2V5cylcbiAqIGZvciBtb3JlIGRldGFpbHMuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBPYmplY3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgYXJyYXkgb2YgcHJvcGVydHkgbmFtZXMuXG4gKiBAZXhhbXBsZVxuICpcbiAqIGZ1bmN0aW9uIEZvbygpIHtcbiAqICAgdGhpcy5hID0gMTtcbiAqICAgdGhpcy5iID0gMjtcbiAqIH1cbiAqXG4gKiBGb28ucHJvdG90eXBlLmMgPSAzO1xuICpcbiAqIF8ua2V5cyhuZXcgRm9vKTtcbiAqIC8vID0+IFsnYScsICdiJ10gKGl0ZXJhdGlvbiBvcmRlciBpcyBub3QgZ3VhcmFudGVlZClcbiAqXG4gKiBfLmtleXMoJ2hpJyk7XG4gKiAvLyA9PiBbJzAnLCAnMSddXG4gKi9cbnZhciBrZXlzID0gIW5hdGl2ZUtleXMgPyBzaGltS2V5cyA6IGZ1bmN0aW9uKG9iamVjdCkge1xuICB2YXIgQ3RvciA9IG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogb2JqZWN0LmNvbnN0cnVjdG9yO1xuICBpZiAoKHR5cGVvZiBDdG9yID09ICdmdW5jdGlvbicgJiYgQ3Rvci5wcm90b3R5cGUgPT09IG9iamVjdCkgfHxcbiAgICAgICh0eXBlb2Ygb2JqZWN0ICE9ICdmdW5jdGlvbicgJiYgaXNBcnJheUxpa2Uob2JqZWN0KSkpIHtcbiAgICByZXR1cm4gc2hpbUtleXMob2JqZWN0KTtcbiAgfVxuICByZXR1cm4gaXNPYmplY3Qob2JqZWN0KSA/IG5hdGl2ZUtleXMob2JqZWN0KSA6IFtdO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIHRoZSBvd24gYW5kIGluaGVyaXRlZCBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBOb24tb2JqZWN0IHZhbHVlcyBhcmUgY29lcmNlZCB0byBvYmplY3RzLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgT2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICogQGV4YW1wbGVcbiAqXG4gKiBmdW5jdGlvbiBGb28oKSB7XG4gKiAgIHRoaXMuYSA9IDE7XG4gKiAgIHRoaXMuYiA9IDI7XG4gKiB9XG4gKlxuICogRm9vLnByb3RvdHlwZS5jID0gMztcbiAqXG4gKiBfLmtleXNJbihuZXcgRm9vKTtcbiAqIC8vID0+IFsnYScsICdiJywgJ2MnXSAoaXRlcmF0aW9uIG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICovXG5mdW5jdGlvbiBrZXlzSW4ob2JqZWN0KSB7XG4gIGlmIChvYmplY3QgPT0gbnVsbCkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICBpZiAoIWlzT2JqZWN0KG9iamVjdCkpIHtcbiAgICBvYmplY3QgPSBPYmplY3Qob2JqZWN0KTtcbiAgfVxuICB2YXIgbGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcbiAgbGVuZ3RoID0gKGxlbmd0aCAmJiBpc0xlbmd0aChsZW5ndGgpICYmXG4gICAgKGlzQXJyYXkob2JqZWN0KSB8fCBpc0FyZ3VtZW50cyhvYmplY3QpKSAmJiBsZW5ndGgpIHx8IDA7XG5cbiAgdmFyIEN0b3IgPSBvYmplY3QuY29uc3RydWN0b3IsXG4gICAgICBpbmRleCA9IC0xLFxuICAgICAgaXNQcm90byA9IHR5cGVvZiBDdG9yID09ICdmdW5jdGlvbicgJiYgQ3Rvci5wcm90b3R5cGUgPT09IG9iamVjdCxcbiAgICAgIHJlc3VsdCA9IEFycmF5KGxlbmd0aCksXG4gICAgICBza2lwSW5kZXhlcyA9IGxlbmd0aCA+IDA7XG5cbiAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICByZXN1bHRbaW5kZXhdID0gKGluZGV4ICsgJycpO1xuICB9XG4gIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICBpZiAoIShza2lwSW5kZXhlcyAmJiBpc0luZGV4KGtleSwgbGVuZ3RoKSkgJiZcbiAgICAgICAgIShrZXkgPT0gJ2NvbnN0cnVjdG9yJyAmJiAoaXNQcm90byB8fCAhaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIGtleSkpKSkge1xuICAgICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBrZXlzO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4xLjEgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbnZhciBjcmVhdGVXcmFwcGVyID0gcmVxdWlyZSgnbG9kYXNoLl9jcmVhdGV3cmFwcGVyJyksXG4gICAgcmVwbGFjZUhvbGRlcnMgPSByZXF1aXJlKCdsb2Rhc2guX3JlcGxhY2Vob2xkZXJzJyksXG4gICAgcmVzdFBhcmFtID0gcmVxdWlyZSgnbG9kYXNoLnJlc3RwYXJhbScpO1xuXG4vKiogVXNlZCB0byBjb21wb3NlIGJpdG1hc2tzIGZvciB3cmFwcGVyIG1ldGFkYXRhLiAqL1xudmFyIFBBUlRJQUxfRkxBRyA9IDMyO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBgXy5wYXJ0aWFsYCBvciBgXy5wYXJ0aWFsUmlnaHRgIGZ1bmN0aW9uLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGZsYWcgVGhlIHBhcnRpYWwgYml0IGZsYWcuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBwYXJ0aWFsIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVQYXJ0aWFsKGZsYWcpIHtcbiAgdmFyIHBhcnRpYWxGdW5jID0gcmVzdFBhcmFtKGZ1bmN0aW9uKGZ1bmMsIHBhcnRpYWxzKSB7XG4gICAgdmFyIGhvbGRlcnMgPSByZXBsYWNlSG9sZGVycyhwYXJ0aWFscywgcGFydGlhbEZ1bmMucGxhY2Vob2xkZXIpO1xuICAgIHJldHVybiBjcmVhdGVXcmFwcGVyKGZ1bmMsIGZsYWcsIHVuZGVmaW5lZCwgcGFydGlhbHMsIGhvbGRlcnMpO1xuICB9KTtcbiAgcmV0dXJuIHBhcnRpYWxGdW5jO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGludm9rZXMgYGZ1bmNgIHdpdGggYHBhcnRpYWxgIGFyZ3VtZW50cyBwcmVwZW5kZWRcbiAqIHRvIHRob3NlIHByb3ZpZGVkIHRvIHRoZSBuZXcgZnVuY3Rpb24uIFRoaXMgbWV0aG9kIGlzIGxpa2UgYF8uYmluZGAgZXhjZXB0XG4gKiBpdCBkb2VzICoqbm90KiogYWx0ZXIgdGhlIGB0aGlzYCBiaW5kaW5nLlxuICpcbiAqIFRoZSBgXy5wYXJ0aWFsLnBsYWNlaG9sZGVyYCB2YWx1ZSwgd2hpY2ggZGVmYXVsdHMgdG8gYF9gIGluIG1vbm9saXRoaWNcbiAqIGJ1aWxkcywgbWF5IGJlIHVzZWQgYXMgYSBwbGFjZWhvbGRlciBmb3IgcGFydGlhbGx5IGFwcGxpZWQgYXJndW1lbnRzLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIG1ldGhvZCBkb2VzIG5vdCBzZXQgdGhlIFwibGVuZ3RoXCIgcHJvcGVydHkgb2YgcGFydGlhbGx5XG4gKiBhcHBsaWVkIGZ1bmN0aW9ucy5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IEZ1bmN0aW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBwYXJ0aWFsbHkgYXBwbHkgYXJndW1lbnRzIHRvLlxuICogQHBhcmFtIHsuLi4qfSBbcGFydGlhbHNdIFRoZSBhcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBwYXJ0aWFsbHkgYXBwbGllZCBmdW5jdGlvbi5cbiAqIEBleGFtcGxlXG4gKlxuICogdmFyIGdyZWV0ID0gZnVuY3Rpb24oZ3JlZXRpbmcsIG5hbWUpIHtcbiAqICAgcmV0dXJuIGdyZWV0aW5nICsgJyAnICsgbmFtZTtcbiAqIH07XG4gKlxuICogdmFyIHNheUhlbGxvVG8gPSBfLnBhcnRpYWwoZ3JlZXQsICdoZWxsbycpO1xuICogc2F5SGVsbG9UbygnZnJlZCcpO1xuICogLy8gPT4gJ2hlbGxvIGZyZWQnXG4gKlxuICogLy8gdXNpbmcgcGxhY2Vob2xkZXJzXG4gKiB2YXIgZ3JlZXRGcmVkID0gXy5wYXJ0aWFsKGdyZWV0LCBfLCAnZnJlZCcpO1xuICogZ3JlZXRGcmVkKCdoaScpO1xuICogLy8gPT4gJ2hpIGZyZWQnXG4gKi9cbnZhciBwYXJ0aWFsID0gY3JlYXRlUGFydGlhbChQQVJUSUFMX0ZMQUcpO1xuXG4vLyBBc3NpZ24gZGVmYXVsdCBwbGFjZWhvbGRlcnMuXG5wYXJ0aWFsLnBsYWNlaG9sZGVyID0ge307XG5cbm1vZHVsZS5leHBvcnRzID0gcGFydGlhbDtcbiIsIi8qKlxuICogbG9kYXNoIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgalF1ZXJ5IEZvdW5kYXRpb24gYW5kIG90aGVyIGNvbnRyaWJ1dG9ycyA8aHR0cHM6Ly9qcXVlcnkub3JnLz5cbiAqIFJlbGVhc2VkIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqL1xuXG4vKiogVXNlZCBhcyByZWZlcmVuY2VzIGZvciB2YXJpb3VzIGBOdW1iZXJgIGNvbnN0YW50cy4gKi9cbnZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MSxcbiAgICBOQU4gPSAwIC8gMDtcblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNUYWcgPSAnW29iamVjdCBGdW5jdGlvbl0nLFxuICAgIGdlblRhZyA9ICdbb2JqZWN0IEdlbmVyYXRvckZ1bmN0aW9uXScsXG4gICAgc3ltYm9sVGFnID0gJ1tvYmplY3QgU3ltYm9sXSc7XG5cbi8qKiBVc2VkIHRvIG1hdGNoIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2UuICovXG52YXIgcmVUcmltID0gL15cXHMrfFxccyskL2c7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBiYWQgc2lnbmVkIGhleGFkZWNpbWFsIHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc0JhZEhleCA9IC9eWy0rXTB4WzAtOWEtZl0rJC9pO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgYmluYXJ5IHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc0JpbmFyeSA9IC9eMGJbMDFdKyQvaTtcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IG9jdGFsIHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc09jdGFsID0gL14wb1swLTddKyQvaTtcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IHVuc2lnbmVkIGludGVnZXIgdmFsdWVzLiAqL1xudmFyIHJlSXNVaW50ID0gL14oPzowfFsxLTldXFxkKikkLztcblxuLyoqIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIHdpdGhvdXQgYSBkZXBlbmRlbmN5IG9uIGByb290YC4gKi9cbnZhciBmcmVlUGFyc2VJbnQgPSBwYXJzZUludDtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5wcm9wZXJ0eWAgd2l0aG91dCBzdXBwb3J0IGZvciBkZWVwIHBhdGhzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHByb3BlcnR5IHRvIGdldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGFjY2Vzc29yIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBiYXNlUHJvcGVydHkoa2V5KSB7XG4gIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgfTtcbn1cblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlXG4gKiBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9iamVjdFRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVDZWlsID0gTWF0aC5jZWlsLFxuICAgIG5hdGl2ZU1heCA9IE1hdGgubWF4O1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnJhbmdlYCBhbmQgYF8ucmFuZ2VSaWdodGAgd2hpY2ggZG9lc24ndFxuICogY29lcmNlIGFyZ3VtZW50cy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IFRoZSBzdGFydCBvZiB0aGUgcmFuZ2UuXG4gKiBAcGFyYW0ge251bWJlcn0gZW5kIFRoZSBlbmQgb2YgdGhlIHJhbmdlLlxuICogQHBhcmFtIHtudW1iZXJ9IHN0ZXAgVGhlIHZhbHVlIHRvIGluY3JlbWVudCBvciBkZWNyZW1lbnQgYnkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtmcm9tUmlnaHRdIFNwZWNpZnkgaXRlcmF0aW5nIGZyb20gcmlnaHQgdG8gbGVmdC5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgcmFuZ2Ugb2YgbnVtYmVycy5cbiAqL1xuZnVuY3Rpb24gYmFzZVJhbmdlKHN0YXJ0LCBlbmQsIHN0ZXAsIGZyb21SaWdodCkge1xuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIGxlbmd0aCA9IG5hdGl2ZU1heChuYXRpdmVDZWlsKChlbmQgLSBzdGFydCkgLyAoc3RlcCB8fCAxKSksIDApLFxuICAgICAgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcblxuICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICByZXN1bHRbZnJvbVJpZ2h0ID8gbGVuZ3RoIDogKytpbmRleF0gPSBzdGFydDtcbiAgICBzdGFydCArPSBzdGVwO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBfLnJhbmdlYCBvciBgXy5yYW5nZVJpZ2h0YCBmdW5jdGlvbi5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtib29sZWFufSBbZnJvbVJpZ2h0XSBTcGVjaWZ5IGl0ZXJhdGluZyBmcm9tIHJpZ2h0IHRvIGxlZnQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyByYW5nZSBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlUmFuZ2UoZnJvbVJpZ2h0KSB7XG4gIHJldHVybiBmdW5jdGlvbihzdGFydCwgZW5kLCBzdGVwKSB7XG4gICAgaWYgKHN0ZXAgJiYgdHlwZW9mIHN0ZXAgIT0gJ251bWJlcicgJiYgaXNJdGVyYXRlZUNhbGwoc3RhcnQsIGVuZCwgc3RlcCkpIHtcbiAgICAgIGVuZCA9IHN0ZXAgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIC8vIEVuc3VyZSB0aGUgc2lnbiBvZiBgLTBgIGlzIHByZXNlcnZlZC5cbiAgICBzdGFydCA9IHRvTnVtYmVyKHN0YXJ0KTtcbiAgICBzdGFydCA9IHN0YXJ0ID09PSBzdGFydCA/IHN0YXJ0IDogMDtcbiAgICBpZiAoZW5kID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGVuZCA9IHN0YXJ0O1xuICAgICAgc3RhcnQgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbmQgPSB0b051bWJlcihlbmQpIHx8IDA7XG4gICAgfVxuICAgIHN0ZXAgPSBzdGVwID09PSB1bmRlZmluZWQgPyAoc3RhcnQgPCBlbmQgPyAxIDogLTEpIDogKHRvTnVtYmVyKHN0ZXApIHx8IDApO1xuICAgIHJldHVybiBiYXNlUmFuZ2Uoc3RhcnQsIGVuZCwgc3RlcCwgZnJvbVJpZ2h0KTtcbiAgfTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBcImxlbmd0aFwiIHByb3BlcnR5IHZhbHVlIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gYXZvaWQgYVxuICogW0pJVCBidWddKGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNDI3OTIpIHRoYXQgYWZmZWN0c1xuICogU2FmYXJpIG9uIGF0IGxlYXN0IGlPUyA4LjEtOC4zIEFSTTY0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgXCJsZW5ndGhcIiB2YWx1ZS5cbiAqL1xudmFyIGdldExlbmd0aCA9IGJhc2VQcm9wZXJ0eSgnbGVuZ3RoJyk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGluZGV4LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoPU1BWF9TQUZFX0lOVEVHRVJdIFRoZSB1cHBlciBib3VuZHMgb2YgYSB2YWxpZCBpbmRleC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgaW5kZXgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNJbmRleCh2YWx1ZSwgbGVuZ3RoKSB7XG4gIGxlbmd0aCA9IGxlbmd0aCA9PSBudWxsID8gTUFYX1NBRkVfSU5URUdFUiA6IGxlbmd0aDtcbiAgcmV0dXJuICEhbGVuZ3RoICYmXG4gICAgKHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fCByZUlzVWludC50ZXN0KHZhbHVlKSkgJiZcbiAgICAodmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8IGxlbmd0aCk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiBhcmd1bWVudHMgYXJlIGZyb20gYW4gaXRlcmF0ZWUgY2FsbC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgcG90ZW50aWFsIGl0ZXJhdGVlIHZhbHVlIGFyZ3VtZW50LlxuICogQHBhcmFtIHsqfSBpbmRleCBUaGUgcG90ZW50aWFsIGl0ZXJhdGVlIGluZGV4IG9yIGtleSBhcmd1bWVudC5cbiAqIEBwYXJhbSB7Kn0gb2JqZWN0IFRoZSBwb3RlbnRpYWwgaXRlcmF0ZWUgb2JqZWN0IGFyZ3VtZW50LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBhcmd1bWVudHMgYXJlIGZyb20gYW4gaXRlcmF0ZWUgY2FsbCxcbiAqICBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzSXRlcmF0ZWVDYWxsKHZhbHVlLCBpbmRleCwgb2JqZWN0KSB7XG4gIGlmICghaXNPYmplY3Qob2JqZWN0KSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgdHlwZSA9IHR5cGVvZiBpbmRleDtcbiAgaWYgKHR5cGUgPT0gJ251bWJlcidcbiAgICAgICAgPyAoaXNBcnJheUxpa2Uob2JqZWN0KSAmJiBpc0luZGV4KGluZGV4LCBvYmplY3QubGVuZ3RoKSlcbiAgICAgICAgOiAodHlwZSA9PSAnc3RyaW5nJyAmJiBpbmRleCBpbiBvYmplY3QpXG4gICAgICApIHtcbiAgICByZXR1cm4gZXEob2JqZWN0W2luZGV4XSwgdmFsdWUpO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBQZXJmb3JtcyBhXG4gKiBbYFNhbWVWYWx1ZVplcm9gXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1zYW1ldmFsdWV6ZXJvKVxuICogY29tcGFyaXNvbiBiZXR3ZWVuIHR3byB2YWx1ZXMgdG8gZGV0ZXJtaW5lIGlmIHRoZXkgYXJlIGVxdWl2YWxlbnQuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSA0LjAuMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNvbXBhcmUuXG4gKiBAcGFyYW0geyp9IG90aGVyIFRoZSBvdGhlciB2YWx1ZSB0byBjb21wYXJlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZXMgYXJlIGVxdWl2YWxlbnQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogdmFyIG9iamVjdCA9IHsgJ2EnOiAxIH07XG4gKiB2YXIgb3RoZXIgPSB7ICdhJzogMSB9O1xuICpcbiAqIF8uZXEob2JqZWN0LCBvYmplY3QpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uZXEob2JqZWN0LCBvdGhlcik7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uZXEoJ2EnLCAnYScpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uZXEoJ2EnLCBPYmplY3QoJ2EnKSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uZXEoTmFOLCBOYU4pO1xuICogLy8gPT4gdHJ1ZVxuICovXG5mdW5jdGlvbiBlcSh2YWx1ZSwgb3RoZXIpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBvdGhlciB8fCAodmFsdWUgIT09IHZhbHVlICYmIG90aGVyICE9PSBvdGhlcik7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZS4gQSB2YWx1ZSBpcyBjb25zaWRlcmVkIGFycmF5LWxpa2UgaWYgaXQnc1xuICogbm90IGEgZnVuY3Rpb24gYW5kIGhhcyBhIGB2YWx1ZS5sZW5ndGhgIHRoYXQncyBhbiBpbnRlZ2VyIGdyZWF0ZXIgdGhhbiBvclxuICogZXF1YWwgdG8gYDBgIGFuZCBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gYE51bWJlci5NQVhfU0FGRV9JTlRFR0VSYC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDQuMC4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKGRvY3VtZW50LmJvZHkuY2hpbGRyZW4pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoJ2FiYycpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlMaWtlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPSBudWxsICYmIGlzTGVuZ3RoKGdldExlbmd0aCh2YWx1ZSkpICYmICFpc0Z1bmN0aW9uKHZhbHVlKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYEZ1bmN0aW9uYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSAwLjEuMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBmdW5jdGlvbiwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIFNhZmFyaSA4IHdoaWNoIHJldHVybnMgJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGFuZCB3ZWFrIG1hcCBjb25zdHJ1Y3RvcnMsXG4gIC8vIGFuZCBQaGFudG9tSlMgMS45IHdoaWNoIHJldHVybnMgJ2Z1bmN0aW9uJyBmb3IgYE5vZGVMaXN0YCBpbnN0YW5jZXMuXG4gIHZhciB0YWcgPSBpc09iamVjdCh2YWx1ZSkgPyBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA6ICcnO1xuICByZXR1cm4gdGFnID09IGZ1bmNUYWcgfHwgdGFnID09IGdlblRhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgbGVuZ3RoLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGxvb3NlbHkgYmFzZWQgb25cbiAqIFtgVG9MZW5ndGhgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSA0LjAuMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsXG4gKiAgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzTGVuZ3RoKDMpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNMZW5ndGgoTnVtYmVyLk1JTl9WQUxVRSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNMZW5ndGgoSW5maW5pdHkpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzTGVuZ3RoKCczJyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0xlbmd0aCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInICYmXG4gICAgdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8PSBNQVhfU0FGRV9JTlRFR0VSO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZVxuICogW2xhbmd1YWdlIHR5cGVdKGh0dHA6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1lY21hc2NyaXB0LWxhbmd1YWdlLXR5cGVzKVxuICogb2YgYE9iamVjdGAuIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgMC4xLjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChfLm5vb3ApO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZS4gQSB2YWx1ZSBpcyBvYmplY3QtbGlrZSBpZiBpdCdzIG5vdCBgbnVsbGBcbiAqIGFuZCBoYXMgYSBgdHlwZW9mYCByZXN1bHQgb2YgXCJvYmplY3RcIi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDQuMC4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZSwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZSh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBTeW1ib2xgIHByaW1pdGl2ZSBvciBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSA0LjAuMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBzeW1ib2wsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc1N5bWJvbChTeW1ib2wuaXRlcmF0b3IpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNTeW1ib2woJ2FiYycpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNTeW1ib2wodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnc3ltYm9sJyB8fFxuICAgIChpc09iamVjdExpa2UodmFsdWUpICYmIG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpID09IHN5bWJvbFRhZyk7XG59XG5cbi8qKlxuICogQ29udmVydHMgYHZhbHVlYCB0byBhIG51bWJlci5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDQuMC4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcHJvY2Vzcy5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG51bWJlci5cbiAqIEBleGFtcGxlXG4gKlxuICogXy50b051bWJlcigzLjIpO1xuICogLy8gPT4gMy4yXG4gKlxuICogXy50b051bWJlcihOdW1iZXIuTUlOX1ZBTFVFKTtcbiAqIC8vID0+IDVlLTMyNFxuICpcbiAqIF8udG9OdW1iZXIoSW5maW5pdHkpO1xuICogLy8gPT4gSW5maW5pdHlcbiAqXG4gKiBfLnRvTnVtYmVyKCczLjInKTtcbiAqIC8vID0+IDMuMlxuICovXG5mdW5jdGlvbiB0b051bWJlcih2YWx1ZSkge1xuICBpZiAodHlwZW9mIHZhbHVlID09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIGlmIChpc1N5bWJvbCh2YWx1ZSkpIHtcbiAgICByZXR1cm4gTkFOO1xuICB9XG4gIGlmIChpc09iamVjdCh2YWx1ZSkpIHtcbiAgICB2YXIgb3RoZXIgPSBpc0Z1bmN0aW9uKHZhbHVlLnZhbHVlT2YpID8gdmFsdWUudmFsdWVPZigpIDogdmFsdWU7XG4gICAgdmFsdWUgPSBpc09iamVjdChvdGhlcikgPyAob3RoZXIgKyAnJykgOiBvdGhlcjtcbiAgfVxuICBpZiAodHlwZW9mIHZhbHVlICE9ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSAwID8gdmFsdWUgOiArdmFsdWU7XG4gIH1cbiAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKHJlVHJpbSwgJycpO1xuICB2YXIgaXNCaW5hcnkgPSByZUlzQmluYXJ5LnRlc3QodmFsdWUpO1xuICByZXR1cm4gKGlzQmluYXJ5IHx8IHJlSXNPY3RhbC50ZXN0KHZhbHVlKSlcbiAgICA/IGZyZWVQYXJzZUludCh2YWx1ZS5zbGljZSgyKSwgaXNCaW5hcnkgPyAyIDogOClcbiAgICA6IChyZUlzQmFkSGV4LnRlc3QodmFsdWUpID8gTkFOIDogK3ZhbHVlKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIG51bWJlcnMgKHBvc2l0aXZlIGFuZC9vciBuZWdhdGl2ZSkgcHJvZ3Jlc3NpbmcgZnJvbVxuICogYHN0YXJ0YCB1cCB0bywgYnV0IG5vdCBpbmNsdWRpbmcsIGBlbmRgLiBBIHN0ZXAgb2YgYC0xYCBpcyB1c2VkIGlmIGEgbmVnYXRpdmVcbiAqIGBzdGFydGAgaXMgc3BlY2lmaWVkIHdpdGhvdXQgYW4gYGVuZGAgb3IgYHN0ZXBgLiBJZiBgZW5kYCBpcyBub3Qgc3BlY2lmaWVkLFxuICogaXQncyBzZXQgdG8gYHN0YXJ0YCB3aXRoIGBzdGFydGAgdGhlbiBzZXQgdG8gYDBgLlxuICpcbiAqICoqTm90ZToqKiBKYXZhU2NyaXB0IGZvbGxvd3MgdGhlIElFRUUtNzU0IHN0YW5kYXJkIGZvciByZXNvbHZpbmdcbiAqIGZsb2F0aW5nLXBvaW50IHZhbHVlcyB3aGljaCBjYW4gcHJvZHVjZSB1bmV4cGVjdGVkIHJlc3VsdHMuXG4gKlxuICogQHN0YXRpY1xuICogQHNpbmNlIDAuMS4wXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IFV0aWxcbiAqIEBwYXJhbSB7bnVtYmVyfSBbc3RhcnQ9MF0gVGhlIHN0YXJ0IG9mIHRoZSByYW5nZS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBlbmQgVGhlIGVuZCBvZiB0aGUgcmFuZ2UuXG4gKiBAcGFyYW0ge251bWJlcn0gW3N0ZXA9MV0gVGhlIHZhbHVlIHRvIGluY3JlbWVudCBvciBkZWNyZW1lbnQgYnkuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIHJhbmdlIG9mIG51bWJlcnMuXG4gKiBAc2VlIF8uaW5SYW5nZSwgXy5yYW5nZVJpZ2h0XG4gKiBAZXhhbXBsZVxuICpcbiAqIF8ucmFuZ2UoNCk7XG4gKiAvLyA9PiBbMCwgMSwgMiwgM11cbiAqXG4gKiBfLnJhbmdlKC00KTtcbiAqIC8vID0+IFswLCAtMSwgLTIsIC0zXVxuICpcbiAqIF8ucmFuZ2UoMSwgNSk7XG4gKiAvLyA9PiBbMSwgMiwgMywgNF1cbiAqXG4gKiBfLnJhbmdlKDAsIDIwLCA1KTtcbiAqIC8vID0+IFswLCA1LCAxMCwgMTVdXG4gKlxuICogXy5yYW5nZSgwLCAtNCwgLTEpO1xuICogLy8gPT4gWzAsIC0xLCAtMiwgLTNdXG4gKlxuICogXy5yYW5nZSgxLCA0LCAwKTtcbiAqIC8vID0+IFsxLCAxLCAxXVxuICpcbiAqIF8ucmFuZ2UoMCk7XG4gKiAvLyA9PiBbXVxuICovXG52YXIgcmFuZ2UgPSBjcmVhdGVSYW5nZSgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJhbmdlO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy42LjEgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqIFVzZWQgYXMgdGhlIGBUeXBlRXJyb3JgIG1lc3NhZ2UgZm9yIFwiRnVuY3Rpb25zXCIgbWV0aG9kcy4gKi9cbnZhciBGVU5DX0VSUk9SX1RFWFQgPSAnRXhwZWN0ZWQgYSBmdW5jdGlvbic7XG5cbi8qIE5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcyBmb3IgdGhvc2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGFzIG90aGVyIGBsb2Rhc2hgIG1ldGhvZHMuICovXG52YXIgbmF0aXZlTWF4ID0gTWF0aC5tYXg7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaW52b2tlcyBgZnVuY2Agd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlXG4gKiBjcmVhdGVkIGZ1bmN0aW9uIGFuZCBhcmd1bWVudHMgZnJvbSBgc3RhcnRgIGFuZCBiZXlvbmQgcHJvdmlkZWQgYXMgYW4gYXJyYXkuXG4gKlxuICogKipOb3RlOioqIFRoaXMgbWV0aG9kIGlzIGJhc2VkIG9uIHRoZSBbcmVzdCBwYXJhbWV0ZXJdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0Z1bmN0aW9ucy9yZXN0X3BhcmFtZXRlcnMpLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgRnVuY3Rpb25cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGFwcGx5IGEgcmVzdCBwYXJhbWV0ZXIgdG8uXG4gKiBAcGFyYW0ge251bWJlcn0gW3N0YXJ0PWZ1bmMubGVuZ3RoLTFdIFRoZSBzdGFydCBwb3NpdGlvbiBvZiB0aGUgcmVzdCBwYXJhbWV0ZXIuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBmdW5jdGlvbi5cbiAqIEBleGFtcGxlXG4gKlxuICogdmFyIHNheSA9IF8ucmVzdFBhcmFtKGZ1bmN0aW9uKHdoYXQsIG5hbWVzKSB7XG4gKiAgIHJldHVybiB3aGF0ICsgJyAnICsgXy5pbml0aWFsKG5hbWVzKS5qb2luKCcsICcpICtcbiAqICAgICAoXy5zaXplKG5hbWVzKSA+IDEgPyAnLCAmICcgOiAnJykgKyBfLmxhc3QobmFtZXMpO1xuICogfSk7XG4gKlxuICogc2F5KCdoZWxsbycsICdmcmVkJywgJ2Jhcm5leScsICdwZWJibGVzJyk7XG4gKiAvLyA9PiAnaGVsbG8gZnJlZCwgYmFybmV5LCAmIHBlYmJsZXMnXG4gKi9cbmZ1bmN0aW9uIHJlc3RQYXJhbShmdW5jLCBzdGFydCkge1xuICBpZiAodHlwZW9mIGZ1bmMgIT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoRlVOQ19FUlJPUl9URVhUKTtcbiAgfVxuICBzdGFydCA9IG5hdGl2ZU1heChzdGFydCA9PT0gdW5kZWZpbmVkID8gKGZ1bmMubGVuZ3RoIC0gMSkgOiAoK3N0YXJ0IHx8IDApLCAwKTtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxuICAgICAgICBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBuYXRpdmVNYXgoYXJncy5sZW5ndGggLSBzdGFydCwgMCksXG4gICAgICAgIHJlc3QgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHJlc3RbaW5kZXhdID0gYXJnc1tzdGFydCArIGluZGV4XTtcbiAgICB9XG4gICAgc3dpdGNoIChzdGFydCkge1xuICAgICAgY2FzZSAwOiByZXR1cm4gZnVuYy5jYWxsKHRoaXMsIHJlc3QpO1xuICAgICAgY2FzZSAxOiByZXR1cm4gZnVuYy5jYWxsKHRoaXMsIGFyZ3NbMF0sIHJlc3QpO1xuICAgICAgY2FzZSAyOiByZXR1cm4gZnVuYy5jYWxsKHRoaXMsIGFyZ3NbMF0sIGFyZ3NbMV0sIHJlc3QpO1xuICAgIH1cbiAgICB2YXIgb3RoZXJBcmdzID0gQXJyYXkoc3RhcnQgKyAxKTtcbiAgICBpbmRleCA9IC0xO1xuICAgIHdoaWxlICgrK2luZGV4IDwgc3RhcnQpIHtcbiAgICAgIG90aGVyQXJnc1tpbmRleF0gPSBhcmdzW2luZGV4XTtcbiAgICB9XG4gICAgb3RoZXJBcmdzW3N0YXJ0XSA9IHJlc3Q7XG4gICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgb3RoZXJBcmdzKTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZXN0UGFyYW07XG4iLCIvLyBQdWJsaWMgQVBJL25vZGUtbW9kdWxlIGZvciB0aGUgUHVzaFxuXG5jb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgndXRpbCcpLFxuICAgIEJ1dHRvbnMgPSByZXF1aXJlKCcuL3NyYy9idXR0b25zLmpzJyksXG4gICAgS25vYnMgPSByZXF1aXJlKCcuL3NyYy9rbm9icycpLFxuICAgIEdyaWQgPSByZXF1aXJlKCcuL3NyYy9ncmlkLmpzJyksXG4gICAgVG91Y2hzdHJpcCA9IHJlcXVpcmUoJy4vc3JjL3RvdWNoc3RyaXAuanMnKSxcbiAgICBDb250cm9sQnV0dG9ucyA9IHJlcXVpcmUoJy4vc3JjL2NvbnRyb2wtYnV0dG9ucy5qcycpLFxuICAgIExDRHMgPSByZXF1aXJlKCcuL3NyYy9sY2RzLmpzJyksXG4gICAgZm9yZWFjaCA9IHJlcXVpcmUoJ2xvZGFzaC5mb3JlYWNoJyksXG4gICAgcGFydGlhbCA9IHJlcXVpcmUoJ2xvZGFzaC5wYXJ0aWFsJyksXG4gICAgb25lX3RvX2VpZ2h0ID0gWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDhdO1xuXG5mdW5jdGlvbiBQdXNoKG1pZGlfb3V0X3BvcnQpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICAgIHZhciBtaWRpX291dCA9IHtcbiAgICAgICAgc2VuZF9jYzogZnVuY3Rpb24oY2MsIHZhbHVlKSB7IG1pZGlfb3V0X3BvcnQuc2VuZChbMTc2LCBjYywgdmFsdWVdKSB9LFxuICAgICAgICBzZW5kX25vdGU6IGZ1bmN0aW9uKG5vdGUsIHZlbG9jaXR5KSB7IG1pZGlfb3V0X3BvcnQuc2VuZChbMTQ0LCBub3RlLCB2ZWxvY2l0eV0pIH0sXG4gICAgICAgIHNlbmRfc3lzZXg6IGZ1bmN0aW9uKGRhdGEpIHsgbWlkaV9vdXRfcG9ydC5zZW5kKFsyNDAsIDcxLCAxMjcsIDIxXS5jb25jYXQoZGF0YSkuY29uY2F0KFsyNDddKSkgfVxuICAgIH1cblxuICAgIGNvbnN0IGJ1dHRvbnMgPSBuZXcgQnV0dG9ucyhtaWRpX291dC5zZW5kX2NjKTtcbiAgICB0aGlzLmtub2JzID0gbmV3IEtub2JzKCk7XG4gICAgdGhpcy5ncmlkID0gbmV3IEdyaWQobWlkaV9vdXQuc2VuZF9ub3RlLCBtaWRpX291dC5zZW5kX2NjLCBtaWRpX291dC5zZW5kX3N5c2V4KTtcbiAgICB0aGlzLnRvdWNoc3RyaXAgPSBuZXcgVG91Y2hzdHJpcCgpO1xuICAgIHRoaXMuY29udHJvbCA9IG5ldyBDb250cm9sQnV0dG9ucyhtaWRpX291dC5zZW5kX2NjKTtcbiAgICB0aGlzLmNjTWFwID0gW107XG4gICAgdGhpcy5ub3RlTWFwID0gW107XG5cbiAgICBmb3JlYWNoKFxuICAgICAgICBbdGhpcy5rbm9icywgdGhpcy50b3VjaHN0cmlwLCB0aGlzLmdyaWRdLFxuICAgICAgICAobW9kdWxlKSA9PiBmb3JlYWNoKG1vZHVsZS5oYW5kbGVkX25vdGVzLCAodmFsdWUsIGtleSkgPT4gdGhpcy5ub3RlTWFwW3ZhbHVlXSA9IG1vZHVsZSlcbiAgICApO1xuXG4gICAgZm9yZWFjaChcbiAgICAgICAgW3RoaXMua25vYnMsIHRoaXMuY29udHJvbCwgYnV0dG9ucywgdGhpcy5ncmlkXSxcbiAgICAgICAgKG1vZHVsZSkgPT4gZm9yZWFjaChtb2R1bGUuaGFuZGxlZF9jY3MsICh2YWx1ZSwga2V5KSA9PiB0aGlzLmNjTWFwW3ZhbHVlXSA9IG1vZHVsZSlcbiAgICApO1xuXG4gICAgLy8gRGVmaW5lcyBwdWJsaWMgQVBJIHJldHVybmVkXG4gICAgY29uc3QgYXBpID0ge1xuICAgICAgICBrbm9iOiB7XG4gICAgICAgICAgICB0ZW1wbzogdGhpcy5rbm9icy50ZW1wbyxcbiAgICAgICAgICAgIHN3aW5nOiB0aGlzLmtub2JzLnN3aW5nLFxuICAgICAgICAgICAgbWFzdGVyOiB0aGlzLmtub2JzLm1hc3RlcixcbiAgICAgICAgfSxcbiAgICAgICAgZ3JpZDogeyB4OiB7fX0sXG4gICAgICAgIHRvdWNoc3RyaXA6IHRoaXMudG91Y2hzdHJpcCxcbiAgICAgICAgbGNkOiBuZXcgTENEcyhtaWRpX291dC5zZW5kX3N5c2V4KSxcbiAgICAgICAgYnV0dG9uOiB7XG4gICAgICAgICAgICAnMS8zMnQnOiB0aGlzLmNvbnRyb2xbJzEvMzJ0J10sXG4gICAgICAgICAgICAnMS8zMic6IHRoaXMuY29udHJvbFsnMS8zMiddLFxuICAgICAgICAgICAgJzEvMTZ0JzogdGhpcy5jb250cm9sWycxLzE2dCddLFxuICAgICAgICAgICAgJzEvMTYnOiB0aGlzLmNvbnRyb2xbJzEvMTYnXSxcbiAgICAgICAgICAgICcxLzh0JzogdGhpcy5jb250cm9sWycxLzh0J10sXG4gICAgICAgICAgICAnMS84JzogdGhpcy5jb250cm9sWycxLzgnXSxcbiAgICAgICAgICAgICcxLzR0JzogdGhpcy5jb250cm9sWycxLzR0J10sXG4gICAgICAgICAgICAnMS80JzogdGhpcy5jb250cm9sWycxLzQnXSxcbiAgICAgICAgfSxcbiAgICAgICAgY2hhbm5lbDoge30sXG4gICAgICAgIHJlY2VpdmVfbWlkaTogcGFydGlhbChyZWNlaXZlX21pZGksIHRoaXMpLFxuICAgIH1cbiAgICBmb3JlYWNoKFxuICAgICAgICBvbmVfdG9fZWlnaHQsXG4gICAgICAgIChudW1iZXIpID0+IGFwaS5jaGFubmVsW251bWJlcl0gPSB7IGtub2I6IHRoaXMua25vYnNbbnVtYmVyXSwgc2VsZWN0OiB0aGlzLmNvbnRyb2xbbnVtYmVyXSB9XG4gICAgKTtcbiAgICBmb3JlYWNoKFxuICAgICAgICBvbmVfdG9fZWlnaHQsXG4gICAgICAgIChYKSA9PiB7XG4gICAgICAgICAgICBhcGkuZ3JpZC54W1hdID0geyB5OiB7fSwgc2VsZWN0OiB0aGlzLmdyaWQuc2VsZWN0W1hdLCB9O1xuICAgICAgICAgICAgZm9yZWFjaChvbmVfdG9fZWlnaHQsIChZKSA9PiB7XG4gICAgICAgICAgICAgICAgYXBpLmdyaWQueFtYXS55W1ldID0gdGhpcy5ncmlkLnhbWF0ueVtZXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgKTtcbiAgICBmb3JlYWNoKFxuICAgICAgICBidXR0b25zLm5hbWVzLFxuICAgICAgICAoYnV0dG9uX25hbWUpID0+IGFwaS5idXR0b25bYnV0dG9uX25hbWVdID0gYnV0dG9uc1tidXR0b25fbmFtZV1cbiAgICApXG4gICAgcmV0dXJuIGFwaTtcbn1cbnV0aWwuaW5oZXJpdHMoUHVzaCwgRXZlbnRFbWl0dGVyKTtcblxuZnVuY3Rpb24gaGFuZGxlX21pZGlfY2MocHVzaCwgaW5kZXgsIHZhbHVlKSB7XG4gICAgaWYgKGluZGV4IGluIHB1c2guY2NNYXApIHtcbiAgICAgICAgcHVzaC5jY01hcFtpbmRleF0ucmVjZWl2ZV9taWRpX2NjKGluZGV4LCB2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ05vIGtub3duIG1hcHBpbmcgZm9yIENDOiAnICsgaW5kZXgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlX21pZGlfbm90ZShwdXNoLCBub3RlLCB2ZWxvY2l0eSkge1xuICAgIGlmIChub3RlIGluIHB1c2gubm90ZU1hcCkge1xuICAgICAgICBwdXNoLm5vdGVNYXBbbm90ZV0ucmVjZWl2ZV9taWRpX25vdGUobm90ZSwgdmVsb2NpdHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdObyBrbm93biBtYXBwaW5nIGZvciBub3RlOiAnICsgbm90ZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVfbWlkaV9waXRjaF9iZW5kKHB1c2gsIGxzYl9ieXRlLCBtc2JfYnl0ZSkge1xuICAgIHB1c2gudG91Y2hzdHJpcC5yZWNlaXZlX21pZGlfcGl0Y2hfYmVuZCgobXNiX2J5dGUgPDwgNykgKyBsc2JfYnl0ZSk7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZV9taWRpX3BvbHlfcHJlc3N1cmUocHVzaCwgbm90ZSwgcHJlc3N1cmUpIHtcbiAgICBwdXNoLmdyaWQucmVjZWl2ZV9taWRpX3BvbHlfcHJlc3N1cmUobm90ZSwgcHJlc3N1cmUpO1xufVxuXG52YXIgbWlkaV9tZXNzYWdlcyA9IHtcbiAgICAnbm90ZS1vZmYnOiAxMjgsIC8vIG5vdGUgbnVtYmVyLCB2ZWxvY2l0eVxuICAgICdub3RlLW9uJzogMTQ0LCAvLyBub3RlIG51bWJlciwgdmVsb2NpdHlcbiAgICAncG9seS1wcmVzc3VyZSc6IDE2MCwgLy8gbm90ZSBudW1iZXIsIHZlbG9jaXR5XG4gICAgJ2NjJzogMTc2LCAvLyBjYyBudW1iZXIsIHZhbHVlXG4gICAgJ3Byb2dyYW0tY2hhbmdlJzogMTkyLCAvLyBwZ20gbnVtYmVyXG4gICAgJ2NoYW5uZWwtcHJlc3N1cmUnOiAyMDgsIC8vIHZlbG9jaXR5XG4gICAgJ3BpdGNoLWJlbmQnOiAyMjQsIC8vIGxzYiAoNy1iaXRzKSwgbXNiICg3LWJpdHMpXG4gICAgJ3N5c2V4JzogMjQwLCAvLyBpZCBbMSBvciAzIGJ5dGVzXSwgZGF0YSBbbiBieXRlc10sIDI0N1xufVxuXG4vLyBIYW5kbGVzIE1JREkgKENDKSBkYXRhIGZyb20gUHVzaCAtIGNhdXNlcyBldmVudHMgdG8gYmUgZW1pdHRlZFxuZnVuY3Rpb24gcmVjZWl2ZV9taWRpKHB1c2gsIGJ5dGVzKSB7XG4gICAgdmFyIG1lc3NhZ2VfdHlwZSA9IGJ5dGVzWzBdICYgMHhmMDtcbiAgICB2YXIgbWlkaV9jaGFubmVsID0gYnl0ZXNbMF0gJiAweDBmO1xuXG4gICAgc3dpdGNoIChtZXNzYWdlX3R5cGUpIHtcbiAgICAgICAgY2FzZSAobWlkaV9tZXNzYWdlc1snY2MnXSk6XG4gICAgICAgICAgICBoYW5kbGVfbWlkaV9jYyhwdXNoLCBieXRlc1sxXSwgYnl0ZXNbMl0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgKG1pZGlfbWVzc2FnZXNbJ25vdGUtb24nXSk6XG4gICAgICAgIGNhc2UgKG1pZGlfbWVzc2FnZXNbJ25vdGUtb2ZmJ10pOlxuICAgICAgICAgICAgaGFuZGxlX21pZGlfbm90ZShwdXNoLCBieXRlc1sxXSwgYnl0ZXNbMl0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgKG1pZGlfbWVzc2FnZXNbJ3BpdGNoLWJlbmQnXSk6XG4gICAgICAgICAgICBoYW5kbGVfbWlkaV9waXRjaF9iZW5kKHB1c2gsIGJ5dGVzWzFdLCBieXRlc1syXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZShtaWRpX21lc3NhZ2VzWydwb2x5LXByZXNzdXJlJ10pOlxuICAgICAgICAgICAgaGFuZGxlX21pZGlfcG9seV9wcmVzc3VyZShwdXNoLCBieXRlc1sxXSwgYnl0ZXNbMl0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxufVxuXG4vLyBBZGFwdG9yIGZ1bmN0aW9uIHVzZWQgdG8gYmluZCB0byB3ZWIgTUlESSBBUElcblB1c2guY3JlYXRlX2JvdW5kX3RvX3dlYl9taWRpX2FwaSA9IGZ1bmN0aW9uKG1pZGlBY2Nlc3MpIHtcbiAgICB2YXIgaW5wdXRzID0gbWlkaUFjY2Vzcy5pbnB1dHMudmFsdWVzKCksXG4gICAgICAgIG91dHB1dHMgPSBtaWRpQWNjZXNzLm91dHB1dHMudmFsdWVzKCksXG4gICAgICAgIHB1c2g7XG5cbiAgICBmb3IgKHZhciBvdXRwdXQgPSBvdXRwdXRzLm5leHQoKTsgb3V0cHV0ICYmICFvdXRwdXQuZG9uZTsgb3V0cHV0ID0gb3V0cHV0cy5uZXh0KCkpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ0ZvdW5kIG91dHB1dDogJyArIG91dHB1dC52YWx1ZS5uYW1lKTtcbiAgICAgICAgaWYgKCdBYmxldG9uIFB1c2ggVXNlciBQb3J0JyA9PSBvdXRwdXQudmFsdWUubmFtZSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0JpbmRpbmcgTUlESSBvdXRwdXQgdG8gJyArIG91dHB1dC52YWx1ZS5uYW1lKTtcbiAgICAgICAgICAgIHB1c2ggPSBuZXcgUHVzaChvdXRwdXQudmFsdWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocHVzaCA9PT0gdW5kZWZpbmVkKSBwdXNoID0gbmV3IFB1c2goeyBzZW5kOiAoYnl0ZXMpID0+IHsgJ25vIGltcGxlbWVudGF0aW9uIGJ5IGRlZmF1bHQnIH0gfSk7XG5cbiAgICBmb3IgKHZhciBpbnB1dCA9IGlucHV0cy5uZXh0KCk7IGlucHV0ICYmICFpbnB1dC5kb25lOyBpbnB1dCA9IGlucHV0cy5uZXh0KCkpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ0ZvdW5kIGlucHV0OiAnICsgaW5wdXQudmFsdWUubmFtZSk7XG4gICAgICAgIGlmICgnQWJsZXRvbiBQdXNoIFVzZXIgUG9ydCcgPT0gaW5wdXQudmFsdWUubmFtZSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0JpbmRpbmcgTUlESSBpbnB1dCB0byAnICsgaW5wdXQudmFsdWUubmFtZSk7XG4gICAgICAgICAgICBpbnB1dC52YWx1ZS5vbm1pZGltZXNzYWdlID0gKGV2ZW50KSA9PiB7IHB1c2gucmVjZWl2ZV9taWRpKGV2ZW50LmRhdGEpIH07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBwdXNoO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFB1c2g7XG4iLCJjb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgndXRpbCcpLFxuICAgIGZvcmVhY2ggPSByZXF1aXJlKCdsb2Rhc2guZm9yZWFjaCcpO1xuXG52YXIgY2NUb0J1dHRvbk1hcCA9IHtcbiAgICAzOiAndGFwX3RlbXBvJyxcbiAgICA5OiAnbWV0cm9ub21lJyxcbiAgICAxMTk6ICd1bmRvJyxcbiAgICAxMTg6ICdkZWxldGUnLFxuICAgIDExNzogJ2RvdWJsZScsXG4gICAgMTE2OiAncXVhbnRpemUnLFxuICAgIDkwOiAnZml4ZWRfbGVuZ3RoJyxcbiAgICA4OTogJ2F1dG9tYXRpb24nLFxuICAgIDg4OiAnZHVwbGljYXRlJyxcbiAgICA4NzogJ25ldycsXG4gICAgODY6ICdyZWMnLFxuICAgIDg1OiAncGxheScsXG4gICAgMjg6ICdtYXN0ZXInLFxuICAgIDI5OiAnc3RvcCcsXG4gICAgNDQ6ICdsZWZ0JyxcbiAgICA0NTogJ3JpZ2h0JyxcbiAgICA0NjogJ3VwJyxcbiAgICA0NzogJ2Rvd24nLFxuICAgIDExNDogJ3ZvbHVtZScsXG4gICAgMTE1OiAncGFuXyZfc2VuZCcsXG4gICAgMTEyOiAndHJhY2snLFxuICAgIDExMzogJ2NsaXAnLFxuICAgIDExMDogJ2RldmljZScsXG4gICAgMTExOiAnYnJvd3NlJyxcbiAgICA2MjogJ3N0ZXBfaW4nLFxuICAgIDYzOiAnc3RlcF9vdXQnLFxuICAgIDYwOiAnbXV0ZScsXG4gICAgNjE6ICdzb2xvJyxcbiAgICA1ODogJ3NjYWxlcycsXG4gICAgNTk6ICd1c2VyJyxcbiAgICA1NjogJ3JlcGVhdCcsXG4gICAgNTc6ICdhY2NlbnQnLFxuICAgIDU0OiAnb2N0YXZlX2Rvd24nLFxuICAgIDU1OiAnb2N0YXZlX3VwJyxcbiAgICA1MjogJ2FkZF9lZmZlY3QnLFxuICAgIDUzOiAnYWRkX3RyYWNrJyxcbiAgICA1MDogJ25vdGUnLFxuICAgIDUxOiAnc2Vzc2lvbicsXG4gICAgNDg6ICdzZWxlY3QnLFxuICAgIDQ5OiAnc2hpZnQnXG59XG5jb25zdCBoYW5kbGVkX2NjcyA9IE9iamVjdC5rZXlzKGNjVG9CdXR0b25NYXApO1xuXG5mdW5jdGlvbiBCdXR0b24oc2VuZF9jYywgY2MpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICByZXR1cm4ge1xuICAgICAgICBsZWRfb246IGZ1bmN0aW9uKCkgeyBzZW5kX2NjKGNjLCA0KSB9LFxuICAgICAgICBsZWRfZGltOiBmdW5jdGlvbigpIHsgc2VuZF9jYyhjYywgMSkgfSxcbiAgICAgICAgbGVkX29mZjogZnVuY3Rpb24oKSB7IHNlbmRfY2MoY2MsIDApIH0sXG4gICAgICAgIHJlZDogKCkgPT4ge30sXG4gICAgICAgIG9yYW5nZTogKCkgPT4ge30sXG4gICAgICAgIHllbGxvdzogKCkgPT4ge30sXG4gICAgICAgIGdyZWVuOiAoKSA9PiB7fSxcbiAgICAgICAgb246IHRoaXMub24sXG4gICAgICAgIGVtaXQ6IHRoaXMuZW1pdCxcbiAgICB9XG59XG51dGlsLmluaGVyaXRzKEJ1dHRvbiwgRXZlbnRFbWl0dGVyKTtcblxuZnVuY3Rpb24gQnV0dG9ucyhzZW5kX2NjKSB7XG4gICAgY29uc3QgYnV0dG9ucyA9IHRoaXM7XG4gICAgZm9yZWFjaChjY1RvQnV0dG9uTWFwLCAodmFsdWUsIGtleSkgPT4gdGhpc1t2YWx1ZV0gPSBuZXcgQnV0dG9uKHNlbmRfY2MsIHBhcnNlSW50KGtleSkpKTtcbiAgICB0aGlzLm5hbWVzID0gT2JqZWN0LmtleXMoY2NUb0J1dHRvbk1hcCkubWFwKChrZXkpID0+IHsgcmV0dXJuIGNjVG9CdXR0b25NYXBba2V5XSB9KTtcbiAgICB0aGlzLnJlY2VpdmVfbWlkaV9jYyA9IGZ1bmN0aW9uKGluZGV4LCB2YWx1ZSkge1xuICAgICAgICBidXR0b25zW2NjVG9CdXR0b25NYXBbaW5kZXhdXS5lbWl0KHByZXNzZWRfb3JfcmVsZWFzZWQodmFsdWUpKTtcbiAgICB9O1xuICAgIHRoaXMuaGFuZGxlZF9jY3MgPSBoYW5kbGVkX2Njcztcbn1cblxuZnVuY3Rpb24gcHJlc3NlZF9vcl9yZWxlYXNlZCh2ZWxvY2l0eSkge1xuICAgIHJldHVybiBwYXJzZUludCh2ZWxvY2l0eSkgPiAwID8gJ3ByZXNzZWQnIDogJ3JlbGVhc2VkJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBCdXR0b25zO1xuIiwiY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKSxcbiAgICBmb3JlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKTtcblxudmFyIGNjVG9QYWRNYXAgPSB7XG4gICAgMjA6IDEsIC8vIHRvcCByb3cgYWJvdmUgZ3JpZFxuICAgIDIxOiAyLFxuICAgIDIyOiAzLFxuICAgIDIzOiA0LFxuICAgIDI0OiA1LFxuICAgIDI1OiA2LFxuICAgIDI2OiA3LFxuICAgIDI3OiA4LFxuICAgIDQzOiAnMS8zMnQnLFxuICAgIDQyOiAnMS8zMicsXG4gICAgNDE6ICcxLzE2dCcsXG4gICAgNDA6ICcxLzE2JyxcbiAgICAzOTogJzEvOHQnLFxuICAgIDM4OiAnMS84JyxcbiAgICAzNzogJzEvNHQnLFxuICAgIDM2OiAnMS80Jyxcbn1cbmNvbnN0IGhhbmRsZWRfY2NzID0gT2JqZWN0LmtleXMoY2NUb1BhZE1hcCk7XG5cbmZ1bmN0aW9uIFBhZChzZW5kX2NjLCBjYykge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMub3V0cHV0ID0gZnVuY3Rpb24odmFsdWUpIHsgc2VuZF9jYyhjYywgdmFsdWUpIH07XG4gICAgdmFyIGNvbG91cnMgPSBbNywgMTBdOyAvLyBkaW0sIGJyaWdodFxuICAgIHRoaXMuY29sb3VycyA9IFs3LCAxMF07IC8vIGRpbSwgYnJpZ2h0XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbGVkX29uOiBmdW5jdGlvbigpIHsgc2VuZF9jYyhjYywgY29sb3Vyc1sxXSkgfSxcbiAgICAgICAgbGVkX2RpbTogZnVuY3Rpb24oKSB7IHNlbmRfY2MoY2MsIGNvbG91cnNbMF0pIH0sXG4gICAgICAgIGxlZF9vZmY6IGZ1bmN0aW9uKCkgeyBzZW5kX2NjKGNjLCAwKSB9LFxuICAgICAgICByZWQ6IGZ1bmN0aW9uKCkgeyBjb2xvdXJzID0gWzEsIDRdIH0sXG4gICAgICAgIG9yYW5nZTogZnVuY3Rpb24oKSB7IGNvbG91cnMgPSBbNywgMTBdIH0sXG4gICAgICAgIHllbGxvdzogZnVuY3Rpb24oKSB7IGNvbG91cnMgPSBbMTMsIDE2XSB9LFxuICAgICAgICBncmVlbjogZnVuY3Rpb24oKSB7IGNvbG91cnMgPSBbMTksIDIyXSB9LFxuICAgICAgICBvbjogdGhpcy5vbixcbiAgICAgICAgZW1pdDogdGhpcy5lbWl0LFxuICAgIH1cbn1cbnV0aWwuaW5oZXJpdHMoUGFkLCBFdmVudEVtaXR0ZXIpO1xuXG5mdW5jdGlvbiBDb250cm9sQnV0dG9ucyhzZW5kX2NjKSB7XG4gICAgY29uc3QgY29udHJvbF9idXR0b25zID0gdGhpcztcbiAgICBmb3JlYWNoKGNjVG9QYWRNYXAsICh2YWx1ZSwga2V5KSA9PiB0aGlzW3ZhbHVlXSA9IG5ldyBQYWQoc2VuZF9jYywgcGFyc2VJbnQoa2V5KSkpO1xuICAgIHRoaXMuaGFuZGxlZF9jY3MgPSBoYW5kbGVkX2NjcztcbiAgICB0aGlzLnJlY2VpdmVfbWlkaV9jYyA9IGZ1bmN0aW9uKGNjLCB2YWx1ZSkge1xuICAgICAgICB2YXIgcGFkX25hbWUgPSBjY1RvUGFkTWFwW2NjXTtcbiAgICAgICAgY29udHJvbF9idXR0b25zW3BhZF9uYW1lXS5lbWl0KHZhbHVlID4gMCA/ICdwcmVzc2VkJyA6ICdyZWxlYXNlZCcpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBDb250cm9sQnV0dG9ucztcbiIsImNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgZm9yZWFjaCA9IHJlcXVpcmUoJ2xvZGFzaC5mb3JlYWNoJyksXG4gICAgcGFydGlhbCA9IHJlcXVpcmUoJ2xvZGFzaC5wYXJ0aWFsJyk7XG5cbmNvbnN0IGNvbnRyb2xfYnV0dG9ucyA9IHtcbiAgICAxMDI6IDEsXG4gICAgMTAzOiAyLFxuICAgIDEwNDogMyxcbiAgICAxMDU6IDQsXG4gICAgMTA2OiA1LFxuICAgIDEwNzogNixcbiAgICAxMDg6IDcsXG4gICAgMTA5OiA4XG59O1xuY29uc3QgaGFuZGxlZF9jY3MgPSBPYmplY3Qua2V5cyhjb250cm9sX2J1dHRvbnMpO1xuXG52YXIgaGFuZGxlZF9ub3RlcyA9IFtdO1xuZm9yICh2YXIgaSA9IDM2OyBpIDw9IDk5OyBpKyspIGhhbmRsZWRfbm90ZXMucHVzaChpKTtcblxuZnVuY3Rpb24gR3JpZEJ1dHRvbihzZW5kX21pZGlfbWVzc2FnZSwgc2VuZF9zeXNleCwgbm90ZSkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMubm90ZV9vdXQgPSBmdW5jdGlvbih2ZWxvY2l0eSkgeyBzZW5kX21pZGlfbWVzc2FnZShub3RlLCB2ZWxvY2l0eSkgfTtcbiAgICB0aGlzLnN5c2V4X291dCA9IGZ1bmN0aW9uKGRhdGEpIHsgc2VuZF9zeXNleChkYXRhKSB9O1xuICAgIHRoaXMuaW5kZXggPSBub3RlIDwgMTAyID8gbm90ZSAtIDM2IDogbm90ZSAtIDM4O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbGVkX29uOiBwYXJ0aWFsKGxlZF9vbiwgdGhpcyksXG4gICAgICAgIGxlZF9vZmY6IHBhcnRpYWwobGVkX29mZiwgdGhpcyksXG4gICAgICAgIGxlZF9yZ2I6IHBhcnRpYWwobGVkX3JnYiwgdGhpcyksXG4gICAgICAgIG9uOiB0aGlzLm9uLFxuICAgICAgICBlbWl0OiB0aGlzLmVtaXQsXG4gICAgfVxufVxudXRpbC5pbmhlcml0cyhHcmlkQnV0dG9uLCBFdmVudEVtaXR0ZXIpO1xuXG5mdW5jdGlvbiBsZWRfb24oZ3JpZEJ1dHRvbiwgdmFsdWUpIHsgZ3JpZEJ1dHRvbi5ub3RlX291dCh2YWx1ZSA/IHZhbHVlIDogMTAwKSB9XG5mdW5jdGlvbiBsZWRfb2ZmKGdyaWRCdXR0b24pIHsgZ3JpZEJ1dHRvbi5ub3RlX291dCgwKSB9XG5mdW5jdGlvbiBsZWRfcmdiKGdyaWRCdXR0b24sIHIsIGcsIGIpIHtcbiAgICB2YXIgbXNiID0gW3IsIGcsIGJdLm1hcCgoeCkgPT4gKHggJiAyNDApID4+IDQpLFxuICAgICAgICBsc2IgPSBbciwgZywgYl0ubWFwKCh4KSA9PiB4ICYgMTUpO1xuICAgIGdyaWRCdXR0b24uc3lzZXhfb3V0KFs0LCAwLCA4LCBncmlkQnV0dG9uLmluZGV4LCAwLCBtc2JbMF0sIGxzYlswXSwgbXNiWzFdLCBsc2JbMV0sIG1zYlsyXSwgbHNiWzJdXSk7XG59XG5cbmZ1bmN0aW9uIEdyaWQoc2VuZF9ub3RlLCBzZW5kX2NjLCBzZW5kX3N5c2V4KSB7XG4gICAgdGhpcy54ID0ge307XG4gICAgdGhpcy5zZWxlY3QgPSB7fTtcbiAgICBmb3IgKHZhciB4ID0gMTsgeCA8PSA4OyB4KyspIHtcbiAgICAgICAgdGhpcy54W3hdID0geyB5OiB7fSB9XG4gICAgICAgIGZvciAodmFyIHkgPSAxOyB5IDw9IDg7IHkrKykge1xuICAgICAgICAgICAgdGhpcy54W3hdLnlbeV0gPSBuZXcgR3JpZEJ1dHRvbihzZW5kX25vdGUsIHNlbmRfc3lzZXgsICh4IC0gMSkgKyAoKHkgLSAxKSAqIDgpICsgMzYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yZWFjaChjb250cm9sX2J1dHRvbnMsICh2YWx1ZSwga2V5KSA9PiB0aGlzLnNlbGVjdFt2YWx1ZV0gPSBuZXcgR3JpZEJ1dHRvbihzZW5kX2NjLCBzZW5kX3N5c2V4LCBwYXJzZUludChrZXkpKSk7XG4gICAgdGhpcy5oYW5kbGVkX2NjcyA9IGhhbmRsZWRfY2NzO1xuICAgIHRoaXMuaGFuZGxlZF9ub3RlcyA9IGhhbmRsZWRfbm90ZXM7XG4gICAgdGhpcy5yZWNlaXZlX21pZGlfbm90ZSA9IHBhcnRpYWwocmVjZWl2ZV9taWRpX25vdGUsIHRoaXMpO1xuICAgIHRoaXMucmVjZWl2ZV9taWRpX2NjID0gcGFydGlhbChyZWNlaXZlX21pZGlfY2MsIHRoaXMpO1xuICAgIHRoaXMucmVjZWl2ZV9taWRpX3BvbHlfcHJlc3N1cmUgPSBwYXJ0aWFsKHJlY2VpdmVfbWlkaV9wb2x5X3ByZXNzdXJlLCB0aGlzKTtcbn1cblxuZnVuY3Rpb24gcmVjZWl2ZV9taWRpX25vdGUoZ3JpZCwgbm90ZSwgdmVsb2NpdHkpIHtcbiAgICB2YXIgYnV0dG9uID0gYnV0dG9uX2Zyb21fbm90ZShncmlkLCBub3RlKSxcbiAgICAgICAgdmVsID0gcGFyc2VJbnQodmVsb2NpdHkpO1xuICAgIHZlbCA+IDAgPyBidXR0b24uZW1pdCgncHJlc3NlZCcsIHZlbCkgOiBidXR0b24uZW1pdCgncmVsZWFzZWQnKTtcbn1cblxuZnVuY3Rpb24gcmVjZWl2ZV9taWRpX2NjKGdyaWQsIGluZGV4LCB2YWx1ZSkge1xuICAgIGdyaWQuc2VsZWN0W2NvbnRyb2xfYnV0dG9uc1tpbmRleF1dLmVtaXQodmFsdWUgPiAwID8gJ3ByZXNzZWQnIDogJ3JlbGVhc2VkJyk7XG59XG5cbmZ1bmN0aW9uIHJlY2VpdmVfbWlkaV9wb2x5X3ByZXNzdXJlKGdyaWQsIG5vdGUsIHByZXNzdXJlKSB7XG4gICAgYnV0dG9uX2Zyb21fbm90ZShncmlkLCBub3RlKS5lbWl0KCdhZnRlcnRvdWNoJywgcGFyc2VJbnQocHJlc3N1cmUpKTtcbn1cblxuZnVuY3Rpb24gYnV0dG9uX2Zyb21fbm90ZShncmlkLCBub3RlKSB7XG4gICAgdmFyIGluZGV4ZWRfZnJvbV96ZXJvID0gbm90ZSAtIDM2LFxuICAgICAgICB4ID0gKGluZGV4ZWRfZnJvbV96ZXJvICUgOCkgKyAxLFxuICAgICAgICB5ID0gcGFyc2VJbnQoaW5kZXhlZF9mcm9tX3plcm8gLyA4KSArIDE7XG4gICAgcmV0dXJuIGdyaWQueFt4XS55W3ldO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEdyaWQ7XG4iLCJjb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgndXRpbCcpLFxuICAgIGZvcmVhY2ggPSByZXF1aXJlKCdsb2Rhc2guZm9yZWFjaCcpLFxuICAgIHBhcnRpYWwgPSByZXF1aXJlKCdsb2Rhc2gucGFydGlhbCcpO1xuXG52YXIga25vYk1hcCA9IHtcbiAgICAndGVtcG8nOiB7ICdjYyc6IDE0LCAnbm90ZSc6IDEwIH0sXG4gICAgJ3N3aW5nJzogeyAnY2MnOiAxNSwgJ25vdGUnOiA5IH0sXG4gICAgMTogeyAnY2MnOiA3MSwgJ25vdGUnOiAwIH0sXG4gICAgMjogeyAnY2MnOiA3MiwgJ25vdGUnOiAxIH0sXG4gICAgMzogeyAnY2MnOiA3MywgJ25vdGUnOiAyIH0sXG4gICAgNDogeyAnY2MnOiA3NCwgJ25vdGUnOiAzIH0sXG4gICAgNTogeyAnY2MnOiA3NSwgJ25vdGUnOiA0IH0sXG4gICAgNjogeyAnY2MnOiA3NiwgJ25vdGUnOiA1IH0sXG4gICAgNzogeyAnY2MnOiA3NywgJ25vdGUnOiA2IH0sXG4gICAgODogeyAnY2MnOiA3OCwgJ25vdGUnOiA3IH0sXG4gICAgJ21hc3Rlcic6IHsgJ2NjJzogNzksICdub3RlJzogOCB9LFxufVxuXG52YXIgY2NUb0tub2JNYXAgPSB7fTtcbnZhciBub3RlVG9Lbm9iTWFwID0ge307XG5mb3JlYWNoKGtub2JNYXAsICh2YWx1ZSwga2V5KSA9PiB7XG4gICAgY2NUb0tub2JNYXBbdmFsdWUuY2NdID0ga2V5O1xuICAgIG5vdGVUb0tub2JNYXBbdmFsdWUubm90ZV0gPSBrZXk7XG59KTtcbmNvbnN0IGhhbmRsZWRfY2NzID0gT2JqZWN0LmtleXMoY2NUb0tub2JNYXApLFxuICAgIGhhbmRsZWRfbm90ZXMgPSBPYmplY3Qua2V5cyhub3RlVG9Lbm9iTWFwKTtcblxuZnVuY3Rpb24gS25vYigpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbn1cbnV0aWwuaW5oZXJpdHMoS25vYiwgRXZlbnRFbWl0dGVyKTtcblxuZnVuY3Rpb24gS25vYnMoKSB7XG4gICAgZm9yZWFjaChrbm9iTWFwLCAodmFsdWUsIGtleSkgPT4gdGhpc1trZXldID0gbmV3IEtub2IoKSk7XG4gICAgdGhpcy5oYW5kbGVkX2NjcyA9IGhhbmRsZWRfY2NzO1xuICAgIHRoaXMucmVjZWl2ZV9taWRpX2NjID0gcGFydGlhbChyZWNlaXZlX21pZGlfY2MsIHRoaXMpO1xuICAgIHRoaXMucmVjZWl2ZV9taWRpX25vdGUgPSBwYXJ0aWFsKHJlY2VpdmVfbWlkaV9ub3RlLCB0aGlzKTtcbiAgICB0aGlzLmhhbmRsZWRfbm90ZXMgPSBoYW5kbGVkX25vdGVzO1xufVxuXG5mdW5jdGlvbiByZWNlaXZlX21pZGlfY2Moa25vYnMsIGluZGV4LCB2YWx1ZSkge1xuICAgIHZhciBrbm9iX25hbWUgPSBjY1RvS25vYk1hcFtpbmRleF07XG4gICAgdmFyIGRlbHRhID0gdmFsdWUgPCA2NCA/IHZhbHVlIDogdmFsdWUgLSAxMjg7XG4gICAga25vYnNba25vYl9uYW1lXS5lbWl0KCd0dXJuZWQnLCBkZWx0YSk7XG59XG5cbmZ1bmN0aW9uIHJlY2VpdmVfbWlkaV9ub3RlKGtub2JzLCBub3RlLCB2ZWxvY2l0eSkge1xuICAgIHZhciBrbm9iX25hbWUgPSBub3RlVG9Lbm9iTWFwW25vdGVdO1xuICAgIHZhciBldmVudF9uYW1lID0gdmVsb2NpdHkgPiAwID8gJ3ByZXNzZWQnIDogJ3JlbGVhc2VkJztcbiAgICBrbm9ic1trbm9iX25hbWVdLmVtaXQoZXZlbnRfbmFtZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gS25vYnM7XG4iLCJjb25zdCBmb3JlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKSxcbiAgICByYW5nZSA9IHJlcXVpcmUoJ2xvZGFzaC5yYW5nZScpLFxuICAgIG9uZV90b19laWdodCA9IFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4XSxcbiAgICBvbmVfdG9fZm91ciA9IFsxLCAyLCAzLCA0XSxcbiAgICB6ZXJvX3RvX3NldmVuID0gWzAsIDEsIDIsIDMsIDQsIDUsIDYsIDddLFxuICAgIGJsYW5rID0gMzIsXG4gICAgYmxhbmtfbGluZSA9IHJhbmdlKGJsYW5rLCAxMDAsIDApLCAvLyA2OCBjaGFyYWN0ZXIgYXJyYXkgZmlsbGVkIHdpdGggJ2JsYW5rIGNoYXJhY3RlcidcbiAgICBvZmZzZXRzID0gWzAsIDksIDE3LCAyNiwgMzQsIDQzLCA1MSwgNjBdO1xuXG5mdW5jdGlvbiBMQ0RTZWdtZW50KHVwZGF0ZSkge1xuICAgIHRoaXMudXBkYXRlID0gZnVuY3Rpb24odGV4dCkge1xuICAgICAgICB1cGRhdGUobGNkX2RhdGEodGV4dCkpO1xuICAgIH07XG5cbiAgICB0aGlzLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHVwZGF0ZShsY2RfZGF0YSgnJykpO1xuICAgIH07XG59XG5cbmZ1bmN0aW9uIGxjZF9kYXRhKHRleHQpIHtcbiAgICBjb25zdCB0ZXh0X3N0cmluZyA9IFN0cmluZyh0ZXh0KTtcbiAgICByZXR1cm4gemVyb190b19zZXZlbi5tYXAoKGluZGV4KSA9PiB7XG4gICAgICAgIHJldHVybiB0ZXh0X3N0cmluZy5sZW5ndGggPiBpbmRleCA/IHRleHRfc3RyaW5nLmNoYXJDb2RlQXQoaW5kZXgpIDogYmxhbms7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIExDRHMoc2VuZF9zeXNleCkge1xuICAgIGNvbnN0IGxjZHMgPSB0aGlzO1xuXG4gICAgdGhpcy5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBmb3JlYWNoKFxuICAgICAgICAgICAgb25lX3RvX2VpZ2h0LFxuICAgICAgICAgICAgKHgpID0+IHtcbiAgICAgICAgICAgICAgICBsY2RzLnhbeF0gPSB7IHk6IHt9IH07XG4gICAgICAgICAgICAgICAgZm9yZWFjaChcbiAgICAgICAgICAgICAgICAgICAgb25lX3RvX2ZvdXIsXG4gICAgICAgICAgICAgICAgICAgICh5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsY2RzLnhbeF0ueVt5XSA9IG5ldyBMQ0RTZWdtZW50KChkaXNwbGF5X2RhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZW5kX3N5c2V4KFsyOCAtIHldLmNvbmNhdChbMCwgOSwgb2Zmc2V0c1t4IC0gMV1dKS5jb25jYXQoZGlzcGxheV9kYXRhKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIGZvcmVhY2gob25lX3RvX2ZvdXIsIChyb3cpID0+IHNlbmRfc3lzZXgoWzI4IC0gcm93XS5jb25jYXQoWzAsIDY5LCAwXSkuY29uY2F0KGJsYW5rX2xpbmUpKSk7XG4gICAgfTtcblxuICAgIHRoaXMueCA9IHt9O1xuXG4gICAgdGhpcy5jbGVhcigpO1xuXG4gICAgdGhpcy54WzhdLnlbNF0udXBkYXRlKCcgcG93ZXJlZCcpO1xuICAgIHRoaXMueFs4XS55WzNdLnVwZGF0ZSgnICAgICAgYnknKTtcbiAgICB0aGlzLnhbOF0ueVsyXS51cGRhdGUoJyAgIHB1c2gtJyk7XG4gICAgdGhpcy54WzhdLnlbMV0udXBkYXRlKCcgd3JhcHBlcicpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IExDRHM7XG4iLCJjb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgndXRpbCcpLFxuICAgIHBhcnRpYWwgPSByZXF1aXJlKCdsb2Rhc2gucGFydGlhbCcpLFxuICAgIGhhbmRsZWRfbm90ZXMgPSBbMTJdO1xuXG5mdW5jdGlvbiBUb3VjaFN0cmlwKCkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMucmVjZWl2ZV9taWRpX3BpdGNoX2JlbmQgPSBwYXJ0aWFsKHJlY2VpdmVfbWlkaV9waXRjaF9iZW5kLCB0aGlzKTtcbiAgICB0aGlzLnJlY2VpdmVfbWlkaV9ub3RlID0gcGFydGlhbChyZWNlaXZlX21pZGlfbm90ZSwgdGhpcyk7XG4gICAgdGhpcy5oYW5kbGVkX25vdGVzID0gaGFuZGxlZF9ub3Rlcztcbn1cbnV0aWwuaW5oZXJpdHMoVG91Y2hTdHJpcCwgRXZlbnRFbWl0dGVyKTtcblxuZnVuY3Rpb24gcmVjZWl2ZV9taWRpX3BpdGNoX2JlbmQodG91Y2hzdHJpcCwgZm91cnRlZW5fYml0X3ZhbHVlKSB7XG4gICAgaWYgKGZvdXJ0ZWVuX2JpdF92YWx1ZSA9PSA4MTkyKSByZXR1cm47XG4gICAgdG91Y2hzdHJpcC5lbWl0KCdwaXRjaGJlbmQnLCBmb3VydGVlbl9iaXRfdmFsdWUpO1xufVxuXG5mdW5jdGlvbiByZWNlaXZlX21pZGlfbm90ZSh0b3VjaHN0cmlwLCBub3RlLCB2ZWxvY2l0eSkge1xuICAgIGlmICh2ZWxvY2l0eSA+IDApIHtcbiAgICAgICAgdG91Y2hzdHJpcC5lbWl0KCdwcmVzc2VkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdG91Y2hzdHJpcC5lbWl0KCdyZWxlYXNlZCcpO1xuICAgICAgICB0b3VjaHN0cmlwLmVtaXQoJ3BpdGNoYmVuZCcsIDgxOTIpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBUb3VjaFN0cmlwO1xuIiwiJ3VzZSBzdHJpY3QnXG5cbmNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgdW5pdHlHYWluID0geyB0b0Fic29sdXRlOiBmdW5jdGlvbigpIHsgcmV0dXJuIDEgfSB9O1xuXG5mdW5jdGlvbiBTYW1wbGVQbGF5ZXIoYXNzZXRVcmwsIGF1ZGlvQ29udGV4dCwgb25Mb2FkKSB7XG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG4gICAgbGV0IHBsYXllciA9IHRoaXMsXG4gICAgICAgIF9sb2FkZWQgPSBmYWxzZSxcbiAgICAgICAgX2J1ZmZlcixcbiAgICAgICAgX3ZvaWNlcyA9IFtdLFxuICAgICAgICBfcGxheWJhY2tSYXRlID0gMSxcbiAgICAgICAgX2dhaW5Ob2RlID0gYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcblxuICAgIGxldCBzdG9wcGVkQWN0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIF92b2ljZXMuc2hpZnQoKTtcbiAgICAgICAgaWYgKCFwbGF5ZXIuaXNQbGF5aW5nKCkpIHBsYXllci5lbWl0KCdzdG9wcGVkJyk7XG4gICAgfVxuXG4gICAgdGhpcy5fYXNzZXRVcmwgPSBhc3NldFVybDtcblxuICAgIHRoaXMuY29ubmVjdCA9IF9nYWluTm9kZS5jb25uZWN0LmJpbmQoX2dhaW5Ob2RlKTtcblxuICAgIHRoaXMuZGlzY29ubmVjdCA9IF9nYWluTm9kZS5kaXNjb25uZWN0LmJpbmQoX2dhaW5Ob2RlKTtcblxuICAgIHRoaXMudG9NYXN0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcGxheWVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgcGxheWVyLmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgICAgcmV0dXJuIHBsYXllcjtcbiAgICB9XG5cbiAgICB0aGlzLmlzUGxheWluZyA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gX3ZvaWNlcy5sZW5ndGggPiAwOyB9XG5cbiAgICB0aGlzLnBsYXkgPSBmdW5jdGlvbihnYWluKSB7XG4gICAgICAgIGlmICghX2xvYWRlZCkgeyBjb25zb2xlLmxvZyhhc3NldFVybCArICcgbm90IGxvYWRlZCB5ZXQuLi4nKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgdmFyIG5vdyA9IHRpbWVOb3coYXVkaW9Db250ZXh0KSxcbiAgICAgICAgICAgIHN0YXJ0VGltZSA9IG5vdyxcbiAgICAgICAgICAgIF9nYWluID0gKGdhaW4gJiYgKHR5cGVvZiBnYWluLnRvQWJzb2x1dGUgPT09ICdmdW5jdGlvbicpKSA/IGdhaW4gOiB1bml0eUdhaW47XG5cbiAgICAgICAgaWYgKHBsYXllci5pc1BsYXlpbmcoKSkge1xuICAgICAgICAgICAgX2dhaW5Ob2RlLmdhaW4uY2FuY2VsU2NoZWR1bGVkVmFsdWVzKG5vdyk7XG4gICAgICAgICAgICBhbmNob3IoX2dhaW5Ob2RlLmdhaW4sIG5vdyk7XG4gICAgICAgICAgICBzdGFydFRpbWUgPSBub3cgKyAwLjAxO1xuICAgICAgICAgICAgX2dhaW5Ob2RlLmdhaW4ubGluZWFyUmFtcFRvVmFsdWVBdFRpbWUoMCwgc3RhcnRUaW1lKTtcbiAgICAgICAgICAgIHBsYXllci5lbWl0KCdzdG9wcGVkJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfZ2Fpbk5vZGUuZ2Fpbi5zZXRWYWx1ZUF0VGltZSgwLCBzdGFydFRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNvdXJjZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICAgICAgc291cmNlLmNvbm5lY3QoX2dhaW5Ob2RlKTtcblxuICAgICAgICBfZ2Fpbk5vZGUuZ2Fpbi5saW5lYXJSYW1wVG9WYWx1ZUF0VGltZShfZ2Fpbi50b0Fic29sdXRlKCksIHN0YXJ0VGltZSk7XG5cbiAgICAgICAgc291cmNlLnBsYXliYWNrUmF0ZS5zZXRWYWx1ZUF0VGltZShfcGxheWJhY2tSYXRlLCBzdGFydFRpbWUpO1xuICAgICAgICBzb3VyY2UuYnVmZmVyID0gX2J1ZmZlcjtcblxuICAgICAgICBzb3VyY2UuYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBzdG9wcGVkQWN0aW9uKTtcblxuICAgICAgICBfdm9pY2VzLnB1c2goc291cmNlKTtcbiAgICAgICAgc291cmNlLnN0YXJ0KHN0YXJ0VGltZSk7XG4gICAgICAgIHBsYXllci5lbWl0KCdzdGFydGVkJywgX2dhaW4pO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlUGxheWJhY2tSYXRlID0gZnVuY3Rpb24ocmF0ZSkge1xuICAgICAgICBfcGxheWJhY2tSYXRlID0gcmF0ZTtcbiAgICAgICAgdmFyIG5vdyA9IHRpbWVOb3coYXVkaW9Db250ZXh0KTtcbiAgICAgICAgX3ZvaWNlcy5mb3JFYWNoKChzb3VyY2UpID0+IHtcbiAgICAgICAgICAgIHNvdXJjZS5wbGF5YmFja1JhdGUuc2V0VmFsdWVBdFRpbWUoX3BsYXliYWNrUmF0ZSwgbm93KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgbG9hZFNhbXBsZShhc3NldFVybCwgYXVkaW9Db250ZXh0LCAoYnVmZmVyKSA9PiB7XG4gICAgICAgIF9idWZmZXIgPSBidWZmZXI7XG4gICAgICAgIF9sb2FkZWQgPSB0cnVlO1xuICAgICAgICBpZiAodHlwZW9mIG9uTG9hZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgb25Mb2FkKHBsYXllcik7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cbnV0aWwuaW5oZXJpdHMoU2FtcGxlUGxheWVyLCBFdmVudEVtaXR0ZXIpO1xuXG5mdW5jdGlvbiBsb2FkU2FtcGxlKGFzc2V0VXJsLCBhdWRpb0NvbnRleHQsIGRvbmUpIHtcbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcXVlc3Qub3BlbignR0VUJywgYXNzZXRVcmwsIHRydWUpO1xuICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcbiAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgYXVkaW9Db250ZXh0LmRlY29kZUF1ZGlvRGF0YShyZXF1ZXN0LnJlc3BvbnNlLCBkb25lKTtcbiAgICB9XG4gICAgcmVxdWVzdC5zZW5kKCk7XG59XG5cbmZ1bmN0aW9uIGFuY2hvcihhdWRpb1BhcmFtLCBub3cpIHtcbiAgICBhdWRpb1BhcmFtLnNldFZhbHVlQXRUaW1lKGF1ZGlvUGFyYW0udmFsdWUsIG5vdyk7XG59XG5cbmZ1bmN0aW9uIHRpbWVOb3coYXVkaW9Db250ZXh0KSB7XG4gICAgcmV0dXJuIGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTYW1wbGVQbGF5ZXI7XG4iLCIndXNlIHN0cmljdCdcblxuY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKSxcbiAgICBmb3JlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKTtcblxuZnVuY3Rpb24gQlBNKGluaXRpYWwpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICBsZXQgYnBtID0gdGhpcztcblxuICAgIHRoaXMuY3VycmVudCA9IGNsaXAoaW5pdGlhbCkgPyBjbGlwKGluaXRpYWwpIDogMTIwO1xuXG4gICAgdGhpcy5yZXBvcnQgPSBmdW5jdGlvbigpIHsgYnBtLmVtaXQoJ2NoYW5nZWQnLCBicG0pIH1cbiAgICB0aGlzLmNoYW5nZV9ieSA9IGZ1bmN0aW9uKGFtb3VudCkge1xuICAgICAgICBicG0uY3VycmVudCA9IGNsaXAoYnBtLmN1cnJlbnQgKyBhbW91bnQpO1xuICAgICAgICBicG0ucmVwb3J0KCk7XG4gICAgfVxufVxudXRpbC5pbmhlcml0cyhCUE0sIEV2ZW50RW1pdHRlcik7XG5cbmZ1bmN0aW9uIGNsaXAoYnBtKSB7XG4gICAgcmV0dXJuIGJwbSA8IDIwID8gMjAgOiAoYnBtID4gMzAwID8gMzAwIDogYnBtKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBCUE07IiwiJ3VzZSBzdHJpY3QnXG5cbmNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgZm9yZWFjaCA9IHJlcXVpcmUoJ2xvZGFzaC5mb3JlYWNoJyk7XG5cbmZ1bmN0aW9uIEludGVydmFsKGJwbSwgbXVsdGlwbGllciwgdmFsdWUpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICBsZXQgaW50ZXJ2YWwgPSB0aGlzO1xuXG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgIHRoaXMucmVwb3J0ID0gZnVuY3Rpb24oKSB7IGludGVydmFsLmVtaXQoJ2NoYW5nZWQnLCAoNjAgLyBicG0uY3VycmVudCkgKiBtdWx0aXBsaWVyICogMTAwMCk7IH07XG5cbiAgICBicG0ub24oJ2NoYW5nZWQnLCBpbnRlcnZhbC5yZXBvcnQpO1xufVxudXRpbC5pbmhlcml0cyhJbnRlcnZhbCwgRXZlbnRFbWl0dGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgJzRuJzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAxLCBuYW1lID8gbmFtZSA6ICc0bicpIH0sXG4gICAgJzRudCc6IGZ1bmN0aW9uKGJwbSwgbmFtZSkgeyByZXR1cm4gbmV3IEludGVydmFsKGJwbSwgMiAvIDMsIG5hbWUgPyBuYW1lIDogJzRudCcpIH0sXG4gICAgJzhuJzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAwLjUsIG5hbWUgPyBuYW1lIDogJzhuJykgfSxcbiAgICAnOG50JzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAxIC8gMywgbmFtZSA/IG5hbWUgOiAnOG50JykgfSxcbiAgICAnMTZuJzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAwLjI1LCBuYW1lID8gbmFtZSA6ICcxNm4nKSB9LFxuICAgICcxNm50JzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAxIC8gNiwgbmFtZSA/IG5hbWUgOiAnMTZudCcpIH0sXG4gICAgJzMybic6IGZ1bmN0aW9uKGJwbSwgbmFtZSkgeyByZXR1cm4gbmV3IEludGVydmFsKGJwbSwgMC4xMjUsIG5hbWUgPyBuYW1lIDogJzMybicpIH0sXG4gICAgJzMybnQnOiBmdW5jdGlvbihicG0sIG5hbWUpIHsgcmV0dXJuIG5ldyBJbnRlcnZhbChicG0sIDEgLyAxMiwgbmFtZSA/IG5hbWUgOiAnMzJudCcpIH0sXG59OyIsIid1c2Ugc3RyaWN0J1xuY29uc3QgU2FtcGxlUGxheWVyID0gcmVxdWlyZSgnd2FjLnNhbXBsZS1wbGF5ZXInKTtcbi8qKlxuICogQSB3YWMuc2FtcGxlLXBsYXllciB3cmFwcGVyIHRoYXQgYWRkcyBhbiBMUCBmaWx0ZXIgYW5kIHZhcmlhYmxlIHBpdGNoXG4gKi9cbmZ1bmN0aW9uIFBsYXllcihhc3NldFVybCwgYXVkaW9Db250ZXh0LCBvbkxvYWQpIHtcbiAgICBsZXQgc2FtcGxlUGxheWVyID0gbmV3IFNhbXBsZVBsYXllcihhc3NldFVybCwgYXVkaW9Db250ZXh0LCBvbkxvYWQpLFxuICAgICAgICBmaWx0ZXJOb2RlID0gYXVkaW9Db250ZXh0LmNyZWF0ZUJpcXVhZEZpbHRlcigpLFxuICAgICAgICBwaXRjaCA9IDAsXG4gICAgICAgIHBpdGNoTW9kID0gMCxcbiAgICAgICAgcGxheWVyID0gdGhpcztcblxuICAgIGZpbHRlck5vZGUuZnJlcXVlbmN5LnZhbHVlID0gMjAwMDA7XG4gICAgc2FtcGxlUGxheWVyLmNvbm5lY3QoZmlsdGVyTm9kZSk7XG5cbiAgICBsZXQgdXBkYXRlUGl0Y2ggPSBmdW5jdGlvbigpIHsgc2FtcGxlUGxheWVyLnVwZGF0ZVBsYXliYWNrUmF0ZShpbnRlcnZhbFRvUGxheWJhY2tSYXRlKHBpdGNoICsgcGl0Y2hNb2QpKTsgfVxuXG4gICAgdGhpcy5fYXNzZXRVcmwgPSBhc3NldFVybDtcbiAgICB0aGlzLnBsYXkgPSBzYW1wbGVQbGF5ZXIucGxheS5iaW5kKHNhbXBsZVBsYXllcik7XG5cbiAgICB0aGlzLmNvbm5lY3QgPSBmaWx0ZXJOb2RlLmNvbm5lY3QuYmluZChmaWx0ZXJOb2RlKTtcblxuICAgIHRoaXMuZGlzY29ubmVjdCA9IGZpbHRlck5vZGUuZGlzY29ubmVjdC5iaW5kKGZpbHRlck5vZGUpO1xuXG4gICAgdGhpcy50b01hc3RlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBmaWx0ZXJOb2RlLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgZmlsdGVyTm9kZS5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICAgIHJldHVybiBwbGF5ZXI7XG4gICAgfVxuXG4gICAgdGhpcy5pc1BsYXlpbmcgPSBzYW1wbGVQbGF5ZXIuaXNQbGF5aW5nLmJpbmQoc2FtcGxlUGxheWVyKTtcblxuICAgIHRoaXMuY2hhbmdlUGl0Y2hCeUludGVydmFsID0gZnVuY3Rpb24oaW50ZXJ2YWwpIHtcbiAgICAgICAgcGl0Y2ggPSBjbGlwKHBpdGNoICsgaW50ZXJ2YWwsIC0yNCwgMjQpO1xuICAgICAgICBwbGF5ZXIucmVwb3J0UGl0Y2goKTtcbiAgICAgICAgdXBkYXRlUGl0Y2goKTtcbiAgICB9XG5cbiAgICB0aGlzLm1vZHVsYXRlUGl0Y2ggPSBmdW5jdGlvbihpbnRlcnZhbCkge1xuICAgICAgICBwaXRjaE1vZCA9IGNsaXAoaW50ZXJ2YWwsIC0yNCwgMjQpO1xuICAgICAgICB1cGRhdGVQaXRjaCgpO1xuICAgIH1cblxuICAgIHRoaXMuY3V0T2ZmID0gZnVuY3Rpb24oZikge1xuICAgICAgICBmaWx0ZXJOb2RlLmZyZXF1ZW5jeS52YWx1ZSA9IGNsaXAoZiwgMzAsIDIwMDAwKTtcbiAgICAgICAgcmV0dXJuIHBsYXllcjtcbiAgICB9XG5cbiAgICB0aGlzLnJlcG9ydFBpdGNoID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHNhbXBsZVBsYXllci5lbWl0KCdwaXRjaCcsICgocGl0Y2ggPj0gMCkgPyAnKycgOiAnJykgKyAocGl0Y2gpICsgJyBzdCcpO1xuICAgIH1cblxuICAgIHRoaXMub24gPSBzYW1wbGVQbGF5ZXIub24uYmluZChzYW1wbGVQbGF5ZXIpO1xufVxuXG5mdW5jdGlvbiBjbGlwKHZhbHVlLCBtaW4sIG1heCkge1xuICAgIGlmICh2YWx1ZSA8IG1pbikgcmV0dXJuIG1pbjtcbiAgICByZXR1cm4gdmFsdWUgPiBtYXggPyBtYXggOiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gaW50ZXJ2YWxUb1BsYXliYWNrUmF0ZShtaWRpTm90ZU51bWJlcikge1xuICAgIHJldHVybiBNYXRoLmV4cCguMDU3NzYyMjY1ICogKG1pZGlOb3RlTnVtYmVyKSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUGxheWVyOyIsIid1c2Ugc3RyaWN0J1xuXG5jb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xuLypcblJlcGVhdGVkbHkgY2FsbHMgdGhlIHBhc3NlZCBjYWxsYmFjayBhdCB0aGUgc3BlY2lmaWVkIGludGVydmFsIHVudGlsIHRvbGQgdG8gc3RvcFxuKi9cbmZ1bmN0aW9uIFJlcGVhdGVyKHNldFRpbWVvdXQsIGluaXRpYWxfaW50ZXJ2YWwpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICB2YXIgcmVwZWF0ZXIgPSB0aGlzO1xuICAgIHRoaXMuX2lzX3NjaGVkdWxpbmcgPSBmYWxzZTtcbiAgICB0aGlzLl9pbnRlcnZhbCA9IGluaXRpYWxfaW50ZXJ2YWwgPiAyMCA/IGluaXRpYWxfaW50ZXJ2YWwgOiA1MDA7IC8vIG1zXG5cbiAgICB0aGlzLmludGVydmFsID0gZnVuY3Rpb24gKGFtb3VudF9tcykge1xuICAgICAgICByZXBlYXRlci5faW50ZXJ2YWwgPSBhbW91bnRfbXMgPiAyMCA/IGFtb3VudF9tcyA6IDIwOyAvLyAyMG1zIG1pbiBpbnRlcnZhbFxuICAgICAgICByZXBlYXRlci5yZXBvcnRfaW50ZXJ2YWwoKTtcbiAgICB9XG5cbiAgICB0aGlzLnN0YXJ0ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHJlcGVhdGVyLl9pc19zY2hlZHVsaW5nKSByZXR1cm47XG4gICAgICAgIHJlcGVhdGVyLl9pc19zY2hlZHVsaW5nID0gdHJ1ZTtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5fcmVjdXJzaXZlU2V0VGltZW91dChjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVjdXJzaXZlU2V0VGltZW91dCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHJlcGVhdGVyLl9pc19zY2hlZHVsaW5nKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWN1cnNpdmVTZXRUaW1lb3V0KGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVwZWF0ZXIuX2ludGVydmFsKVxuICAgIH1cblxuICAgIHRoaXMuX2NhbGxfYW5kX3Jlc2NoZWR1bGUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICBpZiAocmVwZWF0ZXIuX2lzX3NjaGVkdWxpbmcpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICBzY2hlZHVsZWRfZXhlY3V0aW9uKCgpID0+IHJlcGVhdGVyLl9jYWxsX2FuZF9yZXNjaGVkdWxlKGNhbGxiYWNrKSwgcmVwZWF0ZXIuX2ludGVydmFsKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVwZWF0ZXIuX2lzX3NjaGVkdWxpbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICB0aGlzLnJlcG9ydF9pbnRlcnZhbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXBlYXRlci5lbWl0KCdpbnRlcnZhbCcsIHJlcGVhdGVyLl9pbnRlcnZhbCk7XG4gICAgfVxufVxudXRpbC5pbmhlcml0cyhSZXBlYXRlciwgRXZlbnRFbWl0dGVyKTtcblxuZnVuY3Rpb24gQXVkaW9TZXRUaW1lb3V0KGNvbnRleHQpIHtcbiAgICB0aGlzLnNldFRpbWVvdXQgPSBmdW5jdGlvbihjYWxsYmFjaywgdGltZV9tcykge1xuICAgICAgICBsZXQgc291cmNlID0gY29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKSxcbiAgICAgICAgICAgIG5vdyA9IGNvbnRleHQuY3VycmVudFRpbWUsXG4gICAgICAgICAgICB0aG91c2FuZHRoID0gY29udGV4dC5zYW1wbGVSYXRlIC8gMTAwMCxcbiAgICAgICAgICAgIHNjaGVkdWxlZF9hdCA9IG5vdyArICh0aW1lX21zIC8gMTAwMCkgLSAwLjAwMTtcbiAgICAgICAgLy8gYSBidWZmZXIgbGVuZ3RoIG9mIDEgc2FtcGxlIGRvZXNuJ3Qgd29yayBvbiBJT1MsIHNvIHVzZSAxLzEwMDB0aCBvZiBhIHNlY29uZFxuICAgICAgICBsZXQgYnVmZmVyID0gY29udGV4dC5jcmVhdGVCdWZmZXIoMSwgdGhvdXNhbmR0aCwgY29udGV4dC5zYW1wbGVSYXRlKTtcbiAgICAgICAgc291cmNlLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgY2FsbGJhY2spO1xuICAgICAgICBzb3VyY2UuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgICBzb3VyY2UuY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgICAgc291cmNlLnN0YXJ0KHNjaGVkdWxlZF9hdCk7XG4gICAgfVxufVxuXG4vLyBBZGFwdG9yIGZ1bmN0aW9uIHVzZWQgdG8gYmluZCB0byB3ZWIgQXVkaW8gQVBJIGFuZCB1dGlsaXNlIGl0cyBhdWRpby1yYXRlIHNjaGVkdWxpbmdcblJlcGVhdGVyLmNyZWF0ZV9zY2hlZHVsZWRfYnlfYXVkaW9fY29udGV4dCA9IGZ1bmN0aW9uKGNvbnRleHQsIGluaXRpYWxfaW50ZXJ2YWwpIHtcbiAgICByZXR1cm4gbmV3IFJlcGVhdGVyKG5ldyBBdWRpb1NldFRpbWVvdXQoY29udGV4dCkuc2V0VGltZW91dCwgaW5pdGlhbF9pbnRlcnZhbCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVwZWF0ZXI7IiwiJ3VzZSBzdHJpY3QnXG5cbmNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgUmVwZWF0ZXIgPSByZXF1aXJlKCcuL3JlcGVhdGVyLmpzJyk7XG5cbmZ1bmN0aW9uIFJlcGV0YWUocmVwZWF0ZXIsIGluaXRpYWxfaW50ZXJ2YWwpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICB2YXIgcmVwZXRhZSA9IHRoaXM7XG4gICAgdGhpcy5fYWN0aXZlID0gZmFsc2U7XG4gICAgdGhpcy5fdGltZV9jaGFuZ2VkID0gZmFsc2U7XG4gICAgdGhpcy5fYmVpbmdfcHJlc3NlZCA9IGZhbHNlO1xuICAgIHRoaXMuX2N1cnJlbnRfaW50ZXJ2YWwgPSBpbml0aWFsX2ludGVydmFsO1xuXG4gICAgcmVwZXRhZS5fY3VycmVudF9pbnRlcnZhbC5vbignY2hhbmdlZCcsIHJlcGVhdGVyLmludGVydmFsKTtcbiAgICByZXBldGFlLl9jdXJyZW50X2ludGVydmFsLnJlcG9ydCgpO1xuXG4gICAgdGhpcy5wcmVzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXBldGFlLl9iZWluZ19wcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLnJlbGVhc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXJ0ZWRfYWN0aXZlID0gcmVwZXRhZS5fYWN0aXZlLFxuICAgICAgICAgICAgdGltZV9jaGFuZ2VkID0gcmVwZXRhZS5fdGltZV9jaGFuZ2VkO1xuXG4gICAgICAgIHJlcGV0YWUuX3RpbWVfY2hhbmdlZCA9IGZhbHNlO1xuICAgICAgICByZXBldGFlLl9iZWluZ19wcmVzc2VkID0gZmFsc2U7XG5cbiAgICAgICAgc3dpdGNoICh0cnVlKSB7XG4gICAgICAgICAgICBjYXNlICghc3RhcnRlZF9hY3RpdmUpOlxuICAgICAgICAgICAgICAgIHJlcGV0YWUuX2FjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmVwZXRhZS5lbWl0KCdvbicpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAoc3RhcnRlZF9hY3RpdmUgJiYgIXRpbWVfY2hhbmdlZCk6XG4gICAgICAgICAgICAgICAgcmVwZXRhZS5fYWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcmVwZXRhZS5lbWl0KCdvZmYnKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuaW50ZXJ2YWwgPSBmdW5jdGlvbihuZXdfaW50ZXJ2YWwpIHtcbiAgICAgICAgaWYgKHJlcGV0YWUuX2JlaW5nX3ByZXNzZWQpIHtcbiAgICAgICAgICAgIHJlcGV0YWUuX3RpbWVfY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICByZXBldGFlLl9jdXJyZW50X2ludGVydmFsLnJlbW92ZUxpc3RlbmVyKCdjaGFuZ2VkJywgcmVwZWF0ZXIuaW50ZXJ2YWwpO1xuICAgICAgICAgICAgcmVwZXRhZS5fY3VycmVudF9pbnRlcnZhbCA9IG5ld19pbnRlcnZhbDtcbiAgICAgICAgICAgIHJlcGV0YWUuX2N1cnJlbnRfaW50ZXJ2YWwub24oJ2NoYW5nZWQnLCByZXBlYXRlci5pbnRlcnZhbCk7XG4gICAgICAgICAgICByZXBldGFlLnJlcG9ydF9pbnRlcnZhbCgpO1xuICAgICAgICAgICAgcmVwZXRhZS5fY3VycmVudF9pbnRlcnZhbC5yZXBvcnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc3RhcnQgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXJlcGV0YWUuX2FjdGl2ZSkge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICByZXBlYXRlci5zdGFydChjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wID0gcmVwZWF0ZXIuc3RvcDtcbiAgICB0aGlzLnJlcG9ydF9pbnRlcnZhbCA9IGZ1bmN0aW9uKCkgeyByZXBldGFlLmVtaXQoJ2ludGVydmFsJywgcmVwZXRhZS5fY3VycmVudF9pbnRlcnZhbC52YWx1ZSkgIH07XG59XG51dGlsLmluaGVyaXRzKFJlcGV0YWUsIEV2ZW50RW1pdHRlcik7XG5cbm1vZHVsZS5leHBvcnRzID0gUmVwZXRhZTsiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQXQgbGVhc3QgZ2l2ZSBzb21lIGtpbmQgb2YgY29udGV4dCB0byB0aGUgdXNlclxuICAgICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LiAoJyArIGVyICsgJyknKTtcbiAgICAgICAgZXJyLmNvbnRleHQgPSBlcjtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgLy8gaW1wbGVtZW50YXRpb24gZnJvbSBzdGFuZGFyZCBub2RlLmpzICd1dGlsJyBtb2R1bGVcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn0gZWxzZSB7XG4gIC8vIG9sZCBzY2hvb2wgc2hpbSBmb3Igb2xkIGJyb3dzZXJzXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICB2YXIgVGVtcEN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICAgIFRlbXBDdG9yLnByb3RvdHlwZSA9IHN1cGVyQ3Rvci5wcm90b3R5cGVcbiAgICBjdG9yLnByb3RvdHlwZSA9IG5ldyBUZW1wQ3RvcigpXG4gICAgY3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjdG9yXG4gIH1cbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbihmdW5jdGlvbiAoKSB7XG4gIHRyeSB7XG4gICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGlzIG5vdCBkZWZpbmVkJyk7XG4gICAgfVxuICB9XG4gIHRyeSB7XG4gICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICB9IGNhdGNoIChlKSB7XG4gICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaXMgbm90IGRlZmluZWQnKTtcbiAgICB9XG4gIH1cbn0gKCkpXG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBjYWNoZWRTZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjYWNoZWRDbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc0J1ZmZlcihhcmcpIHtcbiAgcmV0dXJuIGFyZyAmJiB0eXBlb2YgYXJnID09PSAnb2JqZWN0J1xuICAgICYmIHR5cGVvZiBhcmcuY29weSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcuZmlsbCA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcucmVhZFVJbnQ4ID09PSAnZnVuY3Rpb24nO1xufSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG52YXIgZm9ybWF0UmVnRXhwID0gLyVbc2RqJV0vZztcbmV4cG9ydHMuZm9ybWF0ID0gZnVuY3Rpb24oZikge1xuICBpZiAoIWlzU3RyaW5nKGYpKSB7XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgb2JqZWN0cy5wdXNoKGluc3BlY3QoYXJndW1lbnRzW2ldKSk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3RzLmpvaW4oJyAnKTtcbiAgfVxuXG4gIHZhciBpID0gMTtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciBsZW4gPSBhcmdzLmxlbmd0aDtcbiAgdmFyIHN0ciA9IFN0cmluZyhmKS5yZXBsYWNlKGZvcm1hdFJlZ0V4cCwgZnVuY3Rpb24oeCkge1xuICAgIGlmICh4ID09PSAnJSUnKSByZXR1cm4gJyUnO1xuICAgIGlmIChpID49IGxlbikgcmV0dXJuIHg7XG4gICAgc3dpdGNoICh4KSB7XG4gICAgICBjYXNlICclcyc6IHJldHVybiBTdHJpbmcoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVkJzogcmV0dXJuIE51bWJlcihhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWonOlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShhcmdzW2krK10pO1xuICAgICAgICB9IGNhdGNoIChfKSB7XG4gICAgICAgICAgcmV0dXJuICdbQ2lyY3VsYXJdJztcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgfVxuICB9KTtcbiAgZm9yICh2YXIgeCA9IGFyZ3NbaV07IGkgPCBsZW47IHggPSBhcmdzWysraV0pIHtcbiAgICBpZiAoaXNOdWxsKHgpIHx8ICFpc09iamVjdCh4KSkge1xuICAgICAgc3RyICs9ICcgJyArIHg7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSAnICcgKyBpbnNwZWN0KHgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc3RyO1xufTtcblxuXG4vLyBNYXJrIHRoYXQgYSBtZXRob2Qgc2hvdWxkIG5vdCBiZSB1c2VkLlxuLy8gUmV0dXJucyBhIG1vZGlmaWVkIGZ1bmN0aW9uIHdoaWNoIHdhcm5zIG9uY2UgYnkgZGVmYXVsdC5cbi8vIElmIC0tbm8tZGVwcmVjYXRpb24gaXMgc2V0LCB0aGVuIGl0IGlzIGEgbm8tb3AuXG5leHBvcnRzLmRlcHJlY2F0ZSA9IGZ1bmN0aW9uKGZuLCBtc2cpIHtcbiAgLy8gQWxsb3cgZm9yIGRlcHJlY2F0aW5nIHRoaW5ncyBpbiB0aGUgcHJvY2VzcyBvZiBzdGFydGluZyB1cC5cbiAgaWYgKGlzVW5kZWZpbmVkKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBleHBvcnRzLmRlcHJlY2F0ZShmbiwgbXNnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cblxuICBpZiAocHJvY2Vzcy5ub0RlcHJlY2F0aW9uID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgdmFyIHdhcm5lZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBkZXByZWNhdGVkKCkge1xuICAgIGlmICghd2FybmVkKSB7XG4gICAgICBpZiAocHJvY2Vzcy50aHJvd0RlcHJlY2F0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLnRyYWNlRGVwcmVjYXRpb24pIHtcbiAgICAgICAgY29uc29sZS50cmFjZShtc2cpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihtc2cpO1xuICAgICAgfVxuICAgICAgd2FybmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gZGVwcmVjYXRlZDtcbn07XG5cblxudmFyIGRlYnVncyA9IHt9O1xudmFyIGRlYnVnRW52aXJvbjtcbmV4cG9ydHMuZGVidWdsb2cgPSBmdW5jdGlvbihzZXQpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKGRlYnVnRW52aXJvbikpXG4gICAgZGVidWdFbnZpcm9uID0gcHJvY2Vzcy5lbnYuTk9ERV9ERUJVRyB8fCAnJztcbiAgc2V0ID0gc2V0LnRvVXBwZXJDYXNlKCk7XG4gIGlmICghZGVidWdzW3NldF0pIHtcbiAgICBpZiAobmV3IFJlZ0V4cCgnXFxcXGInICsgc2V0ICsgJ1xcXFxiJywgJ2knKS50ZXN0KGRlYnVnRW52aXJvbikpIHtcbiAgICAgIHZhciBwaWQgPSBwcm9jZXNzLnBpZDtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBtc2cgPSBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCclcyAlZDogJXMnLCBzZXQsIHBpZCwgbXNnKTtcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7fTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlYnVnc1tzZXRdO1xufTtcblxuXG4vKipcbiAqIEVjaG9zIHRoZSB2YWx1ZSBvZiBhIHZhbHVlLiBUcnlzIHRvIHByaW50IHRoZSB2YWx1ZSBvdXRcbiAqIGluIHRoZSBiZXN0IHdheSBwb3NzaWJsZSBnaXZlbiB0aGUgZGlmZmVyZW50IHR5cGVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIG9iamVjdCB0byBwcmludCBvdXQuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0cyBPcHRpb25hbCBvcHRpb25zIG9iamVjdCB0aGF0IGFsdGVycyB0aGUgb3V0cHV0LlxuICovXG4vKiBsZWdhY3k6IG9iaiwgc2hvd0hpZGRlbiwgZGVwdGgsIGNvbG9ycyovXG5mdW5jdGlvbiBpbnNwZWN0KG9iaiwgb3B0cykge1xuICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgdmFyIGN0eCA9IHtcbiAgICBzZWVuOiBbXSxcbiAgICBzdHlsaXplOiBzdHlsaXplTm9Db2xvclxuICB9O1xuICAvLyBsZWdhY3kuLi5cbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gMykgY3R4LmRlcHRoID0gYXJndW1lbnRzWzJdO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSA0KSBjdHguY29sb3JzID0gYXJndW1lbnRzWzNdO1xuICBpZiAoaXNCb29sZWFuKG9wdHMpKSB7XG4gICAgLy8gbGVnYWN5Li4uXG4gICAgY3R4LnNob3dIaWRkZW4gPSBvcHRzO1xuICB9IGVsc2UgaWYgKG9wdHMpIHtcbiAgICAvLyBnb3QgYW4gXCJvcHRpb25zXCIgb2JqZWN0XG4gICAgZXhwb3J0cy5fZXh0ZW5kKGN0eCwgb3B0cyk7XG4gIH1cbiAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LnNob3dIaWRkZW4pKSBjdHguc2hvd0hpZGRlbiA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmRlcHRoKSkgY3R4LmRlcHRoID0gMjtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jb2xvcnMpKSBjdHguY29sb3JzID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY3VzdG9tSW5zcGVjdCkpIGN0eC5jdXN0b21JbnNwZWN0ID0gdHJ1ZTtcbiAgaWYgKGN0eC5jb2xvcnMpIGN0eC5zdHlsaXplID0gc3R5bGl6ZVdpdGhDb2xvcjtcbiAgcmV0dXJuIGZvcm1hdFZhbHVlKGN0eCwgb2JqLCBjdHguZGVwdGgpO1xufVxuZXhwb3J0cy5pbnNwZWN0ID0gaW5zcGVjdDtcblxuXG4vLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGUjZ3JhcGhpY3Ncbmluc3BlY3QuY29sb3JzID0ge1xuICAnYm9sZCcgOiBbMSwgMjJdLFxuICAnaXRhbGljJyA6IFszLCAyM10sXG4gICd1bmRlcmxpbmUnIDogWzQsIDI0XSxcbiAgJ2ludmVyc2UnIDogWzcsIDI3XSxcbiAgJ3doaXRlJyA6IFszNywgMzldLFxuICAnZ3JleScgOiBbOTAsIDM5XSxcbiAgJ2JsYWNrJyA6IFszMCwgMzldLFxuICAnYmx1ZScgOiBbMzQsIDM5XSxcbiAgJ2N5YW4nIDogWzM2LCAzOV0sXG4gICdncmVlbicgOiBbMzIsIDM5XSxcbiAgJ21hZ2VudGEnIDogWzM1LCAzOV0sXG4gICdyZWQnIDogWzMxLCAzOV0sXG4gICd5ZWxsb3cnIDogWzMzLCAzOV1cbn07XG5cbi8vIERvbid0IHVzZSAnYmx1ZScgbm90IHZpc2libGUgb24gY21kLmV4ZVxuaW5zcGVjdC5zdHlsZXMgPSB7XG4gICdzcGVjaWFsJzogJ2N5YW4nLFxuICAnbnVtYmVyJzogJ3llbGxvdycsXG4gICdib29sZWFuJzogJ3llbGxvdycsXG4gICd1bmRlZmluZWQnOiAnZ3JleScsXG4gICdudWxsJzogJ2JvbGQnLFxuICAnc3RyaW5nJzogJ2dyZWVuJyxcbiAgJ2RhdGUnOiAnbWFnZW50YScsXG4gIC8vIFwibmFtZVwiOiBpbnRlbnRpb25hbGx5IG5vdCBzdHlsaW5nXG4gICdyZWdleHAnOiAncmVkJ1xufTtcblxuXG5mdW5jdGlvbiBzdHlsaXplV2l0aENvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHZhciBzdHlsZSA9IGluc3BlY3Quc3R5bGVzW3N0eWxlVHlwZV07XG5cbiAgaWYgKHN0eWxlKSB7XG4gICAgcmV0dXJuICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMF0gKyAnbScgKyBzdHIgK1xuICAgICAgICAgICAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzFdICsgJ20nO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHI7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBzdHlsaXplTm9Db2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICByZXR1cm4gc3RyO1xufVxuXG5cbmZ1bmN0aW9uIGFycmF5VG9IYXNoKGFycmF5KSB7XG4gIHZhciBoYXNoID0ge307XG5cbiAgYXJyYXkuZm9yRWFjaChmdW5jdGlvbih2YWwsIGlkeCkge1xuICAgIGhhc2hbdmFsXSA9IHRydWU7XG4gIH0pO1xuXG4gIHJldHVybiBoYXNoO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcykge1xuICAvLyBQcm92aWRlIGEgaG9vayBmb3IgdXNlci1zcGVjaWZpZWQgaW5zcGVjdCBmdW5jdGlvbnMuXG4gIC8vIENoZWNrIHRoYXQgdmFsdWUgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5zcGVjdCBmdW5jdGlvbiBvbiBpdFxuICBpZiAoY3R4LmN1c3RvbUluc3BlY3QgJiZcbiAgICAgIHZhbHVlICYmXG4gICAgICBpc0Z1bmN0aW9uKHZhbHVlLmluc3BlY3QpICYmXG4gICAgICAvLyBGaWx0ZXIgb3V0IHRoZSB1dGlsIG1vZHVsZSwgaXQncyBpbnNwZWN0IGZ1bmN0aW9uIGlzIHNwZWNpYWxcbiAgICAgIHZhbHVlLmluc3BlY3QgIT09IGV4cG9ydHMuaW5zcGVjdCAmJlxuICAgICAgLy8gQWxzbyBmaWx0ZXIgb3V0IGFueSBwcm90b3R5cGUgb2JqZWN0cyB1c2luZyB0aGUgY2lyY3VsYXIgY2hlY2suXG4gICAgICAhKHZhbHVlLmNvbnN0cnVjdG9yICYmIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZSA9PT0gdmFsdWUpKSB7XG4gICAgdmFyIHJldCA9IHZhbHVlLmluc3BlY3QocmVjdXJzZVRpbWVzLCBjdHgpO1xuICAgIGlmICghaXNTdHJpbmcocmV0KSkge1xuICAgICAgcmV0ID0gZm9ybWF0VmFsdWUoY3R4LCByZXQsIHJlY3Vyc2VUaW1lcyk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvLyBQcmltaXRpdmUgdHlwZXMgY2Fubm90IGhhdmUgcHJvcGVydGllc1xuICB2YXIgcHJpbWl0aXZlID0gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpO1xuICBpZiAocHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIHByaW1pdGl2ZTtcbiAgfVxuXG4gIC8vIExvb2sgdXAgdGhlIGtleXMgb2YgdGhlIG9iamVjdC5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XG4gIHZhciB2aXNpYmxlS2V5cyA9IGFycmF5VG9IYXNoKGtleXMpO1xuXG4gIGlmIChjdHguc2hvd0hpZGRlbikge1xuICAgIGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh2YWx1ZSk7XG4gIH1cblxuICAvLyBJRSBkb2Vzbid0IG1ha2UgZXJyb3IgZmllbGRzIG5vbi1lbnVtZXJhYmxlXG4gIC8vIGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9pZS9kd3c1MnNidCh2PXZzLjk0KS5hc3B4XG4gIGlmIChpc0Vycm9yKHZhbHVlKVxuICAgICAgJiYgKGtleXMuaW5kZXhPZignbWVzc2FnZScpID49IDAgfHwga2V5cy5pbmRleE9mKCdkZXNjcmlwdGlvbicpID49IDApKSB7XG4gICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIC8vIFNvbWUgdHlwZSBvZiBvYmplY3Qgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZC5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICB2YXIgbmFtZSA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbRnVuY3Rpb24nICsgbmFtZSArICddJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9XG4gICAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShEYXRlLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ2RhdGUnKTtcbiAgICB9XG4gICAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBiYXNlID0gJycsIGFycmF5ID0gZmFsc2UsIGJyYWNlcyA9IFsneycsICd9J107XG5cbiAgLy8gTWFrZSBBcnJheSBzYXkgdGhhdCB0aGV5IGFyZSBBcnJheVxuICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBhcnJheSA9IHRydWU7XG4gICAgYnJhY2VzID0gWydbJywgJ10nXTtcbiAgfVxuXG4gIC8vIE1ha2UgZnVuY3Rpb25zIHNheSB0aGF0IHRoZXkgYXJlIGZ1bmN0aW9uc1xuICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICB2YXIgbiA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgIGJhc2UgPSAnIFtGdW5jdGlvbicgKyBuICsgJ10nO1xuICB9XG5cbiAgLy8gTWFrZSBSZWdFeHBzIHNheSB0aGF0IHRoZXkgYXJlIFJlZ0V4cHNcbiAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBkYXRlcyB3aXRoIHByb3BlcnRpZXMgZmlyc3Qgc2F5IHRoZSBkYXRlXG4gIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIERhdGUucHJvdG90eXBlLnRvVVRDU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBlcnJvciB3aXRoIG1lc3NhZ2UgZmlyc3Qgc2F5IHRoZSBlcnJvclxuICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwICYmICghYXJyYXkgfHwgdmFsdWUubGVuZ3RoID09IDApKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyBicmFjZXNbMV07XG4gIH1cblxuICBpZiAocmVjdXJzZVRpbWVzIDwgMCkge1xuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW09iamVjdF0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuXG4gIGN0eC5zZWVuLnB1c2godmFsdWUpO1xuXG4gIHZhciBvdXRwdXQ7XG4gIGlmIChhcnJheSkge1xuICAgIG91dHB1dCA9IGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dCA9IGtleXMubWFwKGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmV0dXJuIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpO1xuICAgIH0pO1xuICB9XG5cbiAgY3R4LnNlZW4ucG9wKCk7XG5cbiAgcmV0dXJuIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSkge1xuICBpZiAoaXNVbmRlZmluZWQodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgndW5kZWZpbmVkJywgJ3VuZGVmaW5lZCcpO1xuICBpZiAoaXNTdHJpbmcodmFsdWUpKSB7XG4gICAgdmFyIHNpbXBsZSA9ICdcXCcnICsgSlNPTi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoL15cInxcIiQvZywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpICsgJ1xcJyc7XG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKHNpbXBsZSwgJ3N0cmluZycpO1xuICB9XG4gIGlmIChpc051bWJlcih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdudW1iZXInKTtcbiAgaWYgKGlzQm9vbGVhbih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdib29sZWFuJyk7XG4gIC8vIEZvciBzb21lIHJlYXNvbiB0eXBlb2YgbnVsbCBpcyBcIm9iamVjdFwiLCBzbyBzcGVjaWFsIGNhc2UgaGVyZS5cbiAgaWYgKGlzTnVsbCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCdudWxsJywgJ251bGwnKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRFcnJvcih2YWx1ZSkge1xuICByZXR1cm4gJ1snICsgRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpICsgJ10nO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHZhbHVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgIGlmIChoYXNPd25Qcm9wZXJ0eSh2YWx1ZSwgU3RyaW5nKGkpKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBTdHJpbmcoaSksIHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0LnB1c2goJycpO1xuICAgIH1cbiAgfVxuICBrZXlzLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgaWYgKCFrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIGtleSwgdHJ1ZSkpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSkge1xuICB2YXIgbmFtZSwgc3RyLCBkZXNjO1xuICBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih2YWx1ZSwga2V5KSB8fCB7IHZhbHVlOiB2YWx1ZVtrZXldIH07XG4gIGlmIChkZXNjLmdldCkge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tTZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKCFoYXNPd25Qcm9wZXJ0eSh2aXNpYmxlS2V5cywga2V5KSkge1xuICAgIG5hbWUgPSAnWycgKyBrZXkgKyAnXSc7XG4gIH1cbiAgaWYgKCFzdHIpIHtcbiAgICBpZiAoY3R4LnNlZW4uaW5kZXhPZihkZXNjLnZhbHVlKSA8IDApIHtcbiAgICAgIGlmIChpc051bGwocmVjdXJzZVRpbWVzKSkge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIG51bGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCByZWN1cnNlVGltZXMgLSAxKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdHIuaW5kZXhPZignXFxuJykgPiAtMSkge1xuICAgICAgICBpZiAoYXJyYXkpIHtcbiAgICAgICAgICBzdHIgPSBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJykuc3Vic3RyKDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0ciA9ICdcXG4nICsgc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0NpcmN1bGFyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmIChpc1VuZGVmaW5lZChuYW1lKSkge1xuICAgIGlmIChhcnJheSAmJiBrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBuYW1lID0gSlNPTi5zdHJpbmdpZnkoJycgKyBrZXkpO1xuICAgIGlmIChuYW1lLm1hdGNoKC9eXCIoW2EtekEtWl9dW2EtekEtWl8wLTldKilcIiQvKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEsIG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyheXCJ8XCIkKS9nLCBcIidcIik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ3N0cmluZycpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lICsgJzogJyArIHN0cjtcbn1cblxuXG5mdW5jdGlvbiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcykge1xuICB2YXIgbnVtTGluZXNFc3QgPSAwO1xuICB2YXIgbGVuZ3RoID0gb3V0cHV0LnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXIpIHtcbiAgICBudW1MaW5lc0VzdCsrO1xuICAgIGlmIChjdXIuaW5kZXhPZignXFxuJykgPj0gMCkgbnVtTGluZXNFc3QrKztcbiAgICByZXR1cm4gcHJldiArIGN1ci5yZXBsYWNlKC9cXHUwMDFiXFxbXFxkXFxkP20vZywgJycpLmxlbmd0aCArIDE7XG4gIH0sIDApO1xuXG4gIGlmIChsZW5ndGggPiA2MCkge1xuICAgIHJldHVybiBicmFjZXNbMF0gK1xuICAgICAgICAgICAoYmFzZSA9PT0gJycgPyAnJyA6IGJhc2UgKyAnXFxuICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgYnJhY2VzWzFdO1xuICB9XG5cbiAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyAnICcgKyBvdXRwdXQuam9pbignLCAnKSArICcgJyArIGJyYWNlc1sxXTtcbn1cblxuXG4vLyBOT1RFOiBUaGVzZSB0eXBlIGNoZWNraW5nIGZ1bmN0aW9ucyBpbnRlbnRpb25hbGx5IGRvbid0IHVzZSBgaW5zdGFuY2VvZmBcbi8vIGJlY2F1c2UgaXQgaXMgZnJhZ2lsZSBhbmQgY2FuIGJlIGVhc2lseSBmYWtlZCB3aXRoIGBPYmplY3QuY3JlYXRlKClgLlxuZnVuY3Rpb24gaXNBcnJheShhcikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhcik7XG59XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW4oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnYm9vbGVhbic7XG59XG5leHBvcnRzLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcblxuZnVuY3Rpb24gaXNOdWxsKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGwgPSBpc051bGw7XG5cbmZ1bmN0aW9uIGlzTnVsbE9yVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbE9yVW5kZWZpbmVkID0gaXNOdWxsT3JVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZyc7XG59XG5leHBvcnRzLmlzU3RyaW5nID0gaXNTdHJpbmc7XG5cbmZ1bmN0aW9uIGlzU3ltYm9sKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCc7XG59XG5leHBvcnRzLmlzU3ltYm9sID0gaXNTeW1ib2w7XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG5leHBvcnRzLmlzVW5kZWZpbmVkID0gaXNVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiBpc09iamVjdChyZSkgJiYgb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydHMuaXNSZWdFeHAgPSBpc1JlZ0V4cDtcblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiBpc09iamVjdChkKSAmJiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuZXhwb3J0cy5pc0RhdGUgPSBpc0RhdGU7XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gaXNPYmplY3QoZSkgJiZcbiAgICAgIChvYmplY3RUb1N0cmluZyhlKSA9PT0gJ1tvYmplY3QgRXJyb3JdJyB8fCBlIGluc3RhbmNlb2YgRXJyb3IpO1xufVxuZXhwb3J0cy5pc0Vycm9yID0gaXNFcnJvcjtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZShhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbCB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnIHx8ICAvLyBFUzYgc3ltYm9sXG4gICAgICAgICB0eXBlb2YgYXJnID09PSAndW5kZWZpbmVkJztcbn1cbmV4cG9ydHMuaXNQcmltaXRpdmUgPSBpc1ByaW1pdGl2ZTtcblxuZXhwb3J0cy5pc0J1ZmZlciA9IHJlcXVpcmUoJy4vc3VwcG9ydC9pc0J1ZmZlcicpO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG5cblxuZnVuY3Rpb24gcGFkKG4pIHtcbiAgcmV0dXJuIG4gPCAxMCA/ICcwJyArIG4udG9TdHJpbmcoMTApIDogbi50b1N0cmluZygxMCk7XG59XG5cblxudmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLFxuICAgICAgICAgICAgICAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuLy8gMjYgRmViIDE2OjE5OjM0XG5mdW5jdGlvbiB0aW1lc3RhbXAoKSB7XG4gIHZhciBkID0gbmV3IERhdGUoKTtcbiAgdmFyIHRpbWUgPSBbcGFkKGQuZ2V0SG91cnMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldE1pbnV0ZXMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldFNlY29uZHMoKSldLmpvaW4oJzonKTtcbiAgcmV0dXJuIFtkLmdldERhdGUoKSwgbW9udGhzW2QuZ2V0TW9udGgoKV0sIHRpbWVdLmpvaW4oJyAnKTtcbn1cblxuXG4vLyBsb2cgaXMganVzdCBhIHRoaW4gd3JhcHBlciB0byBjb25zb2xlLmxvZyB0aGF0IHByZXBlbmRzIGEgdGltZXN0YW1wXG5leHBvcnRzLmxvZyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnJXMgLSAlcycsIHRpbWVzdGFtcCgpLCBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpKTtcbn07XG5cblxuLyoqXG4gKiBJbmhlcml0IHRoZSBwcm90b3R5cGUgbWV0aG9kcyBmcm9tIG9uZSBjb25zdHJ1Y3RvciBpbnRvIGFub3RoZXIuXG4gKlxuICogVGhlIEZ1bmN0aW9uLnByb3RvdHlwZS5pbmhlcml0cyBmcm9tIGxhbmcuanMgcmV3cml0dGVuIGFzIGEgc3RhbmRhbG9uZVxuICogZnVuY3Rpb24gKG5vdCBvbiBGdW5jdGlvbi5wcm90b3R5cGUpLiBOT1RFOiBJZiB0aGlzIGZpbGUgaXMgdG8gYmUgbG9hZGVkXG4gKiBkdXJpbmcgYm9vdHN0cmFwcGluZyB0aGlzIGZ1bmN0aW9uIG5lZWRzIHRvIGJlIHJld3JpdHRlbiB1c2luZyBzb21lIG5hdGl2ZVxuICogZnVuY3Rpb25zIGFzIHByb3RvdHlwZSBzZXR1cCB1c2luZyBub3JtYWwgSmF2YVNjcmlwdCBkb2VzIG5vdCB3b3JrIGFzXG4gKiBleHBlY3RlZCBkdXJpbmcgYm9vdHN0cmFwcGluZyAoc2VlIG1pcnJvci5qcyBpbiByMTE0OTAzKS5cbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHdoaWNoIG5lZWRzIHRvIGluaGVyaXQgdGhlXG4gKiAgICAgcHJvdG90eXBlLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gc3VwZXJDdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHRvIGluaGVyaXQgcHJvdG90eXBlIGZyb20uXG4gKi9cbmV4cG9ydHMuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuXG5leHBvcnRzLl9leHRlbmQgPSBmdW5jdGlvbihvcmlnaW4sIGFkZCkge1xuICAvLyBEb24ndCBkbyBhbnl0aGluZyBpZiBhZGQgaXNuJ3QgYW4gb2JqZWN0XG4gIGlmICghYWRkIHx8ICFpc09iamVjdChhZGQpKSByZXR1cm4gb3JpZ2luO1xuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoYWRkKTtcbiAgdmFyIGkgPSBrZXlzLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIG9yaWdpbltrZXlzW2ldXSA9IGFkZFtrZXlzW2ldXTtcbiAgfVxuICByZXR1cm4gb3JpZ2luO1xufTtcblxuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cbiJdfQ==
