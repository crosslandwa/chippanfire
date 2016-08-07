const audio_context = window.AudioContext ? new window.AudioContext() : new window.webkitAudioContext(),
    Player = require('wac.sample-player'),
    Repeater = require('./repeater.js'),
    EventEmitter = require('events'),
    util = require('util'),
    isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

if (isIOS) {
    window.addEventListener('load', make_it_work_on_ios);
} else {
    window.addEventListener('load', off_we_go);
}

function make_it_work_on_ios() {
    window.addEventListener('touchend', () => {
        if (audio_context.state != 'running') {
            console.log('Starting web audio context via the IOS dance');
            var buffer = audio_context.createBuffer(1, 1, 22050);
            var source = audio_context.createBufferSource();
            source.buffer = buffer;
            source.connect(audio_context.destination);
            source.noteOn(0);
            off_we_go();
        }
    }, false);
}

function off_we_go() {
    var button = document.getElementById('metronome-on-off'),
        button_label = document.getElementById("label[for='metronome-on-off']"),
        bpm = document.getElementById('bpm-control'),
        bpm_label = document.querySelector("label[for='bpm-control']"),
        accent = document.getElementById('accent-control'),
        accent_label = document.querySelector("label[for='accent-control']"),
        metronome = new Metronome(120, 4);

    window.addEventListener('keydown', (event) => {
        if (32 == event.keyCode && !(button == document.activeElement)) metronome.toggle();
    });

    bpm.addEventListener('input', (event) => {
        const new_bpm = event.target.value;
        bpm_label.innerHTML = 'BPM: ' + new_bpm;
        metronome.update_bpm(new_bpm);
    });

    accent.addEventListener('input', (event) => {
        const new_accent = event.target.value;
        accent_label.innerHTML = 'ACCENT: ' + new_accent + ' beats';
        metronome.update_accent_count(new_accent);
    });

    button.addEventListener('click', () => {
        metronome.toggle();
    });
    metronome.on('tick_start', () => metronome_on(button));
    metronome.on('tick_stop', () => metronome_off(button));
}

function metronome_on(ui_btn) {
    ui_btn.classList.add('active');
}

function metronome_off(ui_btn) {
    ui_btn.classList.remove('active');
}

function Metronome(initial_bpm, initial_accent_count) {
    EventEmitter.call(this);
    let bpm_to_ms = function(bpm) {
        return (60 / bpm) * 1000;
    }

    let active = false,
        accent = undefined,
        tick = undefined,
        repeater = Repeater.create_scheduled_by_audio_context(audio_context, bpm_to_ms(initial_bpm)),
        // repeater = new Repeater(setTimeout, bpm_to_ms(initial_bpm)),
        count = 0,
        bpm = initial_bpm,
        accent_count = initial_accent_count,
        metronome = this;

    let pulse = function() {
        if (count == 0) {
            accent.play();
        } else {
            tick.play();
        }
        count = (++count % accent_count);
    }

    let load_samples = function() {
        if (accent) { return Promise.resolve(); }
        return new Promise((resolve, reject) => {
            new Player('assets/audio/metronome-accent.mp3', audio_context, resolve).toMaster();
        })
        .then((player) => {
            accent = player;
            accent.on('started', () => metronome.emit('tick_start'));
            accent.on('stopped', () => metronome.emit('tick_stop'));
        })
        .then(() => {
            return new Promise((resolve, reject) => {
                new Player('assets/audio/metronome-tick.mp3', audio_context, resolve).toMaster();
            })
        })
        .then((player) => {
            tick = player;
            tick.on('started', () => metronome.emit('tick_start'));
            tick.on('stopped', () => metronome.emit('tick_stop'));
        });
    }

    let do_toggle = function() {
        active = !active;
        if (active) {
            repeater.start(pulse);
        } else {
            repeater.stop();
            count = 0;
        }
    }

    this.update_bpm = function(bpm) {
        repeater.interval(bpm_to_ms(bpm))
    }

    this.update_accent_count = function(count) {
        accent_count = count;
    }

    this.toggle = function() {
        load_samples().then(do_toggle);
    }
}
util.inherits(Metronome, EventEmitter);