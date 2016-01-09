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
        $items = array_map(function($linkable) { return new Item($linkable); }, $linkedItems);
        $this->_items[] = new Dropdown($text, $items);
        return $this;
    }

    public function render(Linkable $current) {
        $currentItem = new Item($current);
        require 'template/navigation.phtml';
    }
}

final class Item {
    private $_linked;

    public function __construct(Linkable $linked) {
        $this->_linked = $linked;
    }

    public function render(Item $currentItem) {
        $activeClass = '';
        if ($currentItem->_linked === $this->_linked) {
            $activeClass = ' class="active" ';
        }

        return '<li' . $activeClass . '>' . $this->_linked->href() . '</li>';
    }
}

final class Dropdown {
    private $_text;
    private $_items;

    public function __construct($text, $items) {
        $this->_text = $text;
        $this->_items = $items;
    }

    public function render(Item $currentItem) {
        require 'template/nav-dropdown.phtml';
    }
}