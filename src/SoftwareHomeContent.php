<?php

final class SoftwareHomeContent {
    private $_linkedPages;

    public function __construct($linkedPages) {
        $this->_linkedPages = $linkedPages;
    }

    public function render($page) {
        require 'template/content-software.phtml';
    }
}
