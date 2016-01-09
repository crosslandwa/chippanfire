<?php

final class NavDropdown {
    private $_text;
    private $_pages;

    public function __construct($text, $pages) {
        $this->_text = $text;
        $this->_pages = $pages;
    }

    public function render($currentPage) {
        require 'template/nav-dropdown.phtml';
    }
}