<?php

final class SoftwareContentFactory {

    public function deviceSnapshotManager() {
        return new SoftwareContent(
            'content-devicesnapshotmanager.phtml',
            '<a href="http://www.ableton.com/maxforlive" target="_blank">Max For Live</a> device that adds '
                . 'the ability to store and recall ‘snapshots’ of Ableton Live devices in realtime',
            'http://www.chippanfire.com/cpf_media/software/dsm-screenshot.jpg'
        );
    }

    public function whereAmI() {
        return new SoftwareContent(
            'content-whereami.phtml',
             '<a href="http://www.ableton.com/maxforlive" target="_blank">Max For Live</a> utility device that displays '
                . 'Live API information for the currently selected element of the Ableton Live interface',
            'http://www.chippanfire.com/cpf_media/software/wai-screenshot.jpg'
        );
    }

    public function kmkControlScript() {
        return new SoftwareContent(
            null,
            'In-depth control of <a href="http://www.ableton.com" target="_blank">Ableton Live</a> using the Korg Microkontrol (greatly improved on that offered natively).',
            'http://www.chippanfire.com/cpf_media/software/dsm-screenshot.jpg'
        );
    }
}
