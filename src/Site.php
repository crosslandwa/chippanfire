<?php

final class Site {
    private $_pages;
    private $_navigation;

    private function __construct($pages, $navigation) {
        $this->_pages = $pages;
        $this->_navigation = $navigation;
    }

    public final static function create() {
        $pageFactory = new PageFactory();

        $pagesMeta = array(
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

        $pages = array();
        foreach ($pagesMeta as $key => $p) {
            $pages[$key] = new Page($p['title'], $p['href'], $p['content'], $pageLinks[$key]);
        }
        $pages['m4lWAI'] = $pageFactory->m4lWAI();
        $pages['m4lDSM'] = $pageFactory->m4lDSM();
        $pages['software'] = $pageFactory->software();
        $pages['wacNetworkMidi'] = $pageFactory->wacNetworkMidi();

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
