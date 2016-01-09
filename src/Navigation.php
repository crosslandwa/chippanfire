<?php

final class Navigation {

    private $_items;
    private $_homepage;

    public function __construct($homepage) {
        $this->_items = array();
        $this->_homepage = $homepage;
    }

    public function addItem(Linkable $linked) {
        $this->_items[] = new Item($linked);
        return $this;
    }

    public function addDropdown($text, $linkedItems) {
        $this->_items[] = new Dropdown($text, $linkedItems);
        return $this;
    }

    public function render($currentPage) {
        require 'template/navigation.phtml';
    }
}

final class Item {
    private $_linked;

    public function __construct(Linkable $linked) {
        $this->_linked = $linked;
    }

    public function render($currentPage) {
        $activeClass = '';
        if ($currentPage === $this->_linked) {
            $activeClass = ' class="active" ';
        }

        return '<li' . $activeClass . '>' . $this->_linked->href() . '</li>';
    }
}

final class Dropdown {
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