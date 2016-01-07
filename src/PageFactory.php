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
        return new InternalPage($title, $href, new SimpleContent('content-homepage.phtml'));
    }

    public function music() {
        $title = 'Music';
        $href = 'music.html';
        return new InternalPage($title, $href, new SimpleContent('content-music.phtml'));
    }

    public function contact() {
        $title = 'Contact';
        $href = 'contact.html';
        return new InternalPage($title, $href, new SimpleContent('content-contact.phtml'));
    }

    public function software() {
        $title = 'Software';
        $href = 'software.html';

        $linkedPages = array(
            $this->m4lDSM(),
            $this->m4lWAI(),
            $this->m4lMCM(),
            $this->kmkControlScript(),
            $this->wacNetworkMidi(),
            $this->miniakPatchEditor(),
            $this->chipPanFire(),
        );

        return new InternalPage($title, $href, new SoftwareHomeContent($linkedPages));
    }

    public function m4lDSM() {
        $title = 'Device Snapshot Manager';
        $href = 'software-m4l-device-snapshot-manager.html';
        $strapline = $this->_maxForLive . ' device that adds the ability to store and recall ‘snapshots’ of Ableton Live devices in realtime';
        $content = new SoftwareContent('content-devicesnapshotmanager.phtml', 'http://www.chippanfire.com/cpf_media/software/dsm-screenshot.jpg', 'DeviceSnapshotManager.pdf');
        return new InternalPage($title, $href, $content, $strapline);
    }

    public function m4lWAI() {
        $title = 'Where Am I';
        $href = 'software-m4l-where-am-i.html';
        $strapline = $this->_maxForLive . ' utility device that displays Live API information for the currently selected element of the Ableton Live interface';
        $content = new SoftwareContent('content-whereami.phtml', 'http://www.chippanfire.com/cpf_media/software/wai-screenshot.jpg', 'WhereAmI.pdf');
        return new InternalPage($title, $href, $content, $strapline);
    }

    public function m4lMCM() {
        $title = 'MIDI Clip Modulo';
        $href = 'software-m4l-midi-clip-modulo.html';
        $strapline = $this->_maxForLive . " utility device that adds extra functionality to note editing in Ableton Live's MIDI clips.";
        $content = new SoftwareContent('content-midiclipmodulo.phtml', 'http://www.chippanfire.com/cpf_media/software/midi-clip-modulo.jpg', 'MidiClipModulo.pdf');
        return new InternalPage($title, $href, $content, $strapline);
    }

    public function wacNetworkMidi() {
        $title = 'Wac Network MIDI';
        $href = 'software-wac-network-midi.html';
        $strapline = 'Cross-platform (Win and OSX) tool built with ' . $this->_maxMSP . ' for transmitting MIDI from one computer to another via a network, without the need for hardware MIDI interfaces.';
        // TODO add documentation download to page
        $content = new SoftwareContent('content-wacnetworkmidi.phtml', 'http://www.chippanfire.com/cpf_media/software/wac-network-midi.png', null);
        return new InternalPage($title, $href, $content, $strapline);
    }

    public function miniakPatchEditor() {
        $title = 'Miniak Patch Editor';
        $href = 'software-miniak-patch-editor.html';
        $strapline = 'Patch editor/management tool for the '. Link::external('Akai Miniak', 'http://www.akaipro.com/product/miniak') . ' (and the ' . Link::external('Alesis Micron', 'http://www.vintagesynth.com/misc/micron.php') . ')';
        $content = new SoftwareContent('content-miniakpatcheditor.phtml', 'http://www.chippanfire.com/cpf_media/software/miniak-patch-editor.jpg', 'MPE-Documentation.pdf');
        return new InternalPage($title, $href, $content, $strapline);
    }

    public function kmkControlScript() {
        $title = 'KMK Control Script';
        $href = 'https://github.com/crosslandwa/kmkControl';
        $strapline = 'In-depth control of ' . $this->_abletonLive . ' using the Korg Microkontrol (greatly improved on that offered natively).';
        return new ExternalPage($title, $href, $strapline);
    }

    public function chipPanFire() {
        $title = 'ChipPanFire site';
        $href = 'https://github.com/crosslandwa/chippanfire-site';
        $strapline = 'Totally meta, see the source code for generating this site!';
        return new ExternalPage($title, $href, $strapline);
    }
}
