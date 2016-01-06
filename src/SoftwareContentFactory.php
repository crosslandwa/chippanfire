<?php

final class SoftwareContentFactory {
    private $_maxForLive;
    private $_abletonLive;
    private $_maxMSP;

    public function __construct() {
        $this->_maxForLive = Link::external('Max For Live', 'http://www.ableton.com/maxforlive');
        $this->_abletonLive = Link::external('Ableton Live', 'http://www.ableton.com');
        $this->_maxMSP = Link::external('MaxMSP', 'http://www.cycling74.com/');
    }

    public function deviceSnapshotManager() {
        return new SoftwareContent(
            'content-devicesnapshotmanager.phtml',
            $this->_maxForLive . ' device that adds the ability to store and recall ‘snapshots’ of Ableton Live devices in realtime',
            'http://www.chippanfire.com/cpf_media/software/dsm-screenshot.jpg'
        );
    }

    public function whereAmI() {
        return new SoftwareContent(
            'content-whereami.phtml',
             $this->_maxForLive . ' utility device that displays Live API information for the currently selected element of the Ableton Live interface',
            'http://www.chippanfire.com/cpf_media/software/wai-screenshot.jpg'
        );
    }

    public function kmkControlScript() {
        return new SoftwareContent(
            null,
            'In-depth control of ' . $this->_abletonLive . ' using the Korg Microkontrol (greatly improved on that offered natively).',
            'http://www.chippanfire.com/cpf_media/software/dsm-screenshot.jpg'
        );
    }

    public function wacNetworkMidi() {
        return new SoftwareContent(
            'content-wacnetworkmidi.phtml',
            'Cross-platform (Win and OSX) tool built with ' . $this->_maxMSP . ' for transmitting MIDI from one computer to another via a network, without the need for hardware MIDI interfaces.',
            'http://www.chippanfire.com/cpf_media/software/wac-network-midi.png'
        );
    }
}
