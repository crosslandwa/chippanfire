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
                'content' => $softwareFactory->deviceSnapshotManager(),
            ),
            'm4lWAI' => array(
                'title' => 'Where Am I',
                'href' => 'software-m4l-where-am-i.html',
                'content' => $softwareFactory->whereAmI(),
            ),
            'wacNetworkMidi' => array(
                'title' => 'Wac Network MIDI',
                'href' => 'software-wac-network-midi.html',
                'content' => $softwareFactory->wacNetworkMidi(),
            ),
            'home' => array(
                'title' => 'ChipPanFire',
                'href' => 'index.html',
                'content' => new SimpleContent('content-homepage.phtml')
            ),
            'music' => array(
                'title' => 'Music',
                'href' => 'music.html',
                'content' => new SimpleContent('content-music.phtml')
            ),
            'contact' => array(
                'title' => 'Contact',
                'href' => 'contact.html',
                'content' => new SimpleContent('content-contact.phtml')
            ),
        );

        $pageLinks = array();
        foreach ($pagesMeta as $key => $p) {
            $pageLinks[$key] = Link::internal($p['title'], $p['href']);
        }

        $kmk = array(
            'title' => 'KMK Control Script',
            'href' => 'https://github.com/crosslandwa/kmkControl',
            'content' => $softwareFactory->kmkControlScript(),
        );

        $softwareSummaries = array();
        forEach (array('m4lDSM', 'm4lWAI', 'wacNetworkMidi') as $key) {
            $softwareSummaries[] = new SoftwareSummary($pageLinks[$key], $pagesMeta[$key]['content']);
        }
        $softwareSummaries[] = new SoftwareSummary(Link::external($kmk['title'], $kmk['href']), $kmk['content']);

        $pagesMeta['software'] = array(
            'title' => 'Software',
            'href' => 'software.html',
            'content' => new SoftwareHomeContent($softwareSummaries)
        );
        $pageLinks['software'] = Link::internal($pagesMeta['software']['title'], $pagesMeta['software']['href']);

        $pages = array();
        foreach ($pagesMeta as $key => $p) {
            $pages[$key] = new Page($p['title'], $p['href'], $p['content'], $pageLinks[$key]);
        }

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
