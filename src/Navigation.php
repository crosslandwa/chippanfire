<?php

final class Navigation {

    private $_items;
    private $_homepage;

    public function __construct($homepage, $items) {
        $this->_items = $items;
        $this->_homepage = $homepage;
    }

    public function render($currentPage) {
        require 'template/navigation.phtml';
    }
}
