<?php

final class InternalPage implements Page, Linkable {
    private $_header;
    private $_title;
    private $_filename;
    private $_content;
    private $_link;
    private $_headlineText;

    public function __construct($title, $filename, $content, $headlineText = '') {
        $this->_header = new Header();
        $this->_title = $title;
        $this->_filename = $filename;
        $this->_content = $content;
        $this->_headlineText = $headlineText;
    }

    public function filename() {
        return $this->_filename;
    }

    public function title() {
        return $this->_title;
    }

    public function href($classes = '') {
        return Link::internal($this->_title, $this->_filename)->withClasses($classes);
    }

    private function _renderContent() {
        $this->_content->render($this);
    }

    public function render(Navigation $navigation) {
        require 'template/page.phtml';
    }

    public function headlineText() {
        return $this->_headlineText;
    }
}
