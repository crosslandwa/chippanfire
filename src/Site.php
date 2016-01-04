<?php

class Site {
    private $_pages;
    private $_navigation;

    function __construct($pages) {
        $this->_pages = $pages;
        $this->_navigation = new Navigation($pages);
    }

    function render() {
        ob_start();
        foreach ($this->_pages as $page) {
            $page->render($this->_navigation);
            file_put_contents('site/' . $page->filename(), ob_get_contents());
            ob_clean();
        }
        ob_end_clean();
    }
}
