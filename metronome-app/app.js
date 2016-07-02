const audio_context = new AudioContext(),
    Player = require('./player.js'),
    Repeater = require('./repeater.js'),
    EventEmitter = require('events'),
    util = require('util');

window.addEventListener('load', off_we_go);

function off_we_go() {
    let button = document.getElementById('metronome-on-off'),
        metronome = new Metronome();

    window.addEventListener("keypress", (event) => {
        if (32 == event.charCode) metronome.toggle();
    });
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

function Metronome() {
    EventEmitter.call(this);
    let active = false,
        accent = new Player('assets/audio/metronome-accent.mp3', audio_context),
        tick = new Player('assets/audio/metronome-tick.mp3', audio_context),
        repeater = Repeater.create_scheduled_by_audio_context(audio_context, 500),
        count = 0,
        metronome = this;

    let pulse = function() {
        if (count == 0) {
            accent.play(1, 20000);    
        } else {
            tick.play(1, 20000);
        }
        count = (++count % 4);
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