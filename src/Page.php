<?php

class Page {
    private $_header;
    private $_navigation;
    private $_meta;

    function __construct($meta, $navigation) {
        $this->_header = new Header();
        $this->_navigation = $navigation;
        $this->_meta = $meta;
    }

    function filename() {
        return $this->_meta->filename();
    }

    private function _renderNavigation() {
        $this->_navigation->render();
    }

    private function _renderContent() {
        require $this->_meta->contentFilename();
    }

    function render() {
        require 'template/page.phtml';
    }
}
