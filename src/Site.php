<?php

final class Site {
    private $_pages;
    private $_navigation;

    private function __construct($pages, $navigation) {
        $this->_pages = $pages;
        $this->_navigation = $navigation;
    }

    public final static function create() {
        $softwareFactory = new SoftwareContentFactory();

        $pagesMeta = array(
            'm4lDSM' => array(
                'title' => 'Device Snapshot Manager',
                'href' => 'software-m4l-device-snapshot-manager.html',
                'content' => $softwareFactory->deviceSnapshotManager()
            ),
            'm4lWAI' => array(
                'title' => 'Where Am I',
                'href' => 'software-m4l-where-am-i.html',
                'content' => $softwareFactory->whereAmI()
            )
        );

        $pages = array();
        foreach ($pagesMeta as $key => $p) {
            // TODO internal/external pages
            $pages[$key] = new Page($p['title'], $p['href'], $p['content'], Link::internal($p['title'], $p['href']));
        }

        // TODO keep moving into above pattern
        $wacNetworkMidi = new Page('Wac Network MIDI', 'software-wac-network-midi.html', $softwareFactory->wacNetworkMidi(), Link::internal('Wac Network MIDI', 'software-wac-network-midi.html'));
        $kmkControlScript = new Page('KMK Control Script', 'https://github.com/crosslandwa/kmkControl', $softwareFactory->kmkControlScript(), Link::external('KMK Control Script', 'https://github.com/crosslandwa/kmkControl'));

        // TODO duplicate creation/use of content here...
        $softwareSummaries = array(
            new SoftwareSummary($pages['m4lDSM'], $softwareFactory->deviceSnapshotManager()),
            new SoftwareSummary($pages['m4lWAI'], $softwareFactory->whereAmI()),
            new SoftwareSummary($kmkControlScript, $softwareFactory->kmkControlScript()),
            new SoftwareSummary($wacNetworkMidi, $softwareFactory->wacNetworkMidi())
        );

        $software = new Page('Software', 'software.html', new SoftwareHomeContent($softwareSummaries), Link::internal('Software', 'software.html'));

        $home = new Page('ChipPanFire', 'index.html', new SimpleContent('content-homepage.phtml'), Link::internal('ChipPanFire', 'index.html'));
        $music = new Page('Music', 'music.html', new SimpleContent('content-music.phtml'), Link::internal('Music', 'music.html'));
        $contact = new Page('Contact', 'contact.html', new SimpleContent('content-contact.phtml'), Link::internal('Contact', 'contact.html'));

        $allPages = array($home, $music, $software, $pages['m4lDSM'], $pages['m4lWAI'], $wacNetworkMidi, $contact);
        $navPages = array($home, $music, $software, $contact);

        return new Site($allPages, new Navigation($navPages));
    }

    /**
     * Remove HTML pages from previous build
     */
    public function clearLastBuild() {
        $oldFiles = glob('site/*.html');
        foreach ($oldFiles as $oldFile) {
            if (is_file($oldFile)) {
                unlink($oldFile);
            }
        }
    }

    public function render() {
        ob_start();
        foreach ($this->_pages as $page) {
            $page->render($this->_navigation);
            file_put_contents('site/' . $page->filename(), ob_get_contents());
            ob_clean();
        }
        ob_end_clean();
    }
}
