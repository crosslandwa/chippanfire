<?php

final class Navigation {

    private $_pages;
    private $_homepage;

    public function __construct($pages) {
        $this->_pages = $pages;
        $this->_homepage = $this->_pages[0];
    }

    public function render($currentPage) {
        require 'template/navigation.phtml';
    }
}
