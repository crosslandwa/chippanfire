const audio_context = window.AudioContext ? new window.AudioContext() : new window.webkitAudioContext(),
    Player = require('./player.js'),
    Repeater = require('./repeater.js'),
    EventEmitter = require('events'),
    util = require('util');

window.addEventListener('load', off_we_go);

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

    button.addEventListener('click', metronome.toggle);
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
        count = 0,
        bpm = initial_bpm,
        accent_count = initial_accent_count,
        metronome = this;

    let pulse = function() {
        if (count == 0) {
            accent.play(1, 20000);    
        } else {
            tick.play(1, 20000);
        }
        count = (++count % accent_count);
    }

    let load_samples = function(callback) {
        accent = new Player('assets/audio/metronome-accent.mp3', audio_context);
        accent.on('loaded', () => {
            tick = new Player('assets/audio/metronome-tick.mp3', audio_context);
            accent.on('started', () => metronome.emit('tick_start'));
            tick.on('started', () => metronome.emit('tick_start'));
            accent.on('stopped', () => metronome.emit('tick_stop'));
            tick.on('stopped', () => metronome.emit('tick_stop'));
            tick.on('loaded', () => {
                tick.play(1, 20000);
                callback();
            });
        })
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
        if (!accent) {
            load_samples(do_toggle);
        } else {
            do_toggle();
        }
    }
}
util.inherits(Metronome, EventEmitter);