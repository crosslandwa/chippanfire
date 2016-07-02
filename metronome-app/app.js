const audio_context = new AudioContext(),
    Player = require('./player.js'),
    Repeater = require('./repeater.js');

window.addEventListener('load', off_we_go);

function off_we_go() {
    let button = document.getElementById('metronome-on-off'),
        metronome = new Metronome(
            () => metronome_on(button),
            () => metronome_off(button) 
        );


    window.addEventListener("keypress", (event) => {
        if (32 == event.charCode) metronome.toggle();
    });
    button.addEventListener("click", metronome.toggle);
}

function metronome_on(ui_btn) {
    ui_btn.classList.add('active');
}

function metronome_off(ui_btn) {
    ui_btn.classList.remove('active');
}

function Metronome(on_start, on_stop) {
    let active = false,
        accent = new Player('assets/audio/metronome-accent.mp3', audio_context),
        tick = new Player('assets/audio/metronome-tick.mp3', audio_context),
        repeater = Repeater.create_scheduled_by_audio_context(audio_context, 500),
        count = 0;

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
            on_start();
        } else {
            repeater.stop();
            count = 0;
            on_stop();
        }
    }
}