<?php

final class Page {
    private $_header;
    private $_title;
    private $_filename;
    private $_contentFilename;

    public function __construct($title, $filename, $contentFilename) {
        $this->_header = new Header();
        $this->_title = $title;
        $this->_filename = $filename;
        $this->_contentFilename = $contentFilename;
    }

    public function filename() {
        return $this->_filename;
    }

    private function title() {
        return $this->_title;
    }

    public function href($classes = '') {
        return '<a class="' . $classes . '" href="' . $this->filename() . '">' . $this->title() . '</a>';
    }

    private function _renderContent() {
        require 'template/' . $this->_contentFilename;
    }

    public function render($navigation) {
        require 'template/page.phtml';
    }
}
