<?php

class Site {
    private $_pages;

    function __construct($pages) {
        $this->_pages = $pages;
    }

    function render() {
        ob_start();
        foreach ($this->_pages as $page) {
            $page->render();
            file_put_contents('site/' . $page->filename(), ob_get_contents());
            ob_clean();
        }
        ob_end_clean();
    }
}
