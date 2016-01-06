<?php

class PageFactory {
    private $_maxForLive;
    private $_abletonLive;
    private $_maxMSP;

    private $_cached = array();

    public function __construct() {
        $this->_maxForLive = Link::external('Max For Live', 'http://www.ableton.com/maxforlive');
        $this->_abletonLive = Link::external('Ableton Live', 'http://www.ableton.com');
        $this->_maxMSP = Link::external('MaxMSP', 'http://www.cycling74.com/');
    }

    public function home() {
        $title = 'ChipPanFire';
        $href = 'index.html';
        return new Page($title, $href, new SimpleContent('content-homepage.phtml'), Link::internal($title, $href));
    }

    public function music() {
        $title = 'Music';
        $href = 'music.html';
        return new Page($title, $href, new SimpleContent('content-music.phtml'), Link::internal($title, $href));
    }

    public function contact() {
        $title = 'Contact';
        $href = 'contact.html';
        return new Page($title, $href, new SimpleContent('content-contact.phtml'), Link::internal($title, $href));
    }

    public function software() {
        $title = 'Software';
        $href = 'software.html';

        $linkedPages = array($this->m4lDSM(), $this->m4lWAI(), $this->m4lMCM(), $this->kmkControlScript(), $this->wacNetworkMidi());

        return new Page($title, $href, new SoftwareHomeContent($linkedPages), Link::internal($title, $href));
    }

    public function m4lDSM() {
        $title = 'Device Snapshot Manager';
        $href = 'software-m4l-device-snapshot-manager.html';
        $headlineText = $this->_maxForLive . ' device that adds the ability to store and recall ‘snapshots’ of Ableton Live devices in realtime';
        $content = new SoftwareContent(
            'content-devicesnapshotmanager.phtml',
            $headlineText,
            'http://www.chippanfire.com/cpf_media/software/dsm-screenshot.jpg'
        );
        return new Page($title, $href, $content, Link::internal($title, $href), $headlineText);
    }

    public function m4lWAI() {
        $title = 'Where Am I';
        $href = 'software-m4l-where-am-i.html';
        $headlineText = $this->_maxForLive . ' utility device that displays Live API information for the currently selected element of the Ableton Live interface';
        $content = new SoftwareContent(
            'content-whereami.phtml',
            $headlineText,
            'http://www.chippanfire.com/cpf_media/software/wai-screenshot.jpg'
        );
        return new Page($title, $href, $content, Link::internal($title, $href), $headlineText);
    }

    public function m4lMCM() {
        $title = 'MIDI Clip Modulo';
        $href = 'software-m4l-midi-clip-modulo.html';
        $headlineText = $this->_maxForLive . " utility device that adds extra functionality to note editing in Ableton Live's MIDI clips.";
        $content = new SoftwareContent(
            'content-midiclipmodulo.phtml',
            $headlineText,
            'http://www.chippanfire.com/cpf_media/software/midi-clip-modulo.jpg'
        );
        return new Page($title, $href, $content, Link::internal($title, $href), $headlineText);
    }

    public function wacNetworkMidi() {
        $title = 'Wac Network MIDI';
        $href = 'software-wac-network-midi.html';
        $headlineText = 'Cross-platform (Win and OSX) tool built with ' . $this->_maxMSP . ' for transmitting MIDI from one computer to another via a network, without the need for hardware MIDI interfaces.';
        $content = new SoftwareContent(
            'content-wacnetworkmidi.phtml',
            $headlineText,
            'http://www.chippanfire.com/cpf_media/software/wac-network-midi.png'
        );
        return new Page($title, $href, $content, Link::internal($title, $href), $headlineText);
    }

    public function kmkControlScript() {
        $title = 'KMK Control Script';
        $href = 'https://github.com/crosslandwa/kmkControl';
        $headlineText = 'In-depth control of ' . $this->_abletonLive . ' using the Korg Microkontrol (greatly improved on that offered natively).';
        return new Page($title, $href, null, Link::external($title, $href), $headlineText);
    }
}