<?php

final class ExternalPage implements Page, Linkable {
    private $_header;
    private $_title;
    private $_href;
    private $_headlineText;

    public function __construct($title, $href, $headlineText = '') {
        $this->_header = new Header();
        $this->_title = $title;
        $this->_href = $href;
        $this->_headlineText = $headlineText;
    }

    public function title() {
        return $this->_title;
    }

    public function href($classes = '') {
        return Link::external($this->_title, $this->_href)->withClasses($classes);
    }

    public function headlineText() {
        return $this->_headlineText;
    }
}
