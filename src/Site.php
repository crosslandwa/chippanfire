<?php

class Site {
    private $_pages;

    function __construct($pages) {
        $this->_pages = $pages;
    }

    /**
     * Remove HTML pages from previous build
     */
    function clearLastBuild() {
        $oldFiles = glob('site/*.html');
        foreach ($oldFiles as $oldFile) {
            if (is_file($oldFile)) {
                unlink($oldFile);
            }
        }
    }

    function render() {
        ob_start();
        foreach ($this->_pages as $page) {
            $page->render(new Navigation($this->_pages));
            file_put_contents('site/' . $page->filename(), ob_get_contents());
            ob_clean();
        }
        ob_end_clean();
    }
}
