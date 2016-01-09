<?php

final class NavItem {
    private $_page;

    public function __construct($page) {
        $this->_page = $page;
    }

    public function render($currentPage) {
        $activeClass = '';
        if ($currentPage === $this->_page) {
            $activeClass = ' class="active" ';
        }

        return '<li' . $activeClass . '>' . $this->_page->href() . '</li>';
    }
}