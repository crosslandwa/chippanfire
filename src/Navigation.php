<?php

class Navigation {

    private $_pages;
    private $_homepage;

    function __construct($pages) {
        $this->_pages = $pages;
        $this->_homepage = $this->_pages[0];
    }

    function render($currentPage) {
        require 'template/navigation.phtml';
    }
}
