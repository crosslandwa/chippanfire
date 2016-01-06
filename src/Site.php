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
                'location' => 'internal',
                'content' => $softwareFactory->deviceSnapshotManager(),
                'has_summary' => true
            ),
            'm4lWAI' => array(
                'title' => 'Where Am I',
                'href' => 'software-m4l-where-am-i.html',
                'location' => 'internal',
                'content' => $softwareFactory->whereAmI(),
                'has_summary' => true
            ),
            'kmkControlScript' => array(
                'title' => 'KMK Control Script',
                'href' => 'https://github.com/crosslandwa/kmkControl',
                'location' => 'external',
                'content' => $softwareFactory->kmkControlScript(),
                'has_summary' => true
            ),
            'wacNetworkMidi' => array(
                'title' => 'Wac Network MIDI',
                'href' => 'software-wac-network-midi.html',
                'location' => 'internal',
                'content' => $softwareFactory->wacNetworkMidi(),
                'has_summary' => true
            ),
        );

        $pages = array();
        $softwareSummaries = array();
        foreach ($pagesMeta as $key => $p) {
            $link = call_user_func('Link::' . $p['location'], $p['title'], $p['href']);

            $pages[$key] = new Page($p['title'], $p['href'], $p['content'], $link);

            if (isset($p['has_summary']) && $p['has_summary']) {
                $softwareSummaries[] = new SoftwareSummary($pages[$key], $p['content']);
            }
        }

        // TODO keep moving into above pattern
        $software = new Page('Software', 'software.html', new SoftwareHomeContent($softwareSummaries), Link::internal('Software', 'software.html'));

        $home = new Page('ChipPanFire', 'index.html', new SimpleContent('content-homepage.phtml'), Link::internal('ChipPanFire', 'index.html'));
        $music = new Page('Music', 'music.html', new SimpleContent('content-music.phtml'), Link::internal('Music', 'music.html'));
        $contact = new Page('Contact', 'contact.html', new SimpleContent('content-contact.phtml'), Link::internal('Contact', 'contact.html'));

        $allPages = array($home, $music, $software, $pages['m4lDSM'], $pages['m4lWAI'], $pages['wacNetworkMidi'], $contact);
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
