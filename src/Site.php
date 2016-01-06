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
            'home' => array(
                'title' => 'ChipPanFire',
                'href' => 'index.html',
                'location' => 'internal',
                'content' => new SimpleContent('content-homepage.phtml')
            ),
            'music' => array(
                'title' => 'Music',
                'href' => 'music.html',
                'location' => 'internal',
                'content' => new SimpleContent('content-music.phtml')
            ),
            'contact' => array(
                'title' => 'Contact',
                'href' => 'contact.html',
                'location' => 'internal',
                'content' => new SimpleContent('content-contact.phtml')
            ),
        );

        $pages = array();
        $softwareSummaries = array();
        foreach ($pagesMeta as $key => $p) {
            $link = call_user_func('Link::' . $p['location'], $p['title'], $p['href']);

            $page = new Page($p['title'], $p['href'], $p['content'], $link);

            if ($p['location'] === 'internal') {
                $pages[$key] = $page;
            }

            if (isset($p['has_summary']) && $p['has_summary']) {
                $softwareSummaries[] = new SoftwareSummary($page, $p['content']);
            }
        }

        // TODO keep moving into above pattern
        $pages['software'] = new Page('Software', 'software.html', new SoftwareHomeContent($softwareSummaries), Link::internal('Software', 'software.html'));

        $navPages = array($pages['home'], $pages['music'], $pages['software'], $pages['contact']);

        return new Site($pages, new Navigation($navPages));
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
