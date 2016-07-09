const EventEmitter = require('events'),
    util = require('util');
/*
Repeatedly calls the passed callback at the specified interval until told to stop
*/
function Repetae(scheduled_execution, initial_interval) {
    EventEmitter.call(this);
    var repetae = this;
    this._is_scheduling = false;
    this._interval = initial_interval > 20 ? initial_interval : 500; // ms

    this.interval = function (amount_ms) {
        repetae._interval = amount_ms > 20 ? amount_ms : 20; // 20ms min interval
        repetae.report_interval();
    }

    this.start = function(callback) {
        if (repetae._is_scheduling) return;
        repetae._is_scheduling = true;
        repetae._call_and_reschedule(callback);
    }

    this._call_and_reschedule = function(callback) {
        if (repetae._is_scheduling) {
            callback();
            scheduled_execution(() => repetae._call_and_reschedule(callback), repetae._interval);
        };
    }
    
    this.stop = function() {
        repetae._is_scheduling = false;
    }

    this.report_interval = function() {
        repetae.emit('interval', repetae._interval);
    }
}
util.inherits(Repetae, EventEmitter);

// Adaptor function used to bind to web Audio API and utilise its audio-rate scheduling
Repetae.create_scheduled_by_audio_context = function(context, initial_interval) {
    return new Repetae((callback, interval_ms) => {
        let source = context.createBufferSource(),
            now = context.currentTime,
            scheduled_at = now + (interval_ms / 1000);
        // a buffer length of 1 sample doesn't work on IOS, so use 1/1000th of a second
        let buffer = context.createBuffer(1, context.sampleRate / 1000, context.sampleRate);
        source.addEventListener('ended', callback);
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(scheduled_at);
    }, initial_interval);
}

module.exports = Repetae;