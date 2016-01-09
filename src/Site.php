<?php

final class Site {
    private $_pages;
    private $_navigation;

    private function __construct($pages, $navigation) {
        $this->_pages = $pages;
        $this->_navigation = $navigation;
    }

    public final static function create() {
        $pages = new PageFactory();

        return new Site(
            array(
                $pages->home(),
                $pages->music(),
                $pages->contact(),
                $pages->software(),
                $pages->m4lWAI(),
                $pages->m4lDSM(),
                $pages->m4lMCM(),
                $pages->wacNetworkMidi(),
                $pages->miniakPatchEditor()
            ),
            new Navigation($pages->home())
                ->addItem($pages->music())
                ->addDropdown('Software', array_merge(array($pages->software()), $pages->linkedSoftwarePages()))
                ->addItem($pages->contact())
        );
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
