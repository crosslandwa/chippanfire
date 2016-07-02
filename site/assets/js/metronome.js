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
    let active = false;
    this.toggle = function() {
        active = !active;
        if (active) {
            on_start();
        } else {
            on_stop();
        }
    }
}