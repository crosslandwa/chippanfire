<?php

final class Page {
    private $_header;
    private $_title;
    private $_filename;
    private $_content;

    public function __construct($title, $filename, $content) {
        $this->_header = new Header();
        $this->_title = $title;
        $this->_filename = $filename;
        $this->_content = $content;
    }

    public function filename() {
        return $this->_filename;
    }

    public function title() {
        return $this->_title;
    }

    public function href($classes = '') {
        return '<a class="' . $classes . '" href="' . $this->filename() . '">' . $this->title() . '</a>';
    }

    private function _renderContent() {
        $this->_content->render($this);
    }

    public function render($navigation) {
        require 'template/page.phtml';
    }
}
