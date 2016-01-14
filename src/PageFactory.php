<?php

class PageFactory {
    private $_cache = array();

    private function _cacheAndReturn($factoryCode) {
        $debug = debug_backtrace();
        $callingFunctionName = $debug[1]['function'];
        if (!isset($this->_cache[$callingFunctionName])) {
            $this->_cache[$callingFunctionName] = call_user_func($factoryCode);
        }
        return $this->_cache[$callingFunctionName];
    }

    public function home() {
        $linkedPages = array(
            'music' => $this->music(),
            'software' => $this->software(),
        );
        return $this->_cacheAndReturn(function() use ($linkedPages) {
            $title = '<img class="cpf-navbar-brand" src="assets/images/cpf_logo.png" alt="ChipPanFire" >';
            $href = 'index.html';
            return new InternalPage($title, $href, new SimpleContent('content-homepage.phtml', $linkedPages));
        });
    }

    public function music() {
        return $this->_cacheAndReturn(function() {
            $title = 'Music';
            $href = 'music.html';
            return new InternalPage($title, $href, new SimpleContent('content-music.phtml'));
        });
    }

    public function contact() {
        return $this->_cacheAndReturn(function() {
            $title = 'Contact';
            $href = 'contact.html';
            return new InternalPage($title, $href, new SimpleContent('content-contact.phtml'));
        });
    }

    public function software() {
        $linkedPages = $this->linkedSoftwarePages();
        return $this->_cacheAndReturn(function() use ($linkedPages) {
            $title = 'Software Overview';
            $href = 'software.html';
            return new InternalPage($title, $href, new SimpleContent('content-software.phtml', $linkedPages));
        });
    }

    public function error() {
        return $this->_cacheAndReturn(function() {
            $title = 'Not Found 40404040404';
            $href = 'error.html';
            return new InternalPage($title, $href, new SimpleContent('content-error.phtml'));
        });
    }

    public function linkedSoftwarePages() {
        return array(
            $this->m4lDSM(),
            $this->m4lWAI(),
            $this->m4lMCM(),
            $this->kmkControlScript(),
            $this->wacNetworkMidi(),
            $this->miniakPatchEditor(),
            $this->chipPanFire(),
        );
    }

    public function m4lDSM() {
        return $this->_cacheAndReturn(function() {
            $title = 'Device Snapshot Manager';
            $href = 'software-m4l-device-snapshot-manager.html';
            $strapline = Links::$maxForLive . ' device that adds the ability to store and recall ‘snapshots’ of Ableton Live devices in realtime';
            $content = new SoftwareContent('content-devicesnapshotmanager.phtml', 'assets/images/dsm-screenshot.jpg', 'DeviceSnapshotManager.pdf');
            return new InternalPage($title, $href, $content, $strapline);
        });
    }

    public function m4lWAI() {
        return $this->_cacheAndReturn(function() {
            $title = 'Where Am I';
            $href = 'software-m4l-where-am-i.html';
            $strapline = Links::$maxForLive . ' utility device that displays Live API information for the currently selected element of the Ableton Live interface';
            $content = new SoftwareContent('content-whereami.phtml', 'assets/images/wai-screenshot.jpg', 'WhereAmI.pdf');
            return new InternalPage($title, $href, $content, $strapline);
        });
    }

    public function m4lMCM() {
        return $this->_cacheAndReturn(function() {
            $title = 'MIDI Clip Modulo';
            $href = 'software-m4l-midi-clip-modulo.html';
            $strapline = Links::$maxForLive . " utility device that adds extra functionality to note editing in Ableton Live's MIDI clips";
            $content = new SoftwareContent('content-midiclipmodulo.phtml', 'assets/images/midi-clip-modulo.jpg', 'MidiClipModulo.pdf');
            return new InternalPage($title, $href, $content, $strapline);
        });
    }

    public function wacNetworkMidi() {
        return $this->_cacheAndReturn(function() {
            $title = 'Wac Network MIDI';
            $href = 'software-wac-network-midi.html';
            $strapline = 'Cross-platform (Win/OS X) tool for transmitting MIDI from one computer to another via a network (sans hardware MIDI interfaces)';
            $content = new SoftwareContent('content-wacnetworkmidi.phtml', 'assets/images/wac-network-midi.png', 'wacNetworkMIDI.pdf');
            return new InternalPage($title, $href, $content, $strapline);
        });
    }

    public function miniakPatchEditor() {
        return $this->_cacheAndReturn(function() {
            $title = 'Miniak Patch Editor';
            $href = 'software-miniak-patch-editor.html';
            $strapline = 'Patch editor/management tool for the '. Links::$miniak . ' (and ' . Links::$micron . ') synthesiser';
            $content = new SoftwareContent('content-miniakpatcheditor.phtml', 'assets/images/miniak-patch-editor.jpg', 'MPE-Documentation.pdf');
            return new InternalPage($title, $href, $content, $strapline);
        });
    }

    public function kmkControlScript() {
        return $this->_cacheAndReturn(function() {
            $title = 'KMK Control Script';
            $href = 'https://github.com/crosslandwa/kmkControl';
            $strapline = 'In-depth control of ' . Links::$abletonLive . ' using the Korg Microkontrol (greatly improved on that offered natively)';
            return new ExternalPage($title, $href, $strapline);
        });
    }

    public function chipPanFire() {
        return $this->_cacheAndReturn(function() {
            $title = 'ChipPanFire Source';
            $href = 'https://github.com/crosslandwa/chippanfire-site';
            $strapline = 'Totally meta, see the source code for generating this site!';
            return new ExternalPage($title, $href, $strapline);
        });
    }
}
