const audio_context = new AudioContext(),
    Player = require('./player.js'),
    Repeater = require('./repeater.js'),
    EventEmitter = require('events'),
    util = require('util');

window.addEventListener('load', off_we_go);

function off_we_go() {
    let button = document.getElementById('metronome-on-off'),
        bpm = document.getElementById('bpm-control'),
        bpm_label = document.querySelector("label[for='bpm-control']")
        metronome = new Metronome(120);


    window.addEventListener("keypress", (event) => {
        if (32 == event.charCode) metronome.toggle();
    });

    bpm.addEventListener("input", (event) => {
        const new_bpm = event.target.value;
        bpm_label.innerHTML = 'BPM: ' + new_bpm;
        metronome.update_bpm(new_bpm)
    })

    button.addEventListener("click", metronome.toggle);
    metronome.on('tick_start', () => metronome_on(button));
    metronome.on('tick_stop', () => metronome_off(button));
}

function metronome_on(ui_btn) {
    ui_btn.classList.add('active');
}

function metronome_off(ui_btn) {
    ui_btn.classList.remove('active');
}

function Metronome(initial_bpm) {
    EventEmitter.call(this);

    let bpm_to_ms = function(bpm) {
        return (60 / bpm) * 1000;
    }

    let active = false,
        accent = new Player('assets/audio/metronome-accent.mp3', audio_context),
        tick = new Player('assets/audio/metronome-tick.mp3', audio_context),
        repeater = Repeater.create_scheduled_by_audio_context(audio_context, bpm_to_ms(initial_bpm)),
        count = 0,
        bpm = initial_bpm
        metronome = this;

    let pulse = function() {
        if (count == 0) {
            accent.play(1, 20000);    
        } else {
            tick.play(1, 20000);
        }
        count = (++count % 4);
    }

    this.update_bpm = function(bpm) {
        repeater.interval(bpm_to_ms(bpm))
    }

    this.toggle = function() {
        active = !active;
        if (active) {
            repeater.start(pulse);
        } else {
            repeater.stop();
            count = 0;
        }
    }

    accent.on('started', () => metronome.emit('tick_start'));
    tick.on('started', () => metronome.emit('tick_start'));
    accent.on('stopped', () => metronome.emit('tick_stop'));
    tick.on('stopped', () => metronome.emit('tick_stop'));
}
util.inherits(Metronome, EventEmitter);