<?php

final class ExternalPage implements Page, Linkable {
    private $_header;
    private $_title;
    private $_href;
    private $_strapline;

    public function __construct($title, $href, $strapline) {
        $this->_header = new Header();
        $this->_title = $title;
        $this->_href = $href;
        $this->_strapline = $strapline;
    }

    public function title() {
        return $this->_title;
    }

    public function href($classes = '') {
        return Link::external($this->_title, $this->_href)->withClasses($classes);
    }

    public function strapline() {
        return $this->_strapline;
    }
}
