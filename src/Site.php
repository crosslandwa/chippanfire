<?php

final class Site {
    private $_pages;

    public function __construct($pages) {
        $this->_pages = $pages;
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
            $page->render(new Navigation($this->_pages));
            file_put_contents('site/' . $page->filename(), ob_get_contents());
            ob_clean();
        }
        ob_end_clean();
    }
}
