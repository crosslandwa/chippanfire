<?php

class Page {
    private $_header;
    private $_title;
    private $_filename;
    private $_contentFilename;

    function __construct($title, $filename, $contentFilename) {
        $this->_header = new Header();
        $this->_title = $title;
        $this->_filename = $filename;
        $this->_contentFilename = $contentFilename;
    }

    function filename() {
        return $this->_filename;
    }

    function title() {
        return $this->_title;
    }

    function href($classes = '') {
        return '<a class="' . $classes . '" href="' . $this->filename() . '">' . $this->title() . '</a>';
    }

    private function _renderContent() {
        require $this->_contentFilename;
    }

    function render($navigation) {
        require 'template/page.phtml';
    }
}
